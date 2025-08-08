const MJ_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

/**
 * GET /.netlify/functions/get_contact?id=<email>
 * Antwort: { glaeubiger, firstname, name, strasse, hausnummer, plz, ort, country, email }
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const email = (event.queryStringParameters?.id || '').trim();
  if (!email) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing id (email)' }) };
  }

  try {
    const resp = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
      headers: { Authorization: mjAuth }
    });

    if (resp.status === 404) {
      return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Contact not found' }) };
    }

    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Mailjet error', details: t }) };
    }

    const body = await resp.json();
    const arr = body.Data || [];
    const list = arr[0]?.Data || [];

    // Map Name->Value
    const obj = {};
    for (const item of list) {
      obj[item.Name] = item.Value;
    }

    // Support both "glaeubiger" and "glaeubiger_nr"
    const glaeubiger = obj.glaeubiger ?? obj.glaeubiger_nr ?? '';

    const out = {
      glaeubiger,
      firstname: obj.firstname ?? '',
      name: obj.name ?? '',
      strasse: obj.strasse ?? '',
      hausnummer: obj.hausnummer ?? '',
      plz: obj.plz ?? '',
      ort: obj.ort ?? '',
      country: obj.country ?? '',
      email
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(out)
    };
  } catch (e) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Server error', message: e.message }) };
  }
};
