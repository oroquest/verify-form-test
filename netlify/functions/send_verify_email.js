// netlify/functions/send_verify_email.js
const { Buffer } = require("buffer");

const pickOrigin = (reqOrigin) => {
  try {
    const allowed = new Set([
      "https://verify.sikuralife.com",
      "https://sikuralife.com",
      ...((process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean)),
    ]);
    if (reqOrigin && (allowed.has(reqOrigin) || /netlify\.app$/.test(new URL(reqOrigin).hostname))) return reqOrigin;
    return new URL(process.env.BASE_VERIFY_URL).origin;
  } catch { return "*"; }
};

const cors = (o) => ({
  "Access-Control-Allow-Origin": pickOrigin(o),
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Internal-Key",
  "Vary": "Origin, X-Internal-Key",
});

const fetchX = (...args) => (typeof fetch === "function" ? fetch(...args) : import("node-fetch").then(m => m.default(...args)));

function chooseTemplate(lang, category) {
  const L = (lang || "de").toLowerCase();
  const C = (category === "lawyer" ? "lawyer" : "direct");
  const map = {
    de: { direct: process.env.TEMPLATE_DE_DIRECT,  lawyer: process.env.TEMPLATE_DE_LAWYER  },
    en: { direct: process.env.TEMPLATE_EN_DIRECT,  lawyer: process.env.TEMPLATE_EN_LAWYER  },
    it: { direct: process.env.TEMPLATE_EN_DIRECT,  lawyer: process.env.TEMPLATE_EN_LAWYER  }, // fallback: EN
  };
  const id = (map[L] && map[L][C]) || (map["en"][C]);
  return Number(id || 0);
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || "";
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors(origin) };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors(origin), body: "method not allowed" };

  // Gate: nur intern erlaubt
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

  // 1) Token intern anfordern
  const issueUrl = process.env.URL_ISSUE_TOKEN;
  const issueRes = await fetchX(issueUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": internalKey,
    },
    body: JSON.stringify({ email, id, lang, category }),
  });

  if (!issueRes.ok) {
    const txt = await issueRes.text().catch(() => "");
    return { statusCode: 502, headers: cors(origin), body: `issue_token failed: ${issueRes.status} ${txt}` };
  }
  const { url, token, ttlSec } = await issueRes.json();

  // 2) Mailjet senden (Template + Variablen)
  const mjPub = process.env.MJ_APIKEY_PUBLIC || "";
  const mjPriv = process.env.MJ_APIKEY_PRIVATE || "";
  const fromAddr = process.env.MAIL_FROM_ADDRESS || "";
  const fromName = process.env.MAIL_FROM_NAME || "Sikura Verify";
  const tmpl = chooseTemplate(lang, category);

  if (!tmpl) return { statusCode: 500, headers: cors(origin), body: "missing template id" };

  const auth = "Basic " + Buffer.from(`${mjPub}:${mjPriv}`).toString("base64");
  const mjRes = await fetchX("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: { "Authorization": auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: fromAddr, Name: fromName },
          To: [{ Email: email }],
          TemplateID: tmpl,
          TemplateLanguage: true,
          Variables: {
            verify_link: url,
            email,
            id,
            lang,
            category,
            ttl_hours: Math.round((ttlSec || 0) / 3600)
          }
        }
      ]
    })
  });

  const out = await mjRes.json().catch(() => ({}));
  if (!mjRes.ok || (out.Messages && out.Messages[0] && out.Messages[0].Status !== "success")) {
    return { statusCode: 502, headers: cors(origin), body: `mailjet failed: ${mjRes.status} ${JSON.stringify(out)}` };
  }

  return {
    statusCode: 200,
    headers: { ...cors(origin), "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, emailed: email, url, token: !!token }),
  };
};
