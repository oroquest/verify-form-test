const crypto = require('crypto');

const MJ_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

// Testmodus-Schalter: true = abgelaufene Tokens werden NICHT blockiert (nur Hinweis)
const TEST_MODE = true;
// Ablauf in Tagen
const TOKEN_EXPIRY_DAYS = 7;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let data;
  try { data = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const email = (data.email || '').trim();
  // Neue Adress-Felder (bearbeitbar, Pflicht im Frontend)
  const glaeubiger = (data.glaeubiger || '').trim();
  const firstname = (data.firstname || '').trim();
  const name = (data.name || '').trim();
  const strasse = (data.strasse || '').trim();
  const hausnummer = (data.hausnummer || '').trim();
  const plz = (data.plz || '').trim();
  const ort = (data.ort || '').trim();
  const country = (data.country || '').trim();

  if (!email) return { statusCode: 400, body: 'Missing required field: email' };

  const ip = event.headers['x-nf-client-connection-ip'] || 'unknown';
  const timestamp = new Date().toISOString();
  const token = crypto.randomBytes(16).toString('hex'); // 32 hex-Zeichen
  const expiryDate = new Date(Date.now() + TOKEN_EXPIRY_DAYS*24*60*60*1000).toISOString();

  const host = event.headers.host || 'example.com';
  const url = new URL(`https://${host}/.netlify/functions/verify_check`);
  url.searchParams.set('id', email);
  url.searchParams.set('token', token);
  // Sprache kann optional vom Frontend mitgegeben werden (lang=de|it|en)
  if (data.lang) url.searchParams.set('lang', String(data.lang).toLowerCase());
  const link = url.toString();

  try {
    // 0) Kontakt anlegen, falls nicht vorhanden
    const getResp = await fetch(`https://api.mailjet.com/v3/REST/contact/${encodeURIComponent(email)}`, {
      headers: { Authorization: mjAuth }
    });
    if (getResp.status === 404) {
      const createResp = await fetch('https://api.mailjet.com/v3/REST/contact', {
        method: 'POST',
        headers: { Authorization: mjAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ Email: email })
      });
      if (!createResp.ok) {
        const t = await createResp.text();
        return { statusCode: 500, body: `Kontaktanlage fehlgeschlagen: ${t}` };
      }
    }

    // 1) Kontakt-Properties aktualisieren (überschreiben)
    const updateBody = {
      Data: [
        { Name: 'glaeubiger', Value: glaeubiger },
        { Name: 'firstname', Value: firstname },
        { Name: 'name', Value: name },
        { Name: 'strasse', Value: strasse },
        { Name: 'hausnummer', Value: hausnummer },
        { Name: 'plz', Value: plz },
        { Name: 'ort', Value: ort },
        { Name: 'country', Value: country },
        { Name: 'ip_verify', Value: ip },
        { Name: 'timestamp_verify', Value: timestamp },
        { Name: 'token_verify', Value: token },
        { Name: 'token_expiry', Value: expiryDate },
        { Name: 'link_verify', Value: link }
      ]
    };

    const updateResp = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: { Authorization: mjAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify(updateBody)
    });
    if (!updateResp.ok) {
      const t = await updateResp.text();
      return { statusCode: 500, body: `Mailjet update failed: ${t}` };
    }

    // 2) Bestätigungsmail senden
    const respMail = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: { 'Authorization': mjAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Messages: [{
          From: { Email: "noreply@sikuralife.com", Name: "Sikura Life Verifizierung" },
          ReplyTo: { Email: "support@sikuralife.com", Name: "Sikura Support" },
          To: [{ Email: email }],
          Subject: "Bitte bestätige deine Adresse / Per favore conferma il tuo indirizzo / Please confirm your address",
          HTMLPart: `
            <p>DE: Bitte bestätige deine E‑Mail-Adresse und Postadresse über folgenden Link:</p>
            <p><a href="${link}">${link}</a></p>
            <p>Hinweis: Der Link ist aus Sicherheitsgründen ${TOKEN_EXPIRY_DAYS} Tage gültig.${TEST_MODE ? " (Testmodus: keine Sperrung nach Ablauf)" : ""}</p>
            <hr/>
            <p>IT: Conferma il tuo indirizzo e-mail e postale tramite il seguente link:</p>
            <p><a href="${link}">${link}</a></p>
            <p>Nota: Il link è valido per motivi di sicurezza per ${TOKEN_EXPIRY_DAYS} giorni.${TEST_MODE ? " (Modalità test: nessun blocco dopo la scadenza)" : ""}</p>
            <hr/>
            <p>EN: Please confirm your e‑mail and postal address via the following link:</p>
            <p><a href="${link}">${link}</a></p>
            <p>Note: For security, the link is valid for ${TOKEN_EXPIRY_DAYS} days.${TEST_MODE ? " (Test mode: no blocking after expiry)" : ""}</p>
          `
        }]
      })
    });
    const mailText = await respMail.text();
    if (!respMail.ok) {
      return { statusCode: 500, body: `Mail send failed: ${mailText}` };
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'OK', testMode: TEST_MODE }) };
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};