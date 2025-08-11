// JSON-only submit, klassisches Layout, Vorbefüllung + Validation
const i18n = {
  de:{title:"Bitte bestätigen Sie Ihre Adresse",intro:"Felder sind vorbefüllt und können bei Bedarf aktualisiert werden.",ctx:"Bitte geben Sie Ihre vollständigen und korrekten Adressdaten ein.",submit:"Absenden",gateFail:"Verifizierung fehlgeschlagen. Der Link ist ungültig oder abgelaufen.",gateOk:"Link geprüft – Formular freigeschaltet.",errGeneric:"Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.",errRequired:"Pflichtfeld",errDigits:"Nur Ziffern erlaubt",errZIPLenCH:"PLZ muss 4 Ziffern haben (CH/LI).",errZIPLenDE:"PLZ muss 5 Ziffern haben (DE/IT).",errConfirm:"Bitte bestätigen.",errPrivacy:"Bitte zustimmen."},
  en:{title:"Please confirm your address",intro:"Fields are pre-filled and can be updated if needed.",ctx:"Please enter your complete and correct address details.",submit:"Submit",gateFail:"Verification failed. The link is invalid or expired.",gateOk:"Link verified – form enabled.",errGeneric:"An error occurred. Please try again later.",errRequired:"Required",errDigits:"Digits only",errZIPLenCH:"ZIP must be 4 digits (CH/LI).",errZIPLenDE:"ZIP must be 5 digits (DE/IT).",errConfirm:"Please confirm.",errPrivacy:"Please consent."},
  it:{title:"Per favore conferma il tuo indirizzo",intro:"I campi sono precompilati e possono essere aggiornati se necessario.",ctx:"Si prega di inserire i dati completi e corretti dell'indirizzo.",submit:"Invia",gateFail:"Verifica non riuscita. Il link non è valido o è scaduto.",gateOk:"Link verificato – modulo abilitato.",errGeneric:"Si è verificato un errore. Riprova più tardi.",errRequired:"Campo obbligatorio",errDigits:"Solo cifre",errZIPLenCH:"CAP deve avere 4 cifre (CH/LI).",errZIPLenDE:"CAP deve avere 5 cifre (DE/IT).",errConfirm:"Per favore conferma.",errPrivacy:"Acconsenti, per favore."}
};

const qs = n => new URLSearchParams(location.search).get(n) || "";
function b64urlDecode(s){ if(!s) return ""; s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4)s+="="; try{return decodeURIComponent(escape(atob(s)))}catch(e){try{return atob(s)}catch{return ""}}}
function setVal(id,v){ const el=document.getElementById(id); if(!el) return; if(v!=null && String(v).trim()!=="") el.value=String(v).trim(); }
function setText(id,t){ const el=document.getElementById(id); if(el) el.textContent=t; }

function setLanguage(lang){
  const d=i18n[lang]||i18n.de;
  setText('title',d.title); setText('intro',d.intro); setText('ctx-box',d.ctx); setText('btn-submit',d.submit);
  const pl=document.getElementById('privacy-link'); if(pl) pl.href=`privacy.html?lang=${lang}`;
}

function normalizeCountry(raw){
  const s=(raw||"").trim().toLowerCase();
  if(["ch","che","schweiz","switzerland","suisse","svizzera"].includes(s)) return "CH";
  if(["li","liechtenstein","lichtenstein"].includes(s)) return "LI";
  if(["de","deu","deutschland","germany","alemania"].includes(s)) return "DE";
  if(["it","ita","italien","italia","italy"].includes(s)) return "IT";
  return s.toUpperCase();
}
function showFieldError(id, msg){ const el=document.getElementById('err-'+id); const input=document.getElementById(id); if(el){ el.textContent=msg; el.style.display='block'; } if(input){ input.classList.add('error-field'); }}
function clearFieldError(id){ const el=document.getElementById('err-'+id); const input=document.getElementById(id); if(el){ el.textContent=''; el.style.display='none'; } if(input){ input.classList.remove('error-field'); }}

function validateFrontend(dict){
  const req = ["firstname","name","strasse","hausnummer","plz","ort","country"];
  let ok=true;
  req.forEach(id=>{ const el=document.getElementById(id); const v=(el.value||"").trim(); clearFieldError(id); if(!v){ showFieldError(id,dict.errRequired); ok=false; }});
  const cc=normalizeCountry(document.getElementById("country").value);
  const plzEl=document.getElementById("plz"); plzEl.value=plzEl.value.replace(/\D+/g,"");
  const plz=plzEl.value;
  if(!/^\d+$/.test(plz)){ showFieldError('plz',dict.errDigits); ok=false; }
  if((cc==='CH'||cc==='LI') && plz.length!==4){ showFieldError('plz',dict.errZIPLenCH); ok=false; }
  if((cc==='DE'||cc==='IT') && plz.length!==5){ showFieldError('plz',dict.errZIPLenDE); ok=false; }
  if(!document.getElementById('confirm').checked){ showFieldError('confirm',dict.errConfirm); ok=false; }
  if(!document.getElementById('privacy').checked){ showFieldError('privacy',dict.errPrivacy); ok=false; }
  return ok;
}

(async () => {
  const lang=(qs('lang')||'de').toLowerCase();
  const currentLang=['de','it','en'].includes(lang)?lang:'de';
  document.getElementById('language').value=currentLang;
  document.getElementById('lang').value=currentLang;
  setLanguage(currentLang);
  document.getElementById('language').addEventListener('change',e=>{ document.getElementById('lang').value=e.target.value; setLanguage(e.target.value); });

  const id=qs('id'), token=qs('token'), em=qs('em');
  const email=b64urlDecode(em)||qs('email')||'';
  const errBox=document.getElementById('gate-error'), okBox=document.getElementById('gate-ok'), form=document.getElementById('verify-form');

  if(!id||!token||!em){ errBox.textContent=(i18n[currentLang]||i18n.de).gateFail; errBox.classList.remove('hidden'); return; }
  setVal('email',email); setVal('id',id); setVal('token',token); setVal('em',em);

  try{
    let resp=await fetch('/.netlify/functions/get_contact?email='+encodeURIComponent(email));
    let data=resp.ok?await resp.json():null;
    if(!data||!Object.keys(data).length){
      resp=await fetch('/.netlify/functions/get_contact?id='+encodeURIComponent(id));
      data=resp.ok?await resp.json():null;
    }
    if(!data||!Object.keys(data).length) throw new Error('no_contact');

    let glaeubiger=(data.glaeubiger ?? data['gläubiger'] ?? '').toString().trim();
    if(!glaeubiger) glaeubiger=id;
    setVal('glaeubiger',glaeubiger);
    ['firstname','name','strasse','hausnummer','plz','ort','country'].forEach(k=>setVal(k,data[k]));

    okBox.textContent=(i18n[currentLang]||i18n.de).gateOk; okBox.classList.remove('hidden');
    form.classList.remove('hidden');
  }catch(e){
    errBox.textContent=(i18n[currentLang]||i18n.de).gateFail;
    errBox.classList.remove('hidden');
    return;
  }

  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const dict=i18n[currentLang]||i18n.de;
    errBox.classList.add('hidden'); errBox.textContent='';

    if(!validateFrontend(dict)) return;

    // Whitelist-Payload
    const allow = ["email","id","token","lang","em","glaeubiger","firstname","name","strasse","hausnummer","plz","ort","country"];
    const fd = new FormData(form);
    const payload = {};
    for (const [k,v] of fd.entries()) if (allow.includes(k)) payload[k] = v;

    try{
      const resp = await fetch(form.action, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Accept':'application/json',
          'X-Requested-With':'fetch'
        },
        body: JSON.stringify(payload)
      });

      if (resp.status === 204) { location.href = '/danke.html'; return; }

      const text = await resp.text().catch(()=>'');
      if (resp.ok) {
        try { const data = text ? JSON.parse(text) : {}; if (data && data.redirect) { location.href = data.redirect; return; } } catch {}
        if (resp.redirected) { location.href = resp.url; return; }
        location.href = '/danke.html'; return;
      }

      const msg = `${dict.errGeneric} (Server: ${resp.status})`;
      errBox.textContent = (text && text.length < 400) ? `${msg} — ${text}` : msg;
      errBox.classList.remove('hidden');
    } catch {
      errBox.textContent = dict.errGeneric;
      errBox.classList.remove('hidden');
    }
  });
})();
