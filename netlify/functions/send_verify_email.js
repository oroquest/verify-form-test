// netlify/functions/send_verify_email.js

const fetch = require('node-fetch');

// Mapping aus ENV laden
const TPL = {
  de: {
    VN_DIREKT: process.env.TEMPLATE_DE_DIRECT,
    VN_ANWALT: process.env.TEMPLATE_DE_LAWYER
  },
  en: {
    VN_DIREKT: process.env.TEMPLATE_EN_DIRECT,
    VN_ANWALT: process.env.TEMPLATE_EN_LAWYER
  },
  it: {
    VN_DIREKT: process.env.TEMPLATE_IT_DIRECT,
    VN_ANWALT: process.env.TEMPLATE_IT_LAWYER
  }
};

// Normalisierung der Sprache (kleinbuchstaben)
function normLang(l) {
  return String(l || '').trim().toLowerCase();
}

// Normalisierung Kategorie (Leerzeichen → Unterstrich, Grossbuchstaben)
function normCat(c) {
  return String(c || '').trim().toUpperCase().replace(/\s+/g, '_');
}

// Sprach-Fallback: EN → DE → IT
function languageWithFallback(requested) {
  const l = normLang(requested);
  const hasAny = !!(TPL?.[l]?.VN_DIREKT || TPL?.[l]?.VN_ANWALT);
  if (hasAny) return l;
  if (TPL?.en?.VN_DIREKT || TPL?.en?.VN_ANWALT) return 'en';
  if (TPL?.de?.VN_DIREKT || TPL?.de?.VN_ANWALT) return 'de';
  if (TPL?.it?.VN_DIREKT || TPL?.it?.VN_ANWALT) return 'it';
  return l; // falls gar nix passt, das Original
}

// Template-ID Auswahl mit Fallback
function pickTemplateId(lang, category, explicitTemplateId) {
  if (explicitTemplateId) return Number(explicitTemplateId);

  const resolved = languageWithFallback(lang);
  const c = category;

  const candidates = [
    TPL?.[resolved]?.[c],
    TPL?.[resolved]?.VN_DIREKT,
    TPL?.en?.[c],
    TPL?.en?.VN_DIREKT,
    TPL?.de?.[c],
    TPL?.de?.VN_DIREKT,
    TPL?.it?.[c],
    TPL?.it?.VN_DIREKT
  ].filter(Boolean);

  if (candidates.length) return Number(candidates[0]);
  throw new Error(`No template mapping for lang=${lang} category=${category}`);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const { email, id, lang, category, name, templateId } = data;
    if (!email || !id) {
      return { statusCode: 400, body: 'Missing email or id' };
    }

    // 1) Token generieren
    const issueResp = await fetch(process.env.URL_ISSUE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, id, lang })
    });

    if (!issueResp.ok) {
      throw new Error(`Token service error: ${await issueResp.text()}`);
    }

    const issueData = await issueResp.json();
    const verifyUrl = issueData.url;
    const expiresAt = issueData.expiresAt;

    // 2) Sprache/Kategorie normalisieren
    const plang = normLang(lang);
    const pcat = normCat(category);
    const tplId = pickTemplateId(plang, pcat, templateId);

    // 3) Mailjet API Call
    const MJ_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
    const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
    const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

    const mjResp = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        Authorization: mjAuth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Messages: [
          {
            From: {
              Email: process.env.MAIL_FROM_ADDRESS,
              Name: process.env.MAIL_FROM_NAME
            },
            To: [{ Email: email, Name: name || '' }],
            TemplateID: tplId,
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
      throw new Error(`Mailjet send error: ${await mjResp.text()}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        url: verifyUrl,
        expiresAt,
        lang: plang,
        category: pcat,
        templateId: tplId
      })
    };

  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
