// netlify/functions/get_contact.js
const MJ_KEY = process.env.MJ_APIKEY_PUBLIC;
const MJ_SECRET = process.env.MJ_APIKEY_PRIVATE;
const MJ_BASE = "https://api.mailjet.com/v3/REST";

const auth = "Basic " + Buffer.from(`${MJ_KEY}:${MJ_SECRET}`).toString("base64");
const ok = (obj) => ({ statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });
const bad = (s, e) => ({ statusCode: s, headers: { "Content-Type": "application/json" }, body: JSON.stringify(e) });

exports.handler = async (event) => {
  try {
    const q = new URLSearchParams(event.rawQuery || "");
    const email = (q.get("email") || q.get("id") || "").trim();
    if (!email) return bad(400, { error: "missing_email" });

    // 1) contactdata abrufen
    const r = await fetch(`${MJ_BASE}/contactdata/${encodeURIComponent(email)}`, { headers: { Authorization: auth } });
    const t = await r.text();
    if (!r.ok) return bad(r.status, { error: "mailjet_error", detail: t });
    const j = t ? JSON.parse(t) : {};
    const props = {};
    for (const item of (j?.Data?.[0]?.Data || [])) props[item.Name] = item.Value;

    // 2) Mapping auf erwartete Keys (robust: klein/Gross/umlaut)
    const pick = (...keys) => {
      for (const k of keys) if (props[k] != null && String(props[k]).trim() !== "") return String(props[k]);
      return "";
    };
    const data = {
      glaeubiger: pick("glaeubiger", "Glaeubiger", "Gläubiger"),
      firstname : pick("firstname", "Firstname"),
      name      : pick("name", "Name"),
      strasse   : pick("strasse", "Strasse"),
      hausnummer: pick("hausnummer", "Hausnummer"),
      plz       : pick("plz", "Plz"),
      ort       : pick("ort", "Ort"),
      country   : pick("country", "Country"),
    };

    return ok(data);
  } catch (e) {
    return bad(500, { error: "crash", message: String(e) });
  }
};
