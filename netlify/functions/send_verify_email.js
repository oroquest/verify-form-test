// netlify/functions/send_verify_email.js
const MJ_PUBLIC  = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

const URL_ISSUE_TOKEN    = (process.env.URL_ISSUE_TOKEN || 'https://verify.sikuralife.com/.netlify/functions/issue_token').trim();
const MAIL_FROM_ADDRESS  = process.env.MAIL_FROM_ADDRESS || 'noreply@sikuralife.com';
const MAIL_FROM_NAME     = process.env.MAIL_FROM_NAME    || 'SIKURA Leben AG i.L.';

// Template-IDs aus ENV
const TPL = {
  de: {
    VN_DIREKT: process.env.TEMPLATE_DE_DIRECT,
    VN_ANWALT: process.env.TEMPLATE_DE_LAWYER
  },
  en: {
    VN_DIREKT: process.env.TEMPLATE_EN_DIRECT,
    VN_ANWALT: process.env.TEMPLATE_EN_LAWYER
  },
  it: {
    VN_DIREKT: process.env.TEMPLATE_IT_DIRECT,
    VN_ANWALT: process.env.TEMPLATE_IT_LAWYER
  }
};

function parseBody(e){
  const ct=(e.headers['content-type']||'').toLowerCase();
  if(ct.includes('application/json')){try{return JSON.parse(e.body||'{}')}catch{return{}}}
  try{return Object.fromEntries(new URLSearchParams(e.body||'').entries())}catch{return{}}
}

async function issueToken(email,id,lang='de',name=''){
  try{ new URL(URL_ISSUE_TOKEN); }catch{ throw new Error('Bad URL_ISSUE_TOKEN: '+URL_ISSUE_TOKEN); }
  const r = await fetch(URL_ISSUE_TOKEN,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ email, id, lang, name })
  });
  if(!r.ok) throw new Error(`issue_token failed: ${r.status} ${await r.text()}`);
  return r.json(); // { ok, token, expiresAt, url }
}

async function getContactProps(email){
  const r = await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`,{
    headers:{ Authorization: mjAuth }
  });
  if(!r.ok) return {};
  const j = await r.json();
  const map = Object.fromEntries((j.Data?.[0]?.Data||[]).map(p=>[p.Name, p.Value]));
  return map; // Rohzugriff, damit wir exakt "Sprache" & "Category" lesen können
}

// Normalisierer für Sprache: akzeptiert "DE"/"deutsch"/"it" etc.
function normLang(v){
  const s = String(v||'').trim().toLowerCase();
  if(['de','deutsch','ger','german'].includes(s)) return 'de';
  if(['en','eng','english'].includes(s))          return 'en';
  if(['it','ita','italiano','italienisch'].includes(s)) return 'it';
  return 'de'; // Fallback
}

// Normalisierer für Category: akzeptiert "VN DIREKT" / "VN ANWALT" in beliebiger Schreibweise
function normCat(v){
  const s = String(v||'').trim().toUpperCase().replace(/\s+/g,' ').replace(/\./g,'');
  if(s.includes('ANWALT')) return 'VN_ANWALT';
  return 'VN_DIREKT';
}

function pickTemplateId(lang, category, explicitTemplateId){
  if(explicitTemplateId) return Number(explicitTemplateId);
  const id = TPL?.[lang]?.[category];
  if(id) return Number(id);
  // Fallback-Kaskade: erst gleiche Sprache/Direkt, dann DE/EN/IT Direkt
  const fallbacks = [
    TPL?.[lang]?.VN_DIREKT,
    TPL?.de?.VN_DIREKT,
    TPL?.en?.VN_DIREKT,
    TPL?.it?.VN_DIREKT
  ].filter(Boolean);
  if(fallbacks.length) return Number(fallbacks[0]);
  throw new Error(`No template mapping for lang=${lang} category=${category}`);
}

exports.handler = async (event)=>{
  try{
    if(event.httpMethod!=='POST') return { statusCode:405, body:'Method Not Allowed' };

    const { email, id, lang, name='', templateId, category } = parseBody(event);
    if(!email || !id) return { statusCode:400, body:'missing email or id' };

    const emailLC = String(email).trim().toLowerCase();

    // 1) Kontakt lesen (holt "Sprache", "Category", plus optionale Anzeige-Felder)
    const props = await getContactProps(emailLC);
    const firstname  = (props['firstname'] ?? '').toString();
    const creditorId = (props['gläubiger'] ?? props['glaeubiger'] ?? '').toString();
    const ort        = (props['ort'] ?? '').toString();
    const country    = (props['country'] ?? '').toString();

    // Deine bestehenden Felder berücksichtigen:
    // - Sprache: Feld heißt exakt "Sprache" und hat Werte "DE"/"IT" (ggf. auch "EN")
    // - Category: Feld heißt exakt "Category" und hat Werte "VN DIREKT" / "VN ANWALT"
    const langFromContact = normLang(props['Sprache']);
    const catFromContact  = normCat(props['Category']);

    // Request-Overrides (falls im Body mitgegeben) gehen vor
    const plang = normLang(lang ?? langFromContact);
    const pcat  = normCat(category ?? catFromContact);

    // 2) Token & URL erzeugen (7 Tage)
    const { url, expiresAt } = await issueToken(emailLC, String(id).trim(), plang, name);

    // 3) TemplateID wählen
    const tplId = pickTemplateId(plang, pcat, templateId);

    // 4) Senden
    const payload = {
      Messages: [{
        From: { Email: MAIL_FROM_ADDRESS, Name: MAIL_FROM_NAME },
        To:   [{ Email: emailLC, Name: name }],
        TemplateID: tplId,
        TemplateLanguage: true,
        TrackOpens: "enabled",
        TrackClicks: "enabled",
        Variables: {
          verify_url: url,
          expires_at: expiresAt,
          firstname: firstname || '',
          creditor_id: creditorId || '',
          name: name || '',
          ort: ort || '',
          country: country || ''
        },
        TextPart:
`Guten Tag ${firstname || ''},

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
    if(!resp.ok) return { statusCode:502, body:`Mailjet send failed: ${resp.status} ${text}` };

    return {
      statusCode:200,
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ok:true, url, expiresAt, lang: plang, category: pcat, templateId: tplId })
    };
  }catch(e){
    return { statusCode:500, body:'server error: '+e.message };
  }
};
