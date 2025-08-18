// netlify/functions/health_env.js
exports.handler = async () => {
  const required = [
    "INTERNAL_VERIFY_KEY",
    "MJ_APIKEY_PUBLIC",
    "MJ_APIKEY_PRIVATE",
    "MAIL_FROM_EMAIL",
    // Für Versand via send_verify_email:
    "URL_ISSUE_TOKEN",
    "TEMPLATE_DE_DIRECT",
    "TEMPLATE_DE_LAWYER",
    "TEMPLATE_EN_DIRECT",
    "TEMPLATE_EN_LAWYER",
  ];

  const missing = required.filter(
    (k) => !process.env[k] || String(process.env[k]).trim() === ""
  );

  return {
    statusCode: missing.length ? 500 : 200,
    body: JSON.stringify({
      ok: missing.length === 0,
      missing,
      baseVerifyUrl: process.env.BASE_VERIFY_URL || null,
      urlIssueToken: process.env.URL_ISSUE_TOKEN || null,
    }),
    headers: { "content-type": "application/json" },
  };
};
