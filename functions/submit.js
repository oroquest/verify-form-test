const fetch = require("node-fetch");

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const API_KEY = process.env.GOOGLE_API_KEY;

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const body = JSON.parse(event.body);
  const { id, token, email, adresse } = body;

  if (!id || !token || !email || !adresse) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Fehlende Felder." })
    };
  }

  const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A2:G1000?key=${API_KEY}`;
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A2:G1000?valueInputOption=RAW&key=${API_KEY}`;

  try {
    const response = await fetch(sheetUrl);
    const data = await response.json();
    const rows = data.values;

    const rowIndex = rows.findIndex(row => row[0] === id);

    if (rowIndex === -1) {
      return { statusCode: 404, body: JSON.stringify({ error: "ID nicht gefunden." }) };
    }

    const [entryId, entryToken, name, oldAdresse, verwendet] = rows[rowIndex];

    if (entryToken !== token) {
      return { statusCode: 403, body: JSON.stringify({ error: "Ungültiger Token." }) };
    }

    if (verwendet && verwendet.toLowerCase() === "ja") {
      return { statusCode: 409, body: JSON.stringify({ error: "Bereits verwendet." }) };
    }

    const timestamp = new Date().toISOString();
    rows[rowIndex][3] = adresse;   // neue Adresse speichern
    rows[rowIndex][4] = "Ja";      // Verwendet = Ja
    rows[rowIndex][5] = email;     // E-Mail speichern
    rows[rowIndex][6] = timestamp; // Zeitstempel speichern

    const updated = await fetch(updateUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: rows })
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, email, adresse, timestamp })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Serverfehler: " + error.message })
    };
  }
};
