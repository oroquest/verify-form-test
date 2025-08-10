// netlify/functions/show_env.js
exports.handler = async () => {
  const pick = (k) => (process.env[k] ?? '(not set)');
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      TEMPLATE_DE_DIRECT: pick('TEMPLATE_DE_DIRECT'),
      TEMPLATE_DE_LAWYER: pick('TEMPLATE_DE_LAWYER'),
      TEMPLATE_EN_DIRECT: pick('TEMPLATE_EN_DIRECT'),
      TEMPLATE_EN_LAWYER: pick('TEMPLATE_EN_LAWYER'),
      TEMPLATE_IT_DIRECT: pick('TEMPLATE_IT_DIRECT'),
      TEMPLATE_IT_LAWYER: pick('TEMPLATE_IT_LAWYER'),
      MAIL_FROM_ADDRESS:  pick('MAIL_FROM_ADDRESS'),
      MAIL_FROM_NAME:     pick('MAIL_FROM_NAME'),
      URL_ISSUE_TOKEN:    pick('URL_ISSUE_TOKEN')
    }, null, 2)
  };
};
