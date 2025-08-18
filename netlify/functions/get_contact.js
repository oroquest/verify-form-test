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

// Robuste Property-Suche + ID-Normalisierung
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

exports.handler = async (event) => {
  const hdrs   = event.headers || {};
  const oHdr   = hdrs.origin || hdrs.Origin || '';
  const rHdr   = hdrs.referer || hdrs.Referer || '';
  // ✅ NEU: wenn Origin/Referer fehlen → aus Host + Proto ableiten
  const proto  = (hdrs['x-forwarded-proto'] || hdrs['X-Forwarded-Proto'] || 'https').split(',')[0].trim();
  const host   = hdrs.host || hdrs.Host || '';
  const fromRef= (() => { try { return rHdr ? new URL(rHdr).origin : ''; } catch { return ''; } })();
  const reqOrigin = oHdr || fromRef || (host ? `${proto}://${host}` : '');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(reqOrigin), body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: cors(reqOrigin), body: 'Method Not Allowed' };
  }

  // Public nur für erlaubte Origins (oder mit internem Key)
  const internalOK = hasInternalAuth(hdrs);
  const originOK   = ALLOW_ORIGINS.has(reqOrigin || '');
  if (!internalOK && !originOK) {
    return { statusCode: 403, headers: cors(reqOrigin), body: 'forbidden' };
  }

  const p = event.queryStringParameters || {};

  // Email: ?email=... | ?em=... | Referer
  let email = String(p.email || '').trim().toLowerCase();
  if (!email && p.em) email = b64urlDecode(String(p.em)).trim().toLowerCase();
  if (!email && rHdr) {
    const emRef = queryFromUrl(rHdr, 'em');
    const emailRef = queryFromUrl(rHdr, 'email');
    if (emRef) email = b64urlDecode(emRef).trim().toLowerCase();
    else if (emailRef) email = emailRef.trim().toLowerCase();
  }

  // Token: ?token=... | Referer
  let token = String(p.token || '').trim();
  if (!token && rHdr) token = queryFromUrl(rHdr, 'token') || '';

  // Gläubiger-ID: direkt | Referer
  let credId = String(p.glaeubiger || p['gläubiger'] || p.cid || p.idnum || '').trim();
  if (!credId && p.id) credId = String(p.id).trim();
  if (!credId && rHdr) credId = queryFromUrl(rHdr, 'id') || '';

  if (!email) {
    return { statusCode: 400, headers: cors(reqOrigin), body: 'missing email' };
  }

  try {
    // Kontakt laden
    const r = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      headers: { Authorization: mjAuth }
    });
    if (!r.ok) {
      const t = await r.text();
      return { statusCode: 502, headers: cors(reqOrigin), body: `Mailjet fetch failed: ${t}` };
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
          return { statusCode: 410, headers: cors(reqOrigin), body: 'Token expired' };
        }
      }

      if (propToken && propToken === token) {
        if (!credId || normNum(credId) === normNum(propCred)) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return { statusCode: 403, headers: cors(reqOrigin), body: 'auth required' };
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
      headers: { ...cors(reqOrigin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 500, headers: cors(reqOrigin), body: 'server error: ' + e.message };
  }
};
