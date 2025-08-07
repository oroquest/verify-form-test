const MJ_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

exports.handler = async (event) => {
  const { id, token } = event.queryStringParameters || {};
  if (!id || !token) return { statusCode: 400, body: 'Fehlender Parameter' };

  try {
    const resp = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(id)}/data`, {
      headers: { 'Authorization': mjAuth }
    });
    if (!resp.ok) { return { statusCode: 500, body: `Mailjet fetch failed: ${await resp.text()}` }; }

    const body = await resp.json();
    const list = body.Data || [];
    const stored = (list.find(d => d.Name === 'token_verify') || {}).Value;

    if (stored !== token) return { statusCode: 401, body: 'Token ungültig oder abgelaufen.' };
    return { statusCode: 200, body: '✔️ E‑Mail erfolgreich verifiziert.' };
  } catch (e) {
    return { statusCode: 500, body: `Fehler beim Prüfen des Tokens: ${e.message}` };
  }
};
