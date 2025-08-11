
// netlify/functions/verify_submit.js
const crypto = require('crypto');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://verify.sikuralife.com';
const VERSION = 'final-2025-08-11-1530Z';

function okHeaders(){
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'X-Function-Version': VERSION,
    'Content-Type': 'application/json'
  };
}

function json(status, obj){
  return { statusCode: status, headers: okHeaders(), body: obj ? JSON.stringify(obj) : '' };
}

function isValidEmail(email){
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  const re = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z](2,)$/i;
  return re.test(email.trim());
}
function isValidTokenFmt(token){
  if (typeof token !== 'string') return false;
  if (token.length !== 43 && token.length !== 44 && token.length !== 64) return false;
  return /^[A-Za-z0-9_-]+$/.test(token) || /^[a-f0-9]{64}$/.test(token);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204);
  if (event.httpMethod === 'GET' && (event.queryStringParameters?.version === 'ping')) {
    return json(200, { ok: true, version: VERSION });
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed', expect: 'POST' });

  let data;
  try { data = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid_json' }); }

  const email = (data.email||'').trim();
  const token = (data.token||'').trim();

  if (!email || !token) return json(400, { error: 'missing_email_or_token', version: VERSION });
  if (!isValidEmail(email) || !isValidTokenFmt(token)) return json(400, { error: 'invalid_email_or_token', version: VERSION });

  const rec = await getVerificationRecord(email);
  if (!rec) return json(404, { error: 'not_found', version: VERSION });
  if (rec.used) return json(410, { error: 'used', version: VERSION });
  if (typeof rec.expiresAt === 'number' && Date.now() > rec.expiresAt) return json(410, { error: 'expired', version: VERSION });

  const providedHashHex = crypto.createHash('sha256').update(token).digest('hex');
  const match = safeEqualHex(providedHashHex, rec.tokenHash);
  if (!match) return json(401, { error: 'wrong_token', version: VERSION });

  await markVerificationUsed(email);
  return json(204);
};

function safeEqualHex(aHex, bHex){
  try {
    const a = Buffer.from(aHex, 'hex'); const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a,b);
  } catch { return false; }
}

// Storage placeholders
async function getVerificationRecord(email){ return null; }
async function markVerificationUsed(email){ return true; }
