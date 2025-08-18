// netlify/functions/health_env.js
exports.handler = async () => {
  const required = [
    "INTERNAL_VERIFY_KEY",
    "MJ_APIKEY_PUBLIC",
    "MJ_APIKEY_PRIVATE",
    "MAIL_FROM_EMAIL",
    "BASE_VERIFY_URL",
    "MJ_TEMPLATE_VERIFY_STD"
  ];
  const missing = required.filter(k => !process.env[k] || String(process.env[k]).trim()==="");
  const info = {
    ok: missing.length === 0,
    missing,
    // nur minimale Kontextinfo – keine Geheimnisse ausgeben
    baseVerifyUrl: process.env.BASE_VERIFY_URL || null
  };
  return {
    statusCode: missing.length ? 500 : 200,
    body: JSON.stringify(info)
  };
};
