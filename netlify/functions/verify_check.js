
const MJ_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

exports.handler = async (event) => {
  const params = event.queryStringParameters;
  const email = decodeURIComponent(params.id || "").trim();
  const token = (params.token || "").trim();
  const langParam = (params.lang || "").trim().toLowerCase();

  if (!email || !token) {
    return { statusCode: 400, body: "Missing parameters" };
  }

  try {
    // Hole Kontaktdaten
    const resp = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: { Authorization: mjAuth }
    });

    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: 500, body: `Mailjet fetch failed: ${t}` };
    }

    const json = await resp.json();
    const props = {};
    (json.Data[0]?.Data || []).forEach(p => { props[p.Name] = p.Value; });

    // Sprache bestimmen
    let lang = langParam;
    if (!lang) {
      const country = (props.country || "").toUpperCase();
      if (country === "CH" || country === "DE" || country === "AT") lang = "de";
      else if (country === "IT") lang = "it";
      else lang = "en";
    }

    // Übersetzungen
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
      }
    };

    // Token prüfen
    if (props.token_verify !== token) {
      return { statusCode: 400, body: messages.fail[lang] || messages.fail.en };
    }

    // Token und Link leeren
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

    return { statusCode: 200, body: messages.success[lang] || messages.success.en };

  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
