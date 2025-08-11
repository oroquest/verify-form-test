// netlify/functions/send_verify_email.js
exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return cors(200, '');
    }
    if (event.httpMethod !== 'POST') {
      return cors(405, '');
    }

    const { email, id, lang, category, token } = JSON.parse(event.body || '{}');

    // Eingaben prüfen
    if (!email || !id || !token) return cors(400, { error: 'missing_params' });
    if (!/^[0-9a-f]{64}$/.test(String(token))) {
      return cors(400, { error: 'invalid_token_format' });
    }

    // Template pro Kategorie/Sprache
    const tplMap = {
      direct:   { de: process.env.TEMPLATE_DE_DIRECT, en: process.env.TEMPLATE_EN_DIRECT, it: process.env.TEMPLATE_IT_DIRECT },
      lawyer:   { de: process.env.TEMPLATE_DE_LAWYER, en: process.env.TEMPLATE_EN_LAWYER, it: process.env.TEMPLATE_IT_LAWYER },
      fallback: { de: process.env.TEMPLATE_DE_DIRECT, en: process.env.TEMPLATE_EN_DIRECT, it: process.env.TEMPLATE_IT_DIRECT },
    };
    const L = (lang || 'de').toLowerCase();
    const CAT = (category || 'fallback').toLowerCase();
    const tplByLang = tplMap[CAT] || tplMap.fallback;
    const templateId = Number(tplByLang[L] || tplByLang.de);
    if (!templateId) return cors(500, { error: 'template_not_configured', CAT, L });

    const base = process.env.BASE_VERIFY_URL || 'https://verify.sikuralife.com';
    const emB64 = toB64Url(String(email).trim().toLowerCase());
    const verifyUrl = `${base}/?lang=${encodeURIComponent(L)}&id=${encodeURIComponent(id)}&token=${token}&em=${emB64}`;

    // Mailjet v3.1 /send via fetch (Basic Auth PUBLIC:PRIVATE)
    const mjPub = process.env.MJ_APIKEY_PUBLIC;
    const mjPrv = process.env.MJ_APIKEY_PRIVATE;
    if (!mjPub || !mjPrv) return cors(500, { error: 'mailjet_keys_missing' });

    const auth = Buffer.from(`${mjPub}:${mjPrv}`).toString('base64');
    const body = {
      Messages: [{
        From: { Email: process.env.MAIL_FROM_ADDRESS, Name: process.env.MAIL_FROM_NAME },
        To:   [{ Email: email }],
        TemplateID: templateId,
        TemplateLanguage: true,
        Variables: {
          url: verifyUrl,
          id,
          email,
          token
        }
      }]
    };

    const r = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    if (!r.ok) {
      return cors(502, { error: 'mailjet_error', status: r.status, body: safeCut(text) });
    }

    return cors(200, { templateId, url: verifyUrl });
  } catch (e) {
    return cors(500, { error: 'crash', message: String(e && e.message || e) });
  }
};

// Helpers
function cors(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://verify.sikuralife.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'Strict-Transport-Security': 'max-age=31536000'
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
}
function toB64Url(str) {
  return Buffer.from(str, 'utf8').toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function safeCut(s) { return (s || '').slice(0, 500); }
