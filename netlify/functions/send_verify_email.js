// netlify/functions/send_verify_email.js
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: '' };
    }

    const { email, id, lang, category, token } = JSON.parse(event.body || '{}');

    // 1) Eingaben prüfen
    if (!email || !id || !token) {
      return resp(400, { error: 'missing_params' });
    }
    const tokenOk = /^[0-9a-f]{64}$/.test(String(token)); // exakt 64-hex (32 Bytes)
    if (!tokenOk) {
      return resp(400, { error: 'invalid_token_format' });
    }

    // 2) Template pro Kategorie wählen (DE/EN/IT je nach Wunsch)
    const tplMap = {
      // Beispiel: passe IDs an deine Mailjet-Template-IDs an
      direct:   { de: process.env.TEMPLATE_DE_DIRECT,   en: process.env.TEMPLATE_EN_DIRECT,   it: process.env.TEMPLATE_EN_DIRECT },
      lawyer:   { de: process.env.TEMPLATE_DE_LAWYER,   en: process.env.TEMPLATE_EN_LAWYER,   it: process.env.TEMPLATE_EN_LAWYER },
      fallback: { de: process.env.TEMPLATE_DE_DIRECT,   en: process.env.TEMPLATE_EN_DIRECT,   it: process.env.TEMPLATE_EN_LAWYER },
    };
    const l = (lang || 'de').toLowerCase();
    const cat = (category || 'fallback').toLowerCase();
    const tplByLang = tplMap[cat] || tplMap.fallback;
    const templateId = tplByLang[l] || tplByLang.de;

    if (!templateId) {
      return resp(500, { error: 'template_not_configured', cat, lang: l });
    }

    // 3) Link NUR aus dem übergebenen Token bauen (kein Neuerzeugen!)
    const base = process.env.BASE_VERIFY_URL || 'https://verify.sikuralife.com';
    const emB64url = toB64Url(email.trim().toLowerCase());
    const verifyUrl = `${base}/?lang=${encodeURIComponent(l)}&id=${encodeURIComponent(id)}&token=${token}&em=${emB64url}`;

    // 4) Mailjet aufrufen
    const mj = require('node-mailjet').apiConnect(
      process.env.MJ_APIKEY_PUBLIC,
      process.env.MJ_APIKEY_PRIVATE
    );

    // Gläubiger-Nr in der Mail anzeigen: als Variable mitschicken
    const vars = {
      url: verifyUrl,
      id,
      email: email,
      token: token,
    };

    const request = await mj.post('send', { version: 'v3.1' }).request({
      Messages: [{
        From: { Email: process.env.MAIL_FROM_ADDRESS, Name: process.env.MAIL_FROM_NAME },
        To:   [{ Email: email }],
        TemplateID: Number(templateId),
        TemplateLanguage: true,
        Variables: vars
      }]
    });

    return resp(200, { templateId, url: verifyUrl });
  } catch (e) {
    return resp(500, { error: 'crash', message: String(e && e.message || e) });
  }
};

// Helpers
function resp(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://verify.sikuralife.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Strict-Transport-Security': 'max-age=31536000'
    },
    body: JSON.stringify(body)
  };
}
function toB64Url(str) {
  const b64 = Buffer.from(str, 'utf8').toString('base64');
  return b64.replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
}
