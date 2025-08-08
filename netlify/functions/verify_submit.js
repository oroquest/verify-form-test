// Secure verify_submit: validates id+token from referer (or body), decodes email from body or Base64URL 'em' param,
// checks against Mailjet contact properties, then updates address fields. Test-mode keeps expiry lenient.
const crypto = require('crypto');

const MJ_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

const TEST_MODE = true;           // in PROD set to false
const ENFORCE_EXPIRY = false;     // in PROD set to true

function parseFormBody(event) {
  const ct = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
  if (ct.includes('application/json')) {
    try { return JSON.parse(event.body || '{}'); } catch { return {}; }
  }
  // x-www-form-urlencoded
  try {
    const params = new URLSearchParams(event.body || '');
    const obj = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    return obj;
  } catch {
    return {};
  }
}

function b64urlDecode(input) {
  if (!input) return '';
  let s = String(input).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  try { return Buffer.from(s, 'base64').toString('utf8'); } catch { return ''; }
}

function getIdTokenFromReferer(event) {
  const ref = event.headers.referer || event.headers.Referer || '';
  if (!ref) return {};
  try {
    const u = new URL(ref);
    const id = u.searchParams.get('id') || '';
    const token = u.searchParams.get('token') || '';
    const em = u.searchParams.get('em') || '';
    const lang = (u.searchParams.get('lang') || '').toLowerCase();
    return { id, token, em, lang };
  } catch {
    return {};
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const body = parseFormBody(event);
  // Prefer hidden fields; fallback to referer params
  const ref = getIdTokenFromReferer(event);

  const id = (body.id || ref.id || '').trim();           // creditor number
  const token = (body.token || ref.token || '').trim();   // verify token
  const em = (body.em || ref.em || '').trim();            // Base64URL email (optional)
  const lang = (body.lang || ref.lang || 'de').toLowerCase();

  let email = (body.email || '').trim();
  if (!email && em) email = b64urlDecode(em).trim();

  if (!email || !id || !token) {
    return { statusCode: 400, body: 'Missing required parameters (email/id/token)' };
  }

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown';
  const timestamp = new Date().toISOString();

  try {
    // 1) Pull contact properties by email
    const resp = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      headers: { Authorization: mjAuth }
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: 502, body: `Mailjet fetch failed: ${t}` };
    }
    const json = await resp.json();
    const propsArray = json.Data?.[0]?.Data || [];
    const props = Object.fromEntries(propsArray.map(p => [p.Name, p.Value]));

    // 2) Validate glaeubiger + token (+expiry)
    const glaeubiger = (props['gläubiger'] ?? props['glaeubiger'] ?? '').toString().trim();
    const tokenVerify = (props['token_verify'] || '').toString().trim();
    const tokenExpiry = props['token_expiry'] ? new Date(props['token_expiry']) : null;

    if (glaeubiger !== id) {
      return { statusCode: 403, body: 'ID mismatch' };
    }
    if (!tokenVerify || tokenVerify !== token) {
      return { statusCode: 403, body: 'Invalid token' };
    }
    if (tokenExpiry && isFinite(tokenExpiry) && tokenExpiry < new Date() && ENFORCE_EXPIRY) {
      return { statusCode: 410, body: 'Token expired' };
    }

    // 3) Build update set from submitted address fields
    const fields = ['firstname','name','strasse','hausnummer','plz','ort','country'];
    const updates = [];
    for (const f of fields) {
      const v = (body[f] || '').toString();
      if (v) updates.push({ Name: f, Value: v });
    }

    // Always store audit fields
    updates.push({ Name: 'ip_verify', Value: ip });
    updates.push({ Name: 'timestamp_verify', Value: timestamp });

    // Optional: clear token & link after successful submit (keep during test if needed)
    // updates.push({ Name: 'token_verify', Value: '' });
    // updates.push({ Name: 'link_verify', Value: '' });

    if (updates.length === 0) {
      return { statusCode: 400, body: 'No data to update' };
    }

    const put = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: { Authorization: mjAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ Data: updates })
    });
    if (!put.ok) {
      const t = await put.text();
      return { statusCode: 502, body: `Mailjet update failed: ${t}` };
    }

    // Optional: send confirmation email to contact
    // (comment out if not desired)
    /*
    const confirm = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: { Authorization: mjAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Messages: [{
          From: { Email: "noreply@sikuralife.com", Name: "Sikura Life" },
          To: [{ Email: email }],
          Subject: "Bestätigung erhalten",
          HTMLPart: "<p>Danke, Ihre Adressdaten wurden aktualisiert.</p>"
        }]
      })
    });
    if (!confirm.ok) {
      // Do not fail the whole flow on mail send issues
      console.warn('Mail send failed:', await confirm.text());
    }
    */

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, testMode: TEST_MODE, email, id })
    };
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
