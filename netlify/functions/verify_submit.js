// netlify/functions/verify_submit.js (v4 — includes admin seeding to avoid separate seed function)
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://verify.sikuralife.com';
const STORE_NAME = process.env.VERIFY_STORE || 'verify-tokens';
const ADMIN_SEED_SECRET = process.env.ADMIN_SEED_SECRET || null;

function okHeaders(extra={}){
  return Object.assign({
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type,x-admin-secret',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Function-Version': 'final-2025-08-11-v4'
  }, extra);
}
function json(status, obj){ return { statusCode: status, headers: okHeaders(), body: JSON.stringify(obj) }; }

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

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    const qs = event.queryStringParameters || {};
    if (event.httpMethod === 'GET' && qs.version === 'ping') {
      return json(200, { ok:true, version: 'final-2025-08-11-v4' });
    }

    // --- Admin seed path (POST with ?action=seed + x-admin-secret header) ---
    if (event.httpMethod === 'POST' && qs.action === 'seed') {
      if (!ADMIN_SEED_SECRET) return json(500, { error:'missing_admin_secret_env' });
      if (event.headers['x-admin-secret'] !== ADMIN_SEED_SECRET) return json(401, { error:'unauthorized' });
      let data; try { data = JSON.parse(event.body || '{}'); } catch { return json(400, { error:'invalid_json' }); }
      const { email, token, ttlMinutes = 60 } = data;
      if (!email || !token) return json(400, { error:'missing email/token' });
      if (!isValidEmail(email)) return json(400, { error:'invalid_email' });
      const store = getStore(STORE_NAME);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
      await store.set(email, { tokenHash, expiresAt, used:false }, { type:'json' });
      return json(200, { ok:true, email, expiresAt });
    }

    // --- Normal verify path ---
    if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

    let data;
    try { data = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'invalid_json' }); }

    const email = (data.email||'').trim();
    const token = (data.token||'').trim();

    if (!isValidEmail(email) || !isValidTokenFmt(token)) {
      return json(400, { error: 'invalid_email_or_token' });
    }

    const store = getStore(STORE_NAME);
    const rec = await store.get(email, { type: 'json' });
    if (!rec) return json(404, { error: 'not_found' });
    if (rec.used) return json(410, { error: 'used' });
    if (typeof rec.expiresAt === 'number' && Date.now() > rec.expiresAt) return json(410, { error: 'expired' });

    const providedHashHex = crypto.createHash('sha256').update(token).digest('hex');
    if (!timingSafeEqualHex(providedHashHex, rec.tokenHash)) {
      return json(401, { error: 'invalid_token' });
    }

    rec.used = true;
    await store.set(email, rec, { type: 'json' });
    return { statusCode: 204, headers: okHeaders() };
  } catch (e) {
    return { statusCode: 500, headers: okHeaders({'X-Debug':'verify_submit_crash'}), body: JSON.stringify({ error:'crash', message:String(e) }) };
  }
};
