const mailjet = require('node-mailjet').connect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);
const crypto = require('crypto');
const querystring = require('querystring');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try {
    if (event.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      data = querystring.parse(event.body);
    } else {
      data = JSON.parse(event.body);
    }
  } catch {
    return { statusCode: 400, body: 'Invalid form data' };
  }

  const email = data.email?.trim();
  const adresse = data.adresse?.trim();
  const ip = event.headers['x-nf-client-connection-ip'] || 'unknown';
  const timestamp = new Date().toISOString();
  const token = crypto.randomBytes(8).toString('hex');
  const link = `https://deine-domain.ch/.netlify/functions/verify_check?id=${encodeURIComponent(email)}&token=${token}`;

  if (!email || !adresse) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  try {
    await mailjet
      .post('contactdata', { version: 'v3' })
      .id(email)
      .action('data')
      .request({
        Data: [
          { Name: 'adresse_verify', Value: adresse },
          { Name: 'email_verify', Value: email },
          { Name: 'ip_verify', Value: ip },
          { Name: 'timestamp_verify', Value: timestamp },
          { Name: 'token_verify', Value: token },
          { Name: 'link_verify', Value: link }
        ]
      });

    await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: { Email: "deine@domain.ch", Name: "Vision Flow" },
            To: [{ Email: email }],
            Subject: "Bitte bestätige deine E-Mail",
            HTMLPart: `<p>Hallo,</p><p>Bitte bestätige deine Adresse über folgenden Link:</p><p><a href="${link}">${link}</a></p>`
          }
        ]
      });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Verifizierungslink gesendet.' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Mailjet update failed', details: err.message })
    };
  }
};