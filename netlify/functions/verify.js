// netlify/functions/verify.js
// Disabled in production. Test mapping endpoint removed.
exports.handler = async () => ({ statusCode: 410, body: "gone" });
