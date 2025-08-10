// netlify/functions/send_verify_email.js
const fetch = require("node-fetch");
const mailjet = require("node-mailjet").apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);

exports.handler = async (event) => {
  try {
    const { email, id, lang, category, name } = JSON.parse(event.body);

    if (!email || !id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing email or id" }),
      };
    }

    // 1. Kontakt abrufen
    const contactRes = await fetch(
      `${process.env.BASE_VERIFY_URL}/.netlify/functions/get_contact?email=${encodeURIComponent(email)}`
    );
    if (!contactRes.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to get contact" }),
      };
    }
    const contact = await contactRes.json();

    const firstname = contact.firstname || "";
    const creditorId = contact.glaeubiger || "";
    const ort = contact.ort || "";
    const country = contact.country || "";

    // 2. Token erstellen
    const tokenRes = await fetch(
      `${process.env.URL_ISSUE_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, id, lang }),
      }
    );
    if (!tokenRes.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to issue token" }),
      };
    }
    const tokenData = await tokenRes.json();

    const verifyUrl = tokenData.url;
    const expiresAt = tokenData.expiresAt;

    // 3. Template-ID abhängig von Sprache + Kategorie wählen
    let templateId;
    const langKey = (lang || contact.Sprache || "en").toLowerCase();
    const catKey = (category || contact.Category || "").toUpperCase();

    if (langKey === "de") {
      templateId =
        catKey === "VN ANWALT"
          ? parseInt(process.env.TEMPLATE_DE_LAWYER)
          : parseInt(process.env.TEMPLATE_DE_DIRECT);
    } else {
      // Fallback EN
      templateId =
        catKey === "VN ANWALT"
          ? parseInt(process.env.TEMPLATE_EN_LAWYER)
          : parseInt(process.env.TEMPLATE_EN_DIRECT);
    }

    // 4. Mail versenden
    const sendRes = await mailjet
      .post("send", { version: "v3.1" })
      .request({
        Messages: [
          {
            From: {
              Email: process.env.MAIL_FROM_ADDRESS,
              Name: process.env.MAIL_FROM_NAME,
            },
            To: [{ Email: email, Name: name || firstname }],
            TemplateID: templateId,
            TemplateLanguage: true, // 🔹 WICHTIG für {{var:...}}
            Variables: {
              verify_url: verifyUrl,
              expires_at: expiresAt,
              firstname: firstname,
              creditor_id: creditorId,
              name: name || "",
              ort: ort,
              country: country,
            },
          },
        ],
      });

    if (sendRes.body.Messages[0].Status !== "success") {
      throw new Error("Mailjet send failed");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        url: verifyUrl,
        expiresAt,
        lang: langKey,
        category: catKey,
        templateId,
      }),
    };
  } catch (err) {
    console.error("Send verify email error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Server error" }),
    };
  }
};
