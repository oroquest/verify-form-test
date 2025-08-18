// netlify/functions/issue_token.js
const crypto = require("crypto");

const ALLOWED = () => {
  const def = ["https://verify.sikuralife.com", "https://sikuralife.com"];
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return new Set([...def, ...extra]);
};

const pickOrigin = (reqOrigin) => {
  const set = ALLOWED();
  if (reqOrigin && (set.has(reqOrigin) || /netlify\.app$/.test(new URL(reqOrigin).hostname))) return reqOrigin;
  // Fallback: Ursprung von BASE_VERIFY_URL
  try { return new URL(process.env.BASE_VERIFY_URL).origin; } catch { return "*"; }
};

const cors = (o) => ({
  "Access-Control-Allow-Origin": pickOrigin(o),
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Internal-Key",
  "Vary": "Origin, X-Internal-Key",
});

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const sign = (data, secret) =>
  b64url(crypto.createHmac("sha256", secret).update(data).digest());

function makeToken(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = sign(`${header}.${body}`, secret);
  return `${header}.${body}.${sig}`;
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || "";
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors(origin) };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors(origin), body: "method not allowed" };

  const internalKey = process.env.INTERNAL_VERIFY_KEY || "";
  const givenKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"] || "";
  if (!internalKey || givenKey !== internalKey) {
    return { statusCode: 403, headers: cors(origin), body: "auth required" };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: cors(origin), body: "invalid json" }; }

  const email = String(body.email || "").trim().toLowerCase();
  const id = String(body.id || "").trim();
  const lang = (String(body.lang || "de").trim().toLowerCase() || "de").slice(0, 2);
  const category = (String(body.category || "direct").trim().toLowerCase() === "lawyer") ? "lawyer" : "direct";

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { statusCode: 400, headers: cors(origin), body: "invalid email" };
  }

  const now = Math.floor(Date.now() / 1000);
  const ttlSec = Number(process.env.TOKEN_TTL_SEC || 48 * 3600); // 48h default
  const payload = {
    sub: email,
    id,
    lang,
    cat: category,
    iat: now,
    exp: now + ttlSec,
    rnd: crypto.randomBytes(8).toString("hex"),
  };

  const token = makeToken(payload, internalKey);
  const base = process.env.BASE_VERIFY_URL || "";
  const path = process.env.VERIFY_PATH || "/verify.html";
  const url = `${base.replace(/\/$/, "")}${path}?token=${encodeURIComponent(token)}`;

  return {
    statusCode: 200,
    headers: { ...cors(origin), "Content-Type": "application/json" },
    body: JSON.stringify({ token, url, ttlSec }),
  };
};
