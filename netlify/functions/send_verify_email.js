// netlify/functions/send_verify_email.js
const MJ_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

const URL_ISSUE_TOKEN = process.env.URL_ISSUE_TOKEN || 'https://verify.sikuralife.com/.netlify/functions/issue_token';

function parseBody(event) {
  const ct = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
  if (ct.includes('application/json')) {
    try { return JSON.parse(event.body || '{}'); } catch { return {}; }
  }
  try {
    const params = new URLSearchParams(event.body || '');
    const obj = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    return obj;
  } catch {
    return {};
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, id, lang, name, templateId } = parseBody(event);
    if (!email || !id || !lang || !templateId) {
      return { statusCode: 400, body: 'Missing required parameters (email, id, lang, templateId)' };
    }

    // 1) Token erstellen
    const issueResp = await fetch(URL_ISSUE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, id, lang })
    });

    if (!issueResp.ok) {
      const t = await issueResp.text();
      return { statusCode: 502, body: `issue_token failed: ${t}` };
    }

    const tokenData = await issueResp.json();
    if (!tokenData.ok || !tokenData.url || !tokenData.expiresAt) {
      return { statusCode: 500, body: 'Invalid response from issue_token' };
    }

    // 2) Mailjet Send vorbereiten
    const sendBody = {
      Messages: [
        {
          From: { Email: "noreply@sikuralife.com", Name: "SIKURA Leben AG i.L." },
          To: [{ Email: email, Name: name || "" }],
          TemplateID: Number(templateId),
          TemplateLanguage: true,
          Variables: {
            verify_url: tokenData.url,
            expires_at: tokenData.expiresAt
          }
        }
      ]
    };

    // 3) An Mailjet senden
    const sendResp = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        Authorization: mjAuth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sendBody)
    });

    const sendResult = await sendResp.json();
    if (!sendResp.ok) {
      return { statusCode: 502, body: `Mailjet send failed: ${JSON.stringify(sendResult)}` };
    }

    // 4) Erfolg zurückgeben
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        url: tokenData.url,
        expiresAt: tokenData.expiresAt,
        mailjet: sendResult
      })
    };

  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
