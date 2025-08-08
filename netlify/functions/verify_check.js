const MJ_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

// Testmodus-Schalter: true = abgelaufene Tokens werden NICHT blockiert (nur Hinweis)
const TEST_MODE = true;

const messages = {
  success: {
    de: "✅ Vielen Dank – Ihre E-Mail-Adresse und Adresse wurden erfolgreich bestätigt.",
    it: "✅ Grazie – Il tuo indirizzo e-mail e l’indirizzo sono stati confermati con successo.",
    en: "✅ Thank you – Your e-mail address and postal address have been successfully confirmed."
  },
  fail: {
    de: "❌ Ungültiger oder abgelaufener Verifizierungslink.",
    it: "❌ Link di verifica non valido o scaduto.",
    en: "❌ Invalid or expired verification link."
  },
  warn: {
    de: "⚠ Hinweis: Der Link ist älter als die zulässige Gültigkeit. (Testmodus – keine Sperre)",
    it: "⚠ Avviso: Il link è più vecchio della validità consentita. (Modalità test – nessun blocco)",
    en: "⚠ Notice: The link is older than the allowed validity. (Test mode – no blocking)"
  }
};

function langFromCountry(country) {
  const c = (country || '').toUpperCase();
  if (c === 'CH' || c === 'DE' || c === 'AT') return 'de';
  if (c === 'IT') return 'it';
  return 'en';
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const email = (q.id || '').trim();
  const token = (q.token || '').trim();
  let lang = (q.lang || '').toLowerCase();

  if (!email || !token) return { statusCode: 400, body: 'Missing parameters' };

  try {
    // Kontakt-Properties auslesen
    const resp = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      headers: { Authorization: mjAuth }
    });
    if (!resp.ok) return { statusCode: 500, body: `Mailjet fetch failed: ${await resp.text()}` };

    const body = await resp.json();
    const rows = body.Data || [];
    const dataList = rows[0]?.Data || [];
    const props = Object.fromEntries(dataList.map(d => [d.Name, d.Value]));

    if (!lang) lang = langFromCountry(props.country);

    // Token prüfen
    if (!props.token_verify || props.token_verify !== token) {
      return { statusCode: 400, body: messages.fail[lang] || messages.fail.en };
    }

    // Ablaufdatum prüfen
    let warnPrefix = "";
    if (props.token_expiry) {
      const now = new Date();
      const exp = new Date(props.token_expiry);
      if (isFinite(exp) && now > exp) {
        if (TEST_MODE) {
          warnPrefix = (messages.warn[lang] || messages.warn.en) + "\n\n";
        } else {
          return { statusCode: 410, body: messages.fail[lang] || messages.fail.en };
        }
      }
    }

    // Token & Link leeren
    await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: { Authorization: mjAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Data: [
          { Name: 'token_verify', Value: '' },
          { Name: 'link_verify', Value: '' }
        ]
      })
    });

    return {
      statusCode: 200,
      body: warnPrefix + (messages.success[lang] || messages.success.en)
    };
  } catch (e) {
    return { statusCode: 500, body: `Server error: ${e.message}` };
  }
};