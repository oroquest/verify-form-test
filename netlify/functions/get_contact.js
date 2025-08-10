// netlify/functions/get_contact.js
const MJ_PUBLIC  = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

function cors() {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: cors(), body: 'Method Not Allowed' };
  }

  const p = event.queryStringParameters || {};
  const email = String(p.email || p.id || '').trim().toLowerCase();
  if (!email) return { statusCode: 400, headers: cors(), body: 'missing email' };

  try {
    const r = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      headers: { Authorization: mjAuth }
    });
    if (!r.ok) {
      const t = await r.text();
      return { statusCode: 502, headers: cors(), body: `Mailjet fetch failed: ${t}` };
    }
    const json = await r.json();
    const props = Object.fromEntries((json.Data?.[0]?.Data || []).map(p => [p.Name, p.Value]));

    // Map für dein Frontend (inkl. Umlaute/glaeubiger-Fallback)
    const data = {
      glaeubiger: props['gläubiger'] ?? props['glaeubiger'] ?? '',
      firstname:  props['firstname']  ?? '',
      name:       props['name']       ?? '',
      strasse:    props['strasse']    ?? '',
      hausnummer: props['hausnummer'] ?? '',
      plz:        props['plz']        ?? '',
      ort:        props['ort']        ?? '',
      country:    props['country']    ?? ''
    };

    return { statusCode: 200, headers: { ...cors(origin),  ...cors(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 500, headers: cors(), body: 'server error: ' + e.message };
  }
};
