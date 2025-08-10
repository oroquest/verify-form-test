// netlify/functions/send_verify_email.js
const mailjet = require("node-mailjet").apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { email, id, lang, category, name } = JSON.parse(event.body || "{}");
    if (!email || !id) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing email or id" }) };
    }

    // 1) Kontakt holen
    const contactRes = await fetch(
      `${process.env.BASE_VERIFY_URL}/.netlify/functions/get_contact?email=${encodeURIComponent(email)}`
    );
    if (!contactRes.ok) {
      const t = await contactRes.text();
      return { statusCode: 502, body: JSON.stringify({ error: "Failed to get contact", details: t }) };
    }
    const contact = await contactRes.json();
    const firstname  = contact.firstname || "";
    const creditorId = contact.glaeubiger || contact["gläubiger"] || "";
    const ort        = contact.ort || "";
    const country    = contact.country || "";
    const prefLang   = (lang || contact.Sprache || "en").toLowerCase();
    const prefCat    = (category || contact.Category || "").toUpperCase();

    // 2) Token ausstellen
    const tokenRes = await fetch(process.env.URL_ISSUE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, id, lang: prefLang })
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      return { statusCode: 502, body: JSON.stringify({ error: "Failed to issue token", details: t }) };
    }
    const tokenData = await tokenRes.json();
    const verifyUrl = tokenData.url;
    const expiresAt = tokenData.expiresAt;

    // 3) Template-ID wahlen (DE/EN × DIREKT/ANWALT)
    let templateId;
    if (prefLang === "de") {
      templateId = prefCat === "VN ANWALT"
        ? Number(process.env.TEMPLATE_DE_LAWYER)
        : Number(process.env.TEMPLATE_DE_DIRECT);
    } else {
      // Fallback EN (auch für IT)
      templateId = prefCat === "VN ANWALT"
        ? Number(process.env.TEMPLATE_EN_LAWYER)
        : Number(process.env.TEMPLATE_EN_DIRECT);
    }

    // 4) Senden mit TemplateLanguage: true + Variablen
    const sendResp = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [{
        From: { Email: process.env.MAIL_FROM_ADDRESS, Name: process.env.MAIL_FROM_NAME },
        To:   [{ Email: email, Name: name || firstname }],
        TemplateID: templateId,
        TemplateLanguage: true, // << wichtig
        Subject: prefLang === "de" ? "Verifizierung Ihrer Daten" : "Verify your contact details",
        Variables: {
          verify_url:  verifyUrl,
          expires_at:  expiresAt,
          firstname:   firstname,
          creditor_id: creditorId,
          name:        name || "",
          ort:         ort,
          country:     country
        }
      }]
    });

    const status = sendResp?.body?.Messages?.[0]?.Status;
    if (status !== "success") {
      return { statusCode: 502, body: JSON.stringify({ error: "Mailjet send failed", status }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        url: verifyUrl,
        expiresAt,
        lang: prefLang,
        category: prefCat,
        templateId
      })
    };
  } catch (err) {
    console.error("Send verify email error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Server error" }) };
  }
};
