// netlify/functions/get_contact.js
const MJ_PUBLIC  = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

const INTERNAL_KEY = process.env.GET_CONTACT_INTERNAL_KEY || ""; // Server-zu-Server-Schlüssel
const REQUIRE_AUTH = true; // ohne internen Key müssen id+token geprüft werden

const ALLOW_ORIGINS = new Set([
  'https://verify.sikuralife.com',
  'https://sikuralife.com'
]);

function pickOrigin(o){ return ALLOW_ORIGINS.has(o||'') ? o : 'https://verify.sikuralife.com'; }
function cors(origin='https://verify.sikuralife.com') {
  return {
    'Access-Control-Allow-Origin': pickOrigin(origin),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Internal-Key',
    'Vary': 'Origin, X-Internal-Key, Referer'
  };
}

function hasInternalAuth(headers) {
  const h = headers || {};
  const k = h['x-internal-key'] || h['X-Internal-Key'];
  return Boolean(INTERNAL_KEY && k && k === INTERNAL_KEY);
}

// Base64URL -> UTF-8
function b64urlDecode(input) {
  if (!input) return '';
  let s = String(input).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  try { return Buffer.from(s, 'base64').toString('utf8'); } catch { return ''; }
}

// Query-Param aus URL-String lesen
function queryFromUrl(url, key) {
  try { return new URL(url).searchParams.get(key) || ''; }
  catch { return ''; }
}

// ===== optional hilfreiche Picker (unverändert falls schon vorhanden) =====
function pickProp(obj, candidates) {
  if (!obj) return '';
  for (const k of candidates) if (obj[k] != null && obj[k] !== '') return String(obj[k]);
  const keys = Object.keys(obj||{});
  for (const k of candidates) {
    const f = keys.find(kk => kk.toLowerCase() === String(k).toLowerCase());
    if (f && obj[f] != null && obj[f] !== '') return String(obj[f]);
  }
  return '';
}
const normNum = (x) => String(x || '').replace(/\D/g, '').replace(/^0+/, '');
// ==========================================================================

exports.handler = async (event) => {
  const hdrs    = event.headers || {};
  const hdrOrg  = hdrs.origin || hdrs.Origin || '';
  const hdrRef  = hdrs.referer || hdrs.Referer || '';
  // **NEU**: Origin aus Referer ableiten, falls kein Origin-Header gesendet wurde
  const inferredOrigin = hdrOrg || (hdrRef ? (() => { try { return new URL(hdrRef).origin; } catch { return ''; } })() : '');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(inferredOrigin), body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: cors(inferredOrigin), body: 'Method Not Allowed' };
  }

  // Public nur für erlaubte Origins (oder mit internem Key)
  const internalOK = hasInternalAuth(hdrs);
  const originOK   = ALLOW_ORIGINS.has(inferredOrigin || '');
  if (!internalOK && !originOK) {
    return { statusCode: 403, headers: cors(inferredOrigin), body: 'forbidden' };
  }

  const p = event.queryStringParameters || {};

  // Email: ?email=... | ?em=... | Referer
  let email = String(p.email || '').trim().toLowerCase();
  if (!email && p.em) email = b64urlDecode(String(p.em)).trim().toLowerCase();
  if (!email && hdrRef) {
    const emRef = queryFromUrl(hdrRef, 'em');
    const emailRef = queryFromUrl(hdrRef, 'email');
    if (emRef) email = b64urlDecode(emRef).trim().toLowerCase();
    else if (emailRef) email = emailRef.trim().toLowerCase();
  }

  // Token: ?token=... | Referer
  let token = String(p.token || '').trim();
  if (!token && hdrRef) token = queryFromUrl(hdrRef, 'token') || '';

  // Gläubiger-ID: direkt | Referer
  let credId = String(p.glaeubiger || p['gläubiger'] || p.cid || p.idnum || '').trim();
  if (!credId && p.id) credId = String(p.id).trim();
  if (!credId && hdrRef) credId = queryFromUrl(hdrRef, 'id') || '';

  if (!email) {
    return { statusCode: 400, headers: cors(inferredOrigin), body: 'missing email' };
  }

  try {
    // Kontakt laden
    const r = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      headers: { Authorization: mjAuth }
    });
    if (!r.ok) {
      const t = await r.text();
      return { statusCode: 502, headers: cors(inferredOrigin), body: `Mailjet fetch failed: ${t}` };
    }
    const json = await r.json();
    const props = Object.fromEntries((json.Data?.[0]?.Data || []).map(pp => [pp.Name, pp.Value]));

    // Autorisierung: interner Header ODER (id+token) prüfen
    let authorized = false;

    if (internalOK) {
      authorized = true; // server-zu-Server (z. B. send_verify_email)
    } else if (REQUIRE_AUTH && token) {
      const propToken = pickProp(props, ['token_verify','Token_verify','TOKEN_VERIFY']);
      const propCred  = pickProp(props, ['gläubiger','glaeubiger','Glaeubiger','GlaeubigerID','CreditorId','CreditorID']);

      // Ablauf prüfen (falls vorhanden)
      const expiryRaw = pickProp(props, ['Token_verify_expiry','token_verify_expiry','token_expiry','TokenExpiry']);
      if (expiryRaw) {
        const exp = new Date(expiryRaw);
        if (isFinite(exp) && exp < new Date()) {
          return { statusCode: 410, headers: cors(inferredOrigin), body: 'Token expired' };
        }
      }

      if (propToken && propToken === token) {
        if (!credId || normNum(credId) === normNum(propCred)) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return { statusCode: 403, headers: cors(inferredOrigin), body: 'auth required' };
    }

    // Daten fürs Frontend
    const data = {
      glaeubiger: pickProp(props, ['gläubiger','glaeubiger','Glaeubiger','CreditorId','CreditorID']) || '',
      firstname:  pickProp(props, ['firstname','FirstName','Vorname','vorname']) || '',
      name:       pickProp(props, ['name','Name','Nachname','nachname','LastName','lastname']) || '',
      strasse:    pickProp(props, ['strasse','straße','Strasse','Straße','Street']) || '',
      hausnummer: pickProp(props, ['hausnummer','Hausnummer','hnr','Hnr','HouseNumber']) || '',
      plz:        pickProp(props, ['plz','PLZ','zip','Zip','PostalCode','postalcode']) || '',
      ort:        pickProp(props, ['ort','Ort','city','City']) || '',
      country:    pickProp(props, ['country','Country','Land','land']) || ''
    };

    return {
      statusCode: 200,
      headers: { ...cors(inferredOrigin), 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 500, headers: cors(inferredOrigin), body: 'server error: ' + e.message };
  }
};
