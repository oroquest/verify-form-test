// i18n kurz
const i18n = {
  de:{title:"Bitte bestätigen Sie Ihre Adresse",intro:"Felder sind vorbefüllt und können bei Bedarf aktualisiert werden.",ctx:"Bitte geben Sie Ihre vollständigen und korrekten Adressdaten ein.",submit:"Absenden",gateFail:"Verifizierung fehlgeschlagen. Der Link ist ungültig oder abgelaufen.",gateOk:"Link geprüft – Formular freigeschaltet.",errGeneric:"Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut."},
  en:{title:"Please confirm your address",intro:"Fields are pre-filled and can be updated if needed.",ctx:"Please enter your complete and correct address details.",submit:"Submit",gateFail:"Verification failed. The link is invalid or expired.",gateOk:"Link verified – form enabled.",errGeneric:"An error occurred. Please try again later."},
  it:{title:"Per favore conferma il tuo indirizzo",intro:"I campi sono precompilati e possono essere aggiornati se necessario.",ctx:"Si prega di inserire i dati completi e corretti dell'indirizzo.",submit:"Invia",gateFail:"Verifica non riuscita. Il link non è valido o è scaduto.",gateOk:"Link verificato – modulo abilitato.",errGeneric:"Si è verificato un errore. Riprova più tardi."}
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

// minimal validation wie früher
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
function validateRequired(ids, dict){
  let ok=true;
  ids.forEach(id=>{ clearFieldError(id); const v=(document.getElementById(id).value||'').trim(); if(!v){ showFieldError(id, dict.errRequired||'Pflichtfeld'); ok=false; }});
  return ok;
}
function validateZIP(dict){
  const cc=normalizeCountry(document.getElementById('country').value);
  const el=document.getElementById('plz');
  el.value = el.value.replace(/\D+/g,'');
  const v=el.value;
  if(!/^\d+$/.test(v)){ showFieldError('plz', dict.errDigits || 'Nur Ziffern erlaubt'); return false; }
  if((cc==='CH'||cc==='LI') && v.length!==4){ showFieldError('plz', dict.errZIPLenCH || '4-stellig'); return false; }
  if((cc==='DE'||cc==='IT') && v.length!==5){ showFieldError('plz', dict.errZIPLenDE || '5-stellig'); return false; }
  return true;
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

  // Daten lookup: erst email, dann id
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

  // Live-Error-Clear
  ['firstname','name','strasse','hausnummer','plz','ort','country','confirm','privacy'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', ()=>clearFieldError(id));
    el.addEventListener('change', ()=>clearFieldError(id));
    el.addEventListener('blur', ()=>clearFieldError(id));
  });

  // Submit: zuerst urlencoded, dann Fallback JSON bei invalid_json
  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const dict=i18n[currentLang]||i18n.de;
    errBox.classList.add('hidden'); errBox.textContent='';

    // Pflichtfelder + ZIP + Checkboxen
    let ok = validateRequired(['firstname','name','strasse','hausnummer','plz','ort','country'], dict);
    if(ok) ok = validateZIP(dict);
    if(!document.getElementById('confirm').checked){ showFieldError('confirm', dict.errConfirm || 'Bitte bestätigen.'); ok=false; }
    if(!document.getElementById('privacy').checked){ showFieldError('privacy', dict.errPrivacy || 'Bitte zustimmen.'); ok=false; }
    if(!ok){ return; }

    const fd=new FormData(form);
    const urlencoded=new URLSearchParams(fd).toString();
    const payload = Object.fromEntries(fd.entries());

    async function submitUrlEncoded(){
      return fetch(form.action,{
        method:'POST',
        headers:{
          'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept':'application/json',
          'X-Requested-With':'fetch'
        },
        body:urlencoded
      });
    }
    async function submitJSON(){
      return fetch(form.action,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Accept':'application/json',
          'X-Requested-With':'fetch'
        },
        body:JSON.stringify(payload)
      });
    }

    try{
      let resp = await submitUrlEncoded();
      let text = await resp.text().catch(()=>'');

      // Fallback bei 400 + invalid_json
      if(resp.status===400 && /invalid_json/i.test(text)){
        resp = await submitJSON();
        text = await resp.text().catch(()=> '');
      }

      if(resp.ok){
        let data={}; try{ data = text ? JSON.parse(text) : {}; }catch{}
        if(data && data.redirect){ location.href=data.redirect; return; }
        if(resp.redirected){ location.href=resp.url; return; }
        location.href='/danke.html'; return;
      }

      const msg = `${dict.errGeneric} (Server: ${resp.status})`;
      errBox.textContent = (text && text.length<400) ? `${msg} — ${text}` : msg;
      errBox.classList.remove('hidden');

    }catch(err){
      errBox.textContent = dict.errGeneric;
      errBox.classList.remove('hidden');
    }
  });
})();
