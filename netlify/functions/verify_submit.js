// verify_submit.js - Mailjet angepasste Version

const crypto = require('crypto');
const fetch = require('node-fetch');

const MJ_KEY = process.env.MJ_APIKEY_PUBLIC;
const MJ_SECRET = process.env.MJ_APIKEY_PRIVATE;
const ADMIN_SEED_SECRET = process.env.ADMIN_SEED_SECRET;

// --- Hilfsfunktionen für Mailjet API ---
async function mjGET(path){
  const r = await fetch(`https://api.mailjet.com/v3/REST${path}`, {
    headers: { Authorization: 'Basic ' + Buffer.from(MJ_KEY+':'+MJ_SECRET).toString('base64') }
  });
  return r.json();
}
async function mjPOST(path, body){
  const r = await fetch(`https://api.mailjet.com/v3/REST${path}`, {
    method:'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(MJ_KEY+':'+MJ_SECRET).toString('base64'),
      'Content-Type':'application/json'
    },
    body: JSON.stringify(body)
  });
  return r.json();
}
async function mjPUT(path, body){
  const r = await fetch(`https://api.mailjet.com/v3/REST${path}`, {
    method:'PUT',
    headers: {
      Authorization: 'Basic ' + Buffer.from(MJ_KEY+':'+MJ_SECRET).toString('base64'),
      'Content-Type':'application/json'
    },
    body: JSON.stringify(body)
  });
  return r.json();
}

// --- Storage via Mailjet Contact Properties ---
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
function toUtcIso(ms) { return new Date(ms).toISOString(); }
function fromIsoToMs(iso) { const t = Date.parse(iso); return Number.isFinite(t) ? t : NaN; }

async function getVerificationRecord(email){
  const p = await getContactProps(email);
  const tokenHash = p.Token_verify ? String(p.Token_verify) : null;
  const expiryIso = p.Token_verify_expiry ? String(p.Token_verify_expiry) : null;
  const usedAtIso = p.Token_verify_used_at ? String(p.Token_verify_used_at) : null;
  if (!tokenHash || !expiryIso) return null;
  const expiresAt = fromIsoToMs(expiryIso);
  return { tokenHash, expiresAt, used: !!usedAtIso };
}
async function markVerificationUsed(email){
  await setContactProps(email, { Token_verify_used_at: toUtcIso(Date.now()) });
  return true;
}

// --- Handler ---
exports.handler = async function(event, context) {
  const url = new URL(event.rawUrl || '', 'http://localhost');
  const qs = Object.fromEntries(url.searchParams.entries());

  function json(status,obj){ return { statusCode:status, headers:{'Content-Type':'application/json'}, body:JSON.stringify(obj)}; }
  function isValidEmail(e){ return /^[^@]+@[^@]+\.[^@]+$/.test(e); }
  function okHeaders(){ return { 'Access-Control-Allow-Origin':'https://verify.sikuralife.com' }; }

  // Admin Seed
  if (event.httpMethod === 'POST' && qs.action === 'seed') {
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
      Token_verify: tokenHash,
      Token_verify_expiry: toUtcIso(expiresAtMs),
      Token_verify_used_at: null
    });

    return json(200, { ok:true, email, expiresAt: expiresAtMs });
  }

  // Normal Verify
  if (event.httpMethod === 'POST') {
    let data; try { data = JSON.parse(event.body||'{}'); } catch { return json(400, { error:'invalid_json' }); }
    const { email, token } = data;
    if (!email || !token) return json(400, { error:'missing email/token' });
    if (!isValidEmail(email)) return json(400, { error:'invalid_email' });

    const rec = await getVerificationRecord(email);
    if (!rec) return json(404, { error:'not_found' });
    if (rec.used) return json(410, { error:'already_used' });
    if (Date.now() > rec.expiresAt) return json(410, { error:'expired' });

    const hashHex = crypto.createHash('sha256').update(token).digest('hex');
    if (hashHex !== rec.tokenHash) return json(401, { error:'invalid_token' });

    await markVerificationUsed(email);
    return { statusCode: 204, headers: okHeaders() };
  }

  return { statusCode: 405 };
};
