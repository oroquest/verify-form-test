// netlify/functions/verify_submit.js
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://verify.sikuralife.com';
const STORE_NAME = process.env.VERIFY_STORE || 'verify-tokens';

function isValidEmail(email){
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  const re = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return re.test(email.trim());
}
function isValidTokenFmt(token){
  if (typeof token !== 'string') return false;
  if (token.length !== 43 && token.length !== 44 && token.length !== 64) return false;
  return /^[A-Za-z0-9_-]+$/.test(token) || /^[a-f0-9]{64}$/.test(token);
}
function timingSafeEqualHex(aHex, bHex){
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a,b);
  } catch(e) { return false; }
}
function okHeaders(){
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Function-Version': 'final-2025-08-11-1630Z'
  };
}
function json(status, obj){
  return { statusCode: status, headers: okHeaders(), body: JSON.stringify(obj) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod === 'GET' && event.queryStringParameters && event.queryStringParameters.version==='ping') {
    return json(200, { ok:true, version: 'final-2025-08-11-1630Z' });
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  let data;
  try { data = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'invalid_json', version: 'final-2025-08-11-1630Z' }); }

  const email = (data.email || '').trim();
  const token = (data.token || '').trim();

  if (!isValidEmail(email) || !isValidTokenFmt(token)) {
    return json(400, { error: 'invalid_email_or_token', version: 'final-2025-08-11-1630Z' });
  }

  const store = getStore(STORE_NAME);
  const rec = await store.get(email, { type: 'json' });
  if (!rec) return json(404, { error: 'not_found', version: 'final-2025-08-11-1630Z' });
  if (rec.used) return json(410, { error: 'used', version: 'final-2025-08-11-1630Z' });
  if (typeof rec.expiresAt === 'number' && Date.now() > rec.expiresAt) return json(410, { error: 'expired', version: 'final-2025-08-11-1630Z' });

  const providedHashHex = crypto.createHash('sha256').update(token).digest('hex');
  if (!timingSafeEqualHex(providedHashHex, rec.tokenHash)) {
    return json(401, { error: 'invalid_token', version: 'final-2025-08-11-1630Z' });
  }

  rec.used = true;
  await store.set(email, rec, { type: 'json' });
  return json(204, {});
};
