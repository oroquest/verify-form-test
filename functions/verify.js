const fetch = require("node-fetch");

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const API_KEY = process.env.GOOGLE_API_KEY;

exports.handler = async function(event) {
  const params = event.queryStringParameters;
  const id = params.id;
  const token = params.token;

  if (!id || !token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Fehlende Parameter." })
    };
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A2:G1000?key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    const rows = data.values;

    const entry = rows.find(row => row[0] === id);

    if (!entry) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "ID nicht gefunden." })
      };
    }

    const [entryId, entryToken, name, adresse, verwendet] = entry;

    if (entryToken !== token) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Token ungültig." })
      };
    }

    if (verwendet && verwendet.toLowerCase() === "ja") {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: "Token wurde bereits verwendet." })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        name,
        adresse
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Serverfehler: " + error.message })
    };
  }
};
