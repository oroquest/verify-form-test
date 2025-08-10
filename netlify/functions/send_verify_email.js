// netlify/functions/send_verify_email.js
const MJ_PUBLIC  = process.env.MJ_APIKEY_PUBLIC;
const MJ_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const mjAuth = 'Basic ' + Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64');

const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS || 'noreply@sikuralife.com';
const MAIL_FROM_NAME    = process.env.MAIL_FROM_NAME    || 'SIKURA Leben AG i.L.';

// <- HIER: einzige Quelle für die Issue-URL
const URL_ISSUE_TOKEN = process.env.URL_ISSUE_TOKEN || 'https://verify.sikuralife.com/.netlify/functions/issue_token';

function parseBody(e){const ct=(e.headers['content-type']||'').toLowerCase();if(ct.includes('application/json')){try{return JSON.parse(e.body||'{}')}catch{return{}}}try{return Object.fromEntries(new URLSearchParams(e.body||'').entries())}catch{return{}}}

async function issueToken(email,id,lang='de',name=''){
  let endpoint = URL_ISSUE_TOKEN.trim();
  try { new URL(endpoint); } catch { throw new Error('Bad URL_ISSUE_TOKEN: ' + endpoint); }
  const r = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,id,lang,name})});
  if(!r.ok) throw new Error(`issue_token failed: ${r.status} ${await r.text()}`);
  return r.json(); // { ok, token, expiresAt, url }
}

async function fetchFirstname(email){
  try{
    const r=await fetch(`https://api.mailjet.com/v3/REST/contactdata/${encodeURIComponent(email)}`,{headers:{Authorization:'Basic '+Buffer.from(`${MJ_PUBLIC}:${MJ_PRIVATE}`).toString('base64')}});
    if(!r.ok) return '';
    const j=await r.json();
    const map=Object.fromEntries((j.Data?.[0]?.Data||[]).map(p=>[p.Name,p.Value]));
    return (map.firstname??'').toString();
  }catch{return''}
}

exports.handler = async (event)=>{
  try{
    if(event.httpMethod!=='POST') return {statusCode:405, body:'Method Not Allowed'};
    const {email,id,lang='de',name='',templateId}=parseBody(event);
    if(!email||!id||!templateId) return {statusCode:400, body:'missing email or id or templateId'};

    const {url, expiresAt}=await issueToken(String(email).toLowerCase().trim(), String(id).trim(), String(lang).toLowerCase(), name);
    const firstname = await fetchFirstname(String(email).toLowerCase().trim());

    const payload = {
      Messages:[{
        From:{Email:MAIL_FROM_ADDRESS, Name:MAIL_FROM_NAME},
        To:[{Email:String(email).toLowerCase().trim(), Name:name}],
        TemplateID:Number(templateId),
        TemplateLanguage:true,
        Variables:{ verify_url:url, expires_at:expiresAt, firstname }
      }]
    };

    const resp = await fetch('https://api.mailjet.com/v3.1/send',{method:'POST',headers:{Authorization:mjAuth,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const text = await resp.text();
    if(!resp.ok) return {statusCode:502, body:`Mailjet send failed: ${resp.status} ${text}`};

    return {statusCode:200, headers:{'Content-Type':'application/json'}, body:JSON.stringify({ok:true, url, expiresAt})};
  }catch(e){
    return {statusCode:500, body:'server error: '+e.message};
  }
};
