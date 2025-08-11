// netlify/functions/get_contact.js
const MJ_PUBLIC  = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

// Feature flag: in TEST mode we do NOT block on expiry/used; in prod (= '0') we enforce them.
const VERIFY_TEST_MODE = (process.env.VERIFY_TEST_MODE ?? '0') === '1';

// Simple CORS helper (kept liberal to avoid breaking)
function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}

const isValidEmail = (s) => /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(s||''));
const isValidToken = (s) => /^[A-Za-z0-9\-_]{8,128}$/.test(String(s||''));

function timingSafeEqual(a, b) {
  const A = Buffer.from(String(a||''), 'utf8');
  const B = Buffer.from(String(b||''), 'utf8');
  if (A.length !== B.length) return false;
  return require('crypto').timingSafeEqual(A, B);
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '*';
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(origin), body: '' };
  }

  try {
    const qs = event.queryStringParameters || {};
    const email = (qs.email || '').trim();
    const token = (qs.token || '').trim();   // NEW: token required
    const id    = (qs.id || '').trim();      // optional

    if (!isValidEmail(email) || !isValidToken(token)) {
      return { statusCode: 400, headers: cors(origin), body: 'bad request' };
    }

    // Fetch contact via Mailjet Contact/Properties API
    const contactResp = await fetch(`https://api.mailjet.com/v3/REST/contact/${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: { Authorization: mjAuth }
    });
    if (!contactResp.ok) {
      return { statusCode: 404, headers: cors(origin), body: 'not found' };
    }
    const contactJson = await contactResp.json();
    const contactId = contactJson.Data && contactJson.Data[0] && contactJson.Data[0].ID;
    if (!contactId) {
      return { statusCode: 404, headers: cors(origin), body: 'not found' };
    }

    const propsResp = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${contactId}`, {
      method: 'GET',
      headers: { Authorization: mjAuth }
    });
    if (!propsResp.ok) {
      return { statusCode: 502, headers: cors(origin), body: 'upstream error' };
    }
    const propsJson = await propsResp.json();
    const rows = propsJson.Data || [];
    const dataList = rows[0]?.Data || [];
    const props = Object.fromEntries(dataList.map(d => [d.Name, d.Value]));

    // === Security checks bound to the data endpoint ===
    const tokenVerify = props['token_verify'] || props['Token_verify'] || '';
    if (!timingSafeEqual(tokenVerify, token)) {
      return { statusCode: 403, headers: cors(origin), body: 'forbidden' };
    }

    // Optional checks (enforced only if not TEST mode)
    if (!VERIFY_TEST_MODE) {
      const used = String(props['token_used'] || '').trim();
      if (used === '1' || used.toLowerCase() === 'true') {
        return { statusCode: 409, headers: cors(origin), body: 'used' };
      }
      const expiryRaw =
        props['Token_verify_expiry'] ||
        props['token_verify_expiry'] ||
        props['token_expiry'] ||
        '';
      if (expiryRaw) {
        const exp = new Date(expiryRaw);
        if (isFinite(exp) && exp < new Date()) {
          return { statusCode: 410, headers: cors(origin), body: 'expired' };
        }
      }
    }

    // Optional: if an id is present, match with creditor_id
    if (id) {
      const creditor = String(props['creditor_id'] || props['glaeubiger'] || props['Glaeubiger'] || '').trim();
      if (creditor && String(creditor) !== String(id)) {
        // Do not leak details
        return { statusCode: 403, headers: cors(origin), body: 'forbidden' };
      }
    }

    // Map the fields we need to return to the form
    const data = {
      glaeubiger: props['glaeubiger'] ?? props['Glaeubiger'] ?? props['creditor_id'] ?? '',
      firstname:  props['firstname']  ?? props['Firstname']  ?? props['first_name'] ?? '',
      name:       props['name']       ?? props['Name']       ?? props['last_name']  ?? '',
      strasse:    props['strasse']    ?? props['Strasse']    ?? props['street']     ?? '',
      hausnummer: props['hausnummer'] ?? props['Hausnummer'] ?? '',
      plz:        props['plz']        ?? props['PLZ']        ?? props['zip']        ?? '',
      ort:        props['ort']        ?? props['Ort']        ?? props['city']       ?? '',
      country:    props['country']    ?? props['Country']    ?? ''
    };

    return {
      statusCode: 200,
      headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 500, headers: cors((event.headers && (event.headers.origin || event.headers.Origin)) || '*'), body: 'server error' };
  }
};
