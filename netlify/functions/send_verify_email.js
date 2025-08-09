// netlify/functions/send_verify_email.js
// Sends a transactional email via Mailjet template AFTER issuing a fresh 7‑day token.
// Env vars required:
//   MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE
// Optional env vars:
//   BASE_VERIFY_URL       (default: https://verify.sikuralife.com/  — for link building in issue_token)
//   URL_ISSUE_TOKEN       (defaults to <site>/.netlify/functions/issue_token)
//   MAIL_FROM_ADDRESS, MAIL_FROM_NAME
//
// POST body (JSON):
//   email       (required)
//   id          (required)     // creditor number
//   lang        (optional)     // de|it|en (default: de)
//   name        (optional)     // recipient name
//   templateId  (required)     // Mailjet TemplateID (number)
//
// Response: { ok, url, expiresAt }
const MJ_PUBLIC  = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS || 'no-reply@sikuralife.com';
const MAIL_FROM_NAME    = process.env.MAIL_FROM_NAME    || 'SIKURA';

function parseBody(event) {
  const ct = (event.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json')) {
    try { return JSON.parse(event.body || '{}'); } catch { return {}; }
  }
  try {
    const params = new URLSearchParams(event.body || '');
    return Object.fromEntries(params.entries());
  } catch { return {}; }
}

function normalizeSiteUrl() {
  // Prefer Netlify's URL env if present, fallback to BASE_VERIFY_URL or public domain
  const site = (process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/+$/,'');
  const base = (process.env.BASE_VERIFY_URL || 'https://verify.sikuralife.com/').replace(/\/+$/,'');
  return site || base;
}

async function issueToken(email, id, lang='de', name='') {
  const site = normalizeSiteUrl();
  const endpoint = (process.env.URL_ISSUE_TOKEN || `${site}/.netlify/functions/issue_token`);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, id, lang, name })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`issue_token failed: ${res.status} ${t}`);
  }
  return res.json(); // { ok, token, expiresAt, url }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    const { email, id, lang = 'de', name = '', templateId } = parseBody(event);

    if (!email || !id || !templateId) {
      return { statusCode: 400, body: 'missing email or id or templateId' };
    }

    // 1) Fresh 7‑day token & URL
    const { url, expiresAt } = await issueToken(String(email).trim().toLowerCase(), String(id).trim(), String(lang).toLowerCase(), name);

    // 2) Mailjet v3.1 send using template + variables
    const payload = {
      Messages: [{
        From: { Email: MAIL_FROM_ADDRESS, Name: MAIL_FROM_NAME },
        To:   [{ Email: email, Name: name }],
        TemplateID: Number(templateId),
        TemplateLanguage: true,
        Variables: {
          verify_url: url,
          expires_at: expiresAt
        }
      }]
    };

    const resp = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: { Authorization: mjAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: 502, body: `Mailjet send failed: ${resp.status} ${t}` };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, url, expiresAt })
    };
  } catch (e) {
    return { statusCode: 500, body: 'server error: ' + e.message };
  }
};
