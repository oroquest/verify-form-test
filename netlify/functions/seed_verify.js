// netlify/functions/seed_verify.js
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const STORE_NAME = process.env.VERIFY_STORE || 'verify-tokens';
const ADMIN_SECRET = process.env.ADMIN_SEED_SECRET;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  if (!ADMIN_SECRET || event.headers['x-admin-secret'] !== ADMIN_SECRET) return { statusCode: 401 };

  let data;
  try { data = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'invalid_json' }; }
  const { email, token, ttlMinutes = 30 } = data;
  if (!email || !token) return { statusCode: 400, body: 'missing email/token' };

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  const store = getStore(STORE_NAME);
  await store.set(email, { tokenHash, expiresAt, used: false }, { type: 'json' });

  return { statusCode: 200, body: JSON.stringify({ ok: true, email, tokenHash, expiresAt }) };
};
