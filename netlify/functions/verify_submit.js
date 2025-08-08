// netlify/functions/verify_submit.js
const MJ_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

// Toggle: Ablauf erzwingen? (nur aktivieren, wenn ihr token_expiry befüllt)
const ENFORCE_EXPIRY = false;

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const data = parseFormBody(event);
  let { id, token, em, email, lang, firstname, name, strasse, hausnummer, plz, ort, country, land } = data;

  // E-Mail aus em rekonstruieren, wenn nötig
  if (!email && em) email = b64urlDecode(em).trim();
  // country vs. land berücksichtigen
  if (!country && land) country = land;

  if (!id || !token || !email) {
    return { statusCode: 400, body: 'Missing required parameters (id/token/email)' };
  }

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown';
  const timestamp = new Date().toISOString();

  try {
    // 1) Kontakt-Properties holen
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

    // 2) Validierung: Gläubiger + Token (+Expiry optional)
    const glaeubigerVal = (props['gläubiger'] ?? props['glaeubiger'] ?? '').toString().trim();
    const tokenVerify   = (props['token_verify'] || '').toString().trim();
    const tokenExpiry   = props['token_expiry'] ? new Date(props['token_expiry']) : null;

    if (glaeubigerVal !== String(id).trim()) {
      return { statusCode: 403, body: 'ID mismatch' };
    }
    if (!tokenVerify || tokenVerify !== token) {
      return { statusCode: 403, body: 'Invalid token' };
    }
    if (ENFORCE_EXPIRY && tokenExpiry && isFinite(tokenExpiry) && tokenExpiry < new Date()) {
      return { statusCode: 410, body: 'Token expired' };
    }

    // 3) Updates vorbereiten (nur befüllte Felder überschreiben)
    const updates = [];
    const setIf = (Name, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') updates.push({ Name, Value: String(v) }); };

    setIf('firstname',  firstname);
    setIf('name',       name);
    setIf('strasse',    strasse);
    setIf('hausnummer', hausnummer);
    setIf('plz',        plz);
    setIf('ort',        ort);
    setIf('country',    country);

    // Audit
    setIf('ip_verify',        ip);
    setIf('timestamp_verify', timestamp);

    if (updates.length === 0) {
      // Nichts zu tun -> trotzdem redirecten (kein Fehler für Nutzer)
      return { statusCode: 302, headers: { Location: 'https://verify.sikuralife.com/danke.html' }, body: '' };
    }

    // 4) Mailjet-Update
    const put = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: { Authorization: mjAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ Data: updates })
    });
    if (!put.ok) {
      const t = await put.text();
      return { statusCode: 502, body: `Mailjet update failed: ${t}` };
    }

    // 5) Erfolg → Redirect auf Danke-Seite
    return {
      statusCode: 302,
      headers: { Location: 'https://verify.sikuralife.com/danke.html' },
      body: ''
    };

  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
