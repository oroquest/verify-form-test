// netlify/functions/verify_check.js
// Prüft, ob ein Verifizierungs-Token gültig ist (existiert, nicht abgelaufen, nicht verbraucht).
// Hinweis: nutzt das globale fetch (Node 18/20). KEIN node-fetch nötig.

const MJ_BASE = "https://api.mailjet.com/v3/REST";
const { MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE } = process.env;

// Vereinheitlichte Auslese des Ablaufdatums
function normalizeExpiry(props) {
  const keys = ["Token_verify_expiry", "token_verify_expiry", "token_expiry", "Token_expiry"];
  for (const k of keys) if (props && props[k]) return props[k];
  return "";
}

exports.handler = async (event) => {
  try {
    // ---- Input ----
    const qs = event.queryStringParameters || {};
    const lang  = (qs.lang || "de").toLowerCase();
    const token = (qs.token || "").trim();
    const id    = (qs.id || "").trim();     // Kreditoren-ID
    const emB64 = (qs.em || "").trim();     // E-Mail (base64)
    const email = emB64 ? Buffer.from(emB64, "base64").toString("utf8") : "";

    if (!token || !id || !email) {
      return { statusCode: 400, body: "Missing token, id or em" };
    }

    // ---- Mailjet: Contact + Properties laden ----
    const auth = "Basic " + Buffer.from(`${MJ_APIKEY_PUBLIC}:${MJ_APIKEY_PRIVATE}`).toString("base64");

    // 1) Contact per E-Mail
    const r1 = await fetch(`${MJ_BASE}/contact/${encodeURIComponent(email)}`, {
      headers: { Authorization: auth }
    });
    if (!r1.ok) {
      const err = await r1.text();
      return { statusCode: 502, body: `Mailjet contact fetch failed: ${err}` };
    }
    const c = await r1.json();
    const ContactID = c.Data?.[0]?.ID;
    if (!ContactID) return { statusCode: 404, body: "Contact not found" };

    // 2) Contactdata (Properties)
    const r2 = await fetch(`${MJ_BASE}/contactdata/${ContactID}`, {
      headers: { Authorization: auth }
    });
    if (!r2.ok) {
      const err = await r2.text();
      return { statusCode: 502, body: `Mailjet contactdata fetch failed: ${err}` };
    }
    const d = await r2.json();
    const props = {};
    for (const p of (d.Data?.[0]?.Data || [])) props[p.Name] = p.Value;

    // ---- Prüfungen ----
    if ((props["glaeubiger"] || props["Glaeubiger"] || "").toString() !== id.toString()) {
      return { statusCode: 400, body: "ID does not match" };
    }

    const stored = (props["token_verify"] || "").toString();
    if (!stored || stored !== token) {
      return { statusCode: 400, body: "Invalid token" };
    }

    if (props["token_verify_used_at"]) {
      return { statusCode: 409, body: "Token already used" };
    }

    const expiryRaw = normalizeExpiry(props);
    if (expiryRaw) {
      const now = new Date();
      const exp = new Date(expiryRaw);
      if (isFinite(exp) && now > exp) {
        return { statusCode: 410, body: "Token expired" };
      }
    }

    return { statusCode: 200, body: "OK" };

  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
