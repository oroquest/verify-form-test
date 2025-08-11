// netlify/functions/get_contact.js

exports.handler = async (event) => {
  try {
    const allowedOrigin = "https://verify.sikuralife.com";

    // CORS Preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: "",
      };
    }

    const params = event.queryStringParameters || {};
    const { id, email } = params;

    if (!id || !email) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
        },
        body: JSON.stringify({ error: "Missing id or email" }),
      };
    }

    // ---- Beispiel-Datenbankzugriff (hier anpassen an deine Datenquelle) ----
    // In deiner echten Funktion kommt hier der Mailjet / DB Call.
    // Dummy-Daten, damit der Code läuft:
    const contact = {
      glaeubiger: id,
      firstname: "Jagdeep",
      name: "Singh",
      strasse: "Via Cave",
      hausnummer: "27",
      plz: "8000",
      ort: "Zürich",
      country: "Schweiz",
    };

    // Falls keine Daten gefunden werden
    if (!contact) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
        },
        body: JSON.stringify({ error: "Contact not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify(contact),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "https://verify.sikuralife.com",
      },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
