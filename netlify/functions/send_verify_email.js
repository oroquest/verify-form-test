// netlify/functions/send_verify_email.js
const MJ_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, id, lang, name, templateId } = JSON.parse(event.body || '{}');
    if (!email || !id || !lang || !templateId) {
      return { statusCode: 400, body: 'Missing parameters' };
    }

    // 1) Token generieren
    const tokenResp = await fetch(`${process.env.URL_BASE}/.netlify/functions/issue_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, id, lang })
    });
    if (!tokenResp.ok) {
      return { statusCode: 500, body: `Token generation failed: ${await tokenResp.text()}` };
    }
    const tokenData = await tokenResp.json();
    const verifyUrl = tokenData.url;
    const expiresAt = tokenData.expiresAt;

    // 2) Mailjet API Call mit Variablen
    const mjResp = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        Authorization: mjAuth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: "noreply@sikuralife.com", Name: "SIKURA Leben AG i.L." },
            To: [{ Email: email, Name: name || "" }],
            TemplateID: templateId,
            TemplateLanguage: true,
            Variables: {
              verify_url: verifyUrl,
              expires_at: expiresAt
            }
          }
        ]
      })
    });

    if (!mjResp.ok) {
      return { statusCode: 500, body: `Mailjet send failed: ${await mjResp.text()}` };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, url: verifyUrl })
    };

  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
