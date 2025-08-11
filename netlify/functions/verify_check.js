// netlify/functions/verify_check.js
// Prüft, ob ein Verifizierungs-Token gültig ist (existiert, nicht abgelaufen, nicht verbraucht).
// Nutzt globales fetch (Node 18/20). Kein node-fetch nötig.

const MJ_BASE = "https://api.mailjet.com/v3/REST";
const { MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE } = process.env;

// Alias/Normalisierung für Property-Namen (Umlaute, ß, Case)
function aliasKey(name = "") {
  let s = String(name).toLowerCase();
  // explizite deutsche Umlaute/ß -> ASCII
  s = s
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
  // evtl. restliche diakritische Zeichen entfernen (sicherheitsnetz)
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return s;
}

// Vereinheitlichte Auslese des Ablaufdatums
function normalizeExpiry(propsRaw, propsAlias) {
  const keys = [
    "Token_verify_expiry",
    "token_verify_expiry",
    "token_expiry",
    "Token_expiry"
  ];
  for (const k of keys) if (propsRaw && propsRaw[k]) return propsRaw[k];
  // alias-Variante (falls jemand aliasierte Namen verwendet)
  const aliasKeys = keys.map(aliasKey);
  for (const ak of aliasKeys) if (propsAlias && propsAlias[ak]) return propsAlias[ak];
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

    // propsRaw: Original-Namen, propsAlias: normalisierte Aliase (z.B. gläubiger -> glaeubiger)
    const propsRaw = {};
    const propsAlias = {};
    for (const p of (d.Data?.[0]?.Data || [])) {
      propsRaw[p.Name] = p.Value;
      propsAlias[aliasKey(p.Name)] = p.Value;
    }

    // ---- Prüfungen ----

    // ID passend? (gläubiger / glaeubiger akzeptieren)
    const idFromProps =
      propsRaw["glaeubiger"] ??
      propsRaw["Glaeubiger"] ??
      propsRaw["gläubiger"] ??
      propsRaw["Gläubiger"] ??
      propsAlias["glaeubiger"]; // alias erfasst beide Varianten
    if (String(idFromProps ?? "") !== id.toString()) {
      return { statusCode: 400, body: "ID does not match" };
    }

    // Token passend?
    const stored =
      (propsRaw["token_verify"] ?? propsAlias["token_verify"] ?? "").toString();
    if (!stored || stored !== token) {
      return { statusCode: 400, body: "Invalid token" };
    }

    // Bereits verbraucht?
    if (propsRaw["token_verify_used_at"] || propsAlias["token_verify_used_at"]) {
      return { statusCode: 409, body: "Token already used" };
    }

    // Abgelaufen?
    const expiryRaw = normalizeExpiry(propsRaw, propsAlias);
    if (expiryRaw) {
      const now = new Date();
      const exp = new Date(expiryRaw);
      if (isFinite(exp) && now > exp) {
        return { statusCode: 410, body: "Token expired" };
      }
    }

    // Alles ok
    return { statusCode: 200, body: "OK" };

  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
