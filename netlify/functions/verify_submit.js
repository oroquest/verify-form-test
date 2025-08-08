const MJ_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let data;
  try { data = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { id, token, email, vorname, name, strasse, hausnummer, plz, ort, land } = data;
  if (!id || !token || !email) return { statusCode: 400, body: 'Missing required fields' };

  const updateResp = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: { Authorization: mjAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Data: [
        { Name: 'vorname', Value: vorname },
        { Name: 'name', Value: name },
        { Name: 'strasse', Value: strasse },
        { Name: 'hausnummer', Value: hausnummer },
        { Name: 'plz', Value: plz },
        { Name: 'ort', Value: ort },
        { Name: 'land', Value: land }
      ]
    })
  });

  if (!updateResp.ok) {
    const t = await updateResp.text();
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: t }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, email, id }) };
};
