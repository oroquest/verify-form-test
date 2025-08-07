
// verify.js – erweitert mit Einmal-Nutzungsschutz
const tokenDB = require("./tokenDB");
const fs = require("fs");
const path = require("path");

const USED_TOKENS_PATH = path.resolve(__dirname, "used_tokens.json");

exports.handler = async function(event, context) {
  const { id, token } = event.queryStringParameters || {};

  if (!id || !token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing ID or token." })
    };
  }

  const entry = tokenDB[id];
  if (!entry || entry.token !== token) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Invalid token or ID." })
    };
  }

  // Prüfen, ob der Token bereits verwendet wurde
  let usedTokens = {};
  if (fs.existsSync(USED_TOKENS_PATH)) {
    usedTokens = JSON.parse(fs.readFileSync(USED_TOKENS_PATH, "utf-8"));
  }

  if (usedTokens[token]) {
    return {
      statusCode: 410,
      body: JSON.stringify({ error: "Token has already been used." })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      name: entry.name,
      adresse: entry.adresse
    })
  };
};
