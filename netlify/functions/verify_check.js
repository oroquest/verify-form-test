const mailjet = require('node-mailjet').connect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);

exports.handler = async (event) => {
  const { id, token } = event.queryStringParameters;

  if (!id || !token) {
    return {
      statusCode: 400,
      body: 'Fehlender Parameter'
    };
  }

  try {
    const result = await mailjet
      .get('contactdata', { version: 'v3' })
      .id(id)
      .action('data')
      .request();

    const data = result.body.Data || [];
    const storedToken = data.find(d => d.Name === 'token_verify')?.Value;

    if (storedToken !== token) {
      return {
        statusCode: 401,
        body: 'Token ungültig oder abgelaufen.'
      };
    }

    return {
      statusCode: 200,
      body: `✔️ E-Mail erfolgreich verifiziert.`
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: 'Fehler beim Prüfen des Tokens.'
    };
  }
};