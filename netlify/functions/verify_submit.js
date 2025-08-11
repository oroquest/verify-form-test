// netlify/functions/verify_submit.js — Mailjet storage (lowercase property names)
const crypto = require('crypto');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://verify.sikuralife.com';
const ADMIN_SEED_SECRET = process.env.ADMIN_SEED_SECRET || null;
const MJ_KEY = process.env.MJ_APIKEY_PUBLIC;
const MJ_SECRET = process.env.MJ_APIKEY_PRIVATE;
const MJ_BASE = 'https://api.mailjet.com/v3/REST';

function okHeaders(extra = {}) {
  return Object.assign({
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type,x-admin-secret',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Function-Version': 'final-2025-08-11-v4-mailjet-lowercase'
  }, extra);
}
const json = (s, b) => ({ statusCode: s, headers: okHeaders(), body: JSON.stringify(b || {}) });

function isValidEmail(e){ return typeof e==='string' && e.length<=254 && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(e.trim()); }
function isValidTokenFmt(t){
  if (typeof t!=='string') return false;
  if (t.length===64 && /^[a-f0-9]{64}$/.test(t)) return true;
  if ((t.length===43||t.length===44) && /^[A-Za-z0-9_-]+$/.test(t)) return true;
  return false;
}
function timingSafeEqualHex(aHex, bHex){
  try{ const a=Buffer.from(aHex,'hex'); const b=Buffer.from(bHex,'hex'); if(a.length!==b.length) return false; return crypto.timingSafeEqual(a,b); }
  catch{ return false; }
}
function b64(key, secret){ return Buffer.from(`${key}:${secret}`).toString('base64'); }

async function mjGET(path){
  const r = await fetch(`${MJ_BASE}${path}`, { headers: { Authorization: `Basic ${b64(MJ_KEY,MJ_SECRET)}` } });
  const t = await r.text(); const j = t ? JSON.parse(t) : {};
  if (!r.ok) throw new Error(`Mailjet GET ${path} ${r.status}: ${t}`);
  return j;
}
async function mjPOST(path, body){
  const r = await fetch(`${MJ_BASE}${path}`, {
    method:'POST',
    headers: { Authorization: `Basic ${b64(MJ_KEY,MJ_SECRET)}`, 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  const t = await r.text(); const j = t ? JSON.parse(t) : {};
  if (!r.ok) throw new Error(`Mailjet POST ${path} ${r.status}: ${t}`);
  return j;
}
async function mjPUT(path, body){
  const r = await fetch(`${MJ_BASE}${path}`, {
    method:'PUT',
    headers: { Authorization: `Basic ${b64(MJ_KEY,MJ_SECRET)}`, 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  const t = await r.text(); const j = t ? JSON.parse(t) : {};
  if (!r.ok) throw new Error(`Mailjet PUT ${path} ${r.status}: ${t}`);
  return j;
}

// ---- Deine Mailjet-Felder (lowercase) ----
// token_verify (str), token_verify_expiry (datetime ISO), token_verify_used_at (datetime|null)
async function ensureContact(email){
  const found = await mjGET(`/contact?Email=${encodeURIComponent(email)}`);
  if (found?.Count > 0) return found.Data[0].ID;
  const created = await mjPOST('/contact', { Email: email });
  return created?.Data?.[0]?.ID;
}
async function getContactProps(email){
  const list = await mjGET(`/contactdata/${encodeURIComponent(email)}`);
  const map = {};
  for (const item of (list?.Data?.[0]?.Data || [])) map[item.Name] = item.Value;
  return map;
}
async function setContactProps(email, props){
  const Data = Object.entries(props).map(([Name,Value])=>({ Name, Value }));
  await mjPUT(`/contactdata/${encodeURIComponent(email)}`, { Data });
}
const toUtcIso = (ms) => new Date(ms).toISOString();
const fromIsoToMs = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : NaN; };

async function getVerificationRecord(email){
  const p = await getContactProps(email);
  const tokenHash = (p.token_verify ?? p.Token_verify) ? String(p.token_verify ?? p.Token_verify) : null;
  const expiryIso = (p.token_verify_expiry ?? p.Token_verify_expiry) ? String(p.token_verify_expiry ?? p.Token_verify_expiry) : null;
  const usedAtIso = (p.token_verify_used_at ?? p.Token_verify_used_at) ?? null;
  if (!tokenHash || !expiryIso) return null;
  const expiresAt = fromIsoToMs(expiryIso);
  return { tokenHash, expiresAt, used: !!usedAtIso && usedAtIso !== 'null' };
}
async function markVerificationUsed(email){
  await setContactProps(email, { token_verify_used_at: toUtcIso(Date.now()) });
  return true;
}

exports.handler = async (event) => {
  try{
    if (event.httpMethod === 'OPTIONS') return json(204);
    const qs = event.queryStringParameters || {};
    if (event.httpMethod === 'GET' && qs.version==='ping') return json(200, { ok:true, version:'final-2025-08-11-v4-mailjet-lowercase' });

    // --- Admin seed ---
    if (event.httpMethod === 'POST' && qs.action==='seed') {
      if (!ADMIN_SEED_SECRET) return json(500, { error:'missing_admin_secret_env' });
      if (event.headers['x-admin-secret'] !== ADMIN_SEED_SECRET) return json(401, { error:'unauthorized' });
      let data; try { data = JSON.parse(event.body||'{}'); } catch { return json(400, { error:'invalid_json' }); }
      const { email, token, ttlMinutes=60 } = data;
      if (!email || !token) return json(400, { error:'missing email/token' });
      if (!isValidEmail(email)) return json(400, { error:'invalid_email' });
      if (!MJ_KEY || !MJ_SECRET) return json(500, { error:'missing_mailjet_keys' });

      await ensureContact(email);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAtMs = Date.now() + ttlMinutes*60*1000;
      await setContactProps(email, {
        token_verify: tokenHash,
        token_verify_expiry: toUtcIso(expiresAtMs),
        token_verify_used_at: null
      });
      return json(200, { ok:true, email, expiresAt: expiresAtMs });
    }

    // --- Verify ---
    if (event.httpMethod !== 'POST') return json(405, { error:'method_not_allowed' });
    let data; try { data = JSON.parse(event.body||'{}'); } catch { return json(400, { error:'invalid_json' }); }
    const email = (data.email||'').trim();
    const token = (data.token||'').trim();
    if (!isValidEmail(email) || !isValidTokenFmt(token)) return json(400, { error:'invalid_email_or_token' });
    if (!MJ_KEY || !MJ_SECRET) return json(500, { error:'missing_mailjet_keys' });

    const rec = await getVerificationRecord(email);
    if (!rec) return json(404, { error:'not_found' });
    if (rec.used) return json(410, { error:'used' });
    if (typeof rec.expiresAt==='number' && Date.now()>rec.expiresAt) return json(410, { error:'expired' });

    const hashHex = crypto.createHash('sha256').update(token).digest('hex');
    if (!timingSafeEqualHex(hashHex, rec.tokenHash)) return json(401, { error:'invalid_token' });

    await markVerificationUsed(email);
    return { statusCode: 204, headers: okHeaders() };
  }catch(e){
    return { statusCode: 500, headers: okHeaders({'X-Debug':'verify_submit_crash'}), body: JSON.stringify({ error:'crash', message:String(e) }) };
  }
};
