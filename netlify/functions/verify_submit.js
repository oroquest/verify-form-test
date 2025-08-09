// netlify/functions/verify_submit.js
const MJ_PUBLIC  = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

// Feature-Toggles
const ENFORCE_EXPIRY     = true;   // Token muss vor Ablauf genutzt werden
const ENFORCE_SINGLE_USE = true;   // Token darf nur 1x genutzt werden

function parseFormBody(event) {
  const ct = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
  if (ct.includes('application/json')) {
    try { return JSON.parse(event.body || '{}'); } catch { return {}; }
  }
  try {
    const params = new URLSearchParams(event.body || '');
    const obj = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    return obj;
  } catch { return {}; }
}

function b64urlDecode(input) {
  if (!input) return '';
  let s = String(input).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  try { return Buffer.from(s, 'base64').toString('utf8'); } catch { return ''; }
}

function firstIpFromHeader(xff) {
  if (!xff) return '';
  return String(xff).split(',')[0].trim();
}

function sanitizeUA(ua) {
  return String(ua || '').replace(/[\u0000-\u001F]+/g, '').trim().slice(0, 255);
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

  // Request-Metadaten
  const H = event.headers || {};
  const userAgent = sanitizeUA(H['user-agent'] || H['User-Agent'] || '');
  const ip =
    firstIpFromHeader(H['x-forwarded-for'] || H['X-Forwarded-For']) ||
    H['x-nf-client-connection-ip'] || H['client-ip'] || H['x-real-ip'] || 'unknown';
  const nowISO = new Date().toISOString();

  try {
    // 1) Mailjet Contact-Properties holen
    const r = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      headers: { Authorization: mjAuth }
    });
    if (!r.ok) {
      const t = await r.text();
      return { statusCode: 502, body: `Mailjet fetch failed: ${t}` };
    }
    const json = await r.json();
    const propsArray = json.Data?.[0]?.Data || [];
    const props = Object.fromEntries(propsArray.map(p => [p.Name, p.Value]));

    // 2) Pflicht-Validierungen
    const glaeubigerVal = (props['gläubiger'] ?? props['glaeubiger'] ?? '').toString().trim();
    const tokenVerify   = (props['token_verify'] || '').toString().trim();

    if (glaeubigerVal !== String(id).trim()) {
      return { statusCode: 403, body: 'ID mismatch' };
    }
    if (!tokenVerify || tokenVerify !== token) {
      return { statusCode: 403, body: 'Invalid token' };
    }

    // 3) One-Time-Use prüfen (NEU: token_verify_used_at)
    const tokenUsedAt = (props['token_verify_used_at'] || '').toString().trim();
    if (ENFORCE_SINGLE_USE && tokenUsedAt) {
      return { statusCode: 409, body: 'Token already used' };
    }

    // 4) Ablauf prüfen (primär "Token_verify_expiry", sonst Fallbacks)
    const expiryRaw =
      props['Token_verify_expiry'] ||   // dein neues Feld (Groß-T)
      props['token_verify_expiry'] ||   // evtl. alte Schreibweise
      props['token_expiry'] ||          // ganz altes Feld
      '';

    if (ENFORCE_EXPIRY && expiryRaw) {
      const exp = new Date(expiryRaw);
      if (isFinite(exp) && exp < new Date()) {
        return { statusCode: 410, body: 'Token expired' };
      }
    }

    // 5) Updates vorbereiten
    const updates = [];
    const setIf = (Name, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') updates.push({ Name, Value: String(v) }); };
    const set    = (Name, v) => { updates.push({ Name, Value: String(v ?? '') }); };

    // Adressfelder: nur befüllte Felder überschreiben
    setIf('firstname',  firstname);
    setIf('name',       name);
    setIf('strasse',    strasse);
    setIf('hausnummer', hausnummer);
    setIf('plz',        plz);
    setIf('ort',        ort);
    setIf('country',    country);

    // Audit (IP, Timestamp, User-Agent)
    setIf('ip_verify',        ip);
    setIf('timestamp_verify', nowISO);
    setIf('agent_verify',     userAgent);

    // One-Time-Use markieren & Token/Ablauf leeren
    set('token_verify_used_at', nowISO); // <— neue Feldbezeichnung
    set('token_verify',  '');            // Token entfernen
    set('Token_verify_expiry', '');      // Ablauf entfernen (neue Schreibweise)

    if (updates.length === 0) {
      return { statusCode: 302, headers: { Location: 'https://verify.sikuralife.com/danke.html' }, body: '' };
    }

    // 6) Mailjet-Update
    const put = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: { Authorization: mjAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ Data: updates })
    });
    if (!put.ok) {
      const t = await put.text();
      return { statusCode: 502, body: `Mailjet update failed: ${t}` };
    }

    // 7) Erfolg → Danke
    return {
      statusCode: 302,
      headers: { Location: 'https://verify.sikuralife.com/danke.html' },
      body: ''
    };

  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
