
const fs = require("fs");
const path = require("path");
const tokenDB = require("./tokenDB");

const USED_TOKENS_PATH = path.resolve(__dirname, "used_tokens.json");

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { id, token, email } = body;

    if (!id || !token || !email) {
      return { statusCode: 400, body: "Missing parameters" };
    }

    const entry = tokenDB[id];
    if (!entry || entry.token !== token) {
      return { statusCode: 403, body: "Invalid token or ID" };
    }

    let usedTokens = {};
    if (fs.existsSync(USED_TOKENS_PATH)) {
      usedTokens = JSON.parse(fs.readFileSync(USED_TOKENS_PATH, "utf-8"));
    }

    if (usedTokens[token]) {
      return { statusCode: 410, body: "Token already used" };
    }

    usedTokens[token] = {
      id,
      email,
      used: true,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(USED_TOKENS_PATH, JSON.stringify(usedTokens, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Token used and saved." })
    };

  } catch (err) {
    console.error("Fehler beim Speichern des Tokens:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" })
    };
  }
};
