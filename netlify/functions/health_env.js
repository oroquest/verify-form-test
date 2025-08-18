// netlify/functions/health_env.js
const required = [
  "BASE_VERIFY_URL",
  "URL_ISSUE_TOKEN",
  "MAIL_FROM_ADDRESS",
  "MAIL_FROM_NAME",
  "MJ_APIKEY_PUBLIC",
  "MJ_APIKEY_PRIVATE",
  "INTERNAL_VERIFY_KEY",
  "TEMPLATE_DE_DIRECT",
  "TEMPLATE_DE_LAWYER",
  "TEMPLATE_EN_DIRECT",
  "TEMPLATE_EN_LAWYER",
];

const ok = (origin) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Internal-Key",
  "Vary": "Origin",
});

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: ok(event.headers.origin) };

  const present = {};
  const missing = [];
  for (const k of required) {
    const v = process.env[k];
    const isSet = typeof v === "string" && v.trim() !== "";
    present[k] = !!isSet;
    if (!isSet) missing.push(k);
  }

  return {
    statusCode: missing.length ? 500 : 200,
    headers: ok(event.headers.origin),
    body: JSON.stringify({
      ok: missing.length === 0,
      missing,
      present,
      note: "Secrets werden nicht offengelegt; true/false zeigt nur die Existenz.",
    }),
  };
};
