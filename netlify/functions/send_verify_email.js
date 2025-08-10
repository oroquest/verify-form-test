// netlify/functions/send_verify_email.js

// Template-IDs aus ENV
const TPL = {
  de: { VN_DIREKT: process.env.TEMPLATE_DE_DIRECT, VN_ANWALT: process.env.TEMPLATE_DE_LAWYER },
  en: { VN_DIREKT: process.env.TEMPLATE_EN_DIRECT, VN_ANWALT: process.env.TEMPLATE_EN_LAWYER },
  it: { VN_DIREKT: process.env.TEMPLATE_IT_DIRECT, VN_ANWALT: process.env.TEMPLATE_IT_LAWYER }
};

const URL_ISSUE_TOKEN   = (process.env.URL_ISSUE_TOKEN || 'https://verify.sikuralife.com/.netlify/functions/issue_token').trim();
const MJ_PUBLIC         = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE        = process.env.MJ_APIKEY_PRIVATE;
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS || 'noreply@sikuralife.com';
const MAIL_FROM_NAME    = process.env.MAIL_FROM_NAME    || 'SIKURA Leben AG i.L.';
const mjAuth            = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

// Helpers
function parseBody(e){
  const ct=(e.headers['content-type']||'').toLowerCase();
  if(ct.includes('application/json')){ try{ return JSON.parse(e.body||'{}'); }catch{ return {}; } }
  try{ return Object.fromEntries(new URLSearchParams(e.body||'').entries()); }catch{ return {}; }
}
const normLang = (l)=> String(l||'').trim().toLowerCase();
const normCat  = (c)=> String(c||'').trim().toUpperCase().replace(/\s+/g,'_'); // "VN DIREKT" -> "VN_DIREKT"

function languageWithFallback(requested){
  const l = normLang(requested);
  const hasAny = !!(TPL?.[l]?.VN_DIREKT || TPL?.[l]?.VN_ANWALT);
  if (hasAny) return l;
  // bevorzugte Fallback-Reihenfolge: EN → DE → IT
  if (TPL?.en?.VN_DIREKT || TPL?.en?.VN_ANWALT) return 'en';
  if (TPL?.de?.VN_DIREKT || TPL?.de?.VN_ANWALT) return 'de';
  if (TPL?.it?.VN_DIREKT || TPL?.it?.VN_ANWALT) return 'it';
  return l;
}

function pickTemplateId(lang, category, explicitTemplateId){
  if (explicitTemplateId) return Number(explicitTemplateId);
  const resolved = languageWithFallback(lang);
  const c = category;
  const candidates = [
    TPL?.[resolved]?.[c],
    TPL?.[resolved]?.VN_DIREKT,
    TPL?.en?.[c],
    TPL?.en?.VN_DIREKT,
    TPL?.de?.[c],
    TPL?.de?.VN_DIREKT,
    TPL?.it?.[c],
    TPL?.it?.VN_DIREKT
  ].filter(Boolean);
  if (candidates.length) return Number(candidates[0]);
  throw new Error(`No template mapping for lang=${lang} category=${category}`);
}

async function issueToken(email,id,lang='de',name=''){
  try { new URL(URL_ISSUE_TOKEN); } catch { throw new Error('Bad URL_ISSUE_TOKEN: '+URL_ISSUE_TOKEN); }
  const r = await fetch(URL_ISSUE_TOKEN,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email, id, lang, name })
  });
  if (!r.ok) throw new Error(`issue_token failed: ${r.status} ${await r.text()}`);
  return r.json(); // { ok, token, expiresAt, url }
}

exports.handler = async (event)=>{
  if (event.httpMethod !== 'POST') return { statusCode:405, body:'Method Not Allowed' };
  try{
    const { email, id, lang, category, name='', templateId } = parseBody(event);
    if (!email || !id) return { statusCode:400, body:'Missing email or id' };

    // 1) Token & URL
    const { url, expiresAt } = await issueToken(String(email).trim().toLowerCase(), String(id).trim(), normLang(lang), name);

    // 2) Sprache/Kategorie normalisieren + Template wählen
    const plang = normLang(lang);
    const pcat  = normCat(category);
    const tplId = pickTemplateId(plang, pcat, templateId);

    // 3) Mailjet Send
    const payload = {
      Messages: [{
        From: { Email: MAIL_FROM_ADDRESS, Name: MAIL_FROM_NAME },
        To:   [{ Email: String(email).trim().toLowerCase(), Name: name }],
        TemplateID: tplId,
        TemplateLanguage: true,
        TrackOpens: "enabled",
        TrackClicks: "enabled",
        Variables: { verify_url: url, expires_at: expiresAt },
        TextPart:
`Guten Tag,

bitte bestätigen Sie Ihre Kontaktdaten:

${url}

Hinweis: Der Bestätigungslink ist aus Sicherheitsgründen nur 7 Tage gültig (Ablauf: ${expiresAt}).`
      }]
    };

    const resp = await fetch('https://api.mailjet.com/v3.1/send',{
      method:'POST',
      headers:{ Authorization: mjAuth, 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await resp.text();
    if (!resp.ok) return { statusCode:502, body:`Mailjet send failed: ${resp.status} ${text}` };

    return {
      statusCode:200,
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ok:true, url, expiresAt, lang: plang, category: pcat, templateId: tplId })
    };
  }catch(e){
    return { statusCode:500, body:'Server error: '+e.message };
  }
};
