const crypto = require('crypto');

const MJ_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let data;
  try { data = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const email = (data.email || '').trim();
  const adresse = (data.adresse || '').trim();
  if (!email || !adresse) return { statusCode: 400, body: 'Missing required fields' };

  const ip = event.headers['x-nf-client-connection-ip'] || 'unknown';
  const timestamp = new Date().toISOString();
  const token = crypto.randomBytes(8).toString('hex');
  const host = event.headers.host || 'example.com';
  const link = `https://${host}/.netlify/functions/verify_check?id=${encodeURIComponent(email)}&token=${token}`;

  try {
    // Schritt 1: Kontakt anlegen, falls nicht vorhanden
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

    // Schritt 2: Kontakt-Properties aktualisieren (korrekte Route & Methode)
    const updateResp = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: { Authorization: mjAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Data: [
          { Name: 'adresse_verify', Value: adresse },
          { Name: 'email_verify', Value: email },
          { Name: 'ip_verify', Value: ip },
          { Name: 'timestamp_verify', Value: timestamp },
          { Name: 'token_verify', Value: token },
          { Name: 'link_verify', Value: link }
        ]
      })
    });

    if (!updateResp.ok) {
      const t = await updateResp.text();
      return { statusCode: 500, body: `Mailjet update failed: ${t}` };
    }

    // Schritt 3: Bestätigungsmail senden
    const respMail = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: { 'Authorization': mjAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Messages: [{
          From: { Email: "deine@domain.ch", Name: "Vision Flow" },
          To: [{ Email: email }],
          Subject: "Bitte bestätige deine E‑Mail",
          HTMLPart: `<p>Hallo,</p><p>Bitte bestätige deine Adresse über folgenden Link:</p><p><a href="${link}">${link}</a></p>`
        }]
      })
    });

    if (!respMail.ok) {
      const t = await respMail.text();
      return { statusCode: 500, body: `Mail send failed: ${t}` };
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'OK' }) };
  } catch (e) {
    return { statusCode: 500, body: `Server error: ${e.message}` };
  }
};
