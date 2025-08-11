// app.js — CSP‑konform, hübsches UI, und Submit als x-www-form-urlencoded (fix für {"error":"invalid_json"})
const i18n = {
  de:{title:"Bitte bestätigen Sie Ihre Adresse",intro:"Felder sind vorbefüllt und können bei Bedarf aktualisiert werden.",ctx:"Bitte geben Sie Ihre vollständigen und korrekten Adressdaten ein.",submit:"Absenden",gateFail:"Verifizierung fehlgeschlagen. Der Link ist ungültig oder abgelaufen.",gateOk:"Link geprüft – Formular freigeschaltet.",errGeneric:"Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut."},
  en:{title:"Please confirm your address",intro:"Fields are pre-filled and can be updated if needed.",ctx:"Please enter your complete and correct address details.",submit:"Submit",gateFail:"Verification failed. The link is invalid or expired.",gateOk:"Link verified – form enabled.",errGeneric:"An error occurred. Please try again later."},
  it:{title:"Per favore conferma il tuo indirizzo",intro:"I campi sono precompilati e possono essere aggiornati se necessario.",ctx:"Si prega di inserire i dati completi e corretti dell'indirizzo.",submit:"Invia",gateFail:"Verifica non riuscita. Il link non è valido o è scaduto.",gateOk:"Link verificato – modulo abilitato.",errGeneric:"Si è verificato un errore. Riprova più tardi."}
};

const qs = n => new URLSearchParams(location.search).get(n) || "";
function b64urlDecode(s){ if(!s) return ""; s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4)s+="="; try{return decodeURIComponent(escape(atob(s)))}catch(e){try{return atob(s)}catch{return ""}}}
function setVal(id,v){ const el=document.getElementById(id); if(!el) return; if(v!=null && String(v).trim()!=="") el.value=String(v).trim(); }

function setLanguage(lang){
  const d=i18n[lang]||i18n.de;
  document.getElementById('title').textContent=d.title;
  document.getElementById('intro').textContent=d.intro;
  document.getElementById('ctx-box').textContent=d.ctx;
  document.getElementById('btn-submit').textContent=d.submit;
  const pl=document.getElementById('privacy-link'); if(pl) pl.href=`privacy.html?lang=${lang}`;
}

(async () => {
  const lang=(qs('lang')||'de').toLowerCase(); document.getElementById('language').value=['de','it','en'].includes(lang)?lang:'de';
  document.getElementById('lang').value=document.getElementById('language').value;
  setLanguage(document.getElementById('lang').value);
  document.getElementById('language').addEventListener('change',e=>{document.getElementById('lang').value=e.target.value; setLanguage(e.target.value);});

  const id=qs("id"), token=qs("token"), em=qs("em");
  const email=b64urlDecode(em)||qs("email")||"";
  const errBox=document.getElementById("gate-error"), okBox=document.getElementById("gate-ok"), form=document.getElementById("verify-form");

  if(!id||!token||!em){ errBox.textContent=(i18n[lang]||i18n.de).gateFail; errBox.classList.remove("hidden"); return; }
  setVal("email",email); setVal("id",id); setVal("token",token); setVal("em",em);

  try{
    let resp=await fetch("/.netlify/functions/get_contact?email="+encodeURIComponent(email));
    let data=resp.ok?await resp.json():null;
    if(!data||!Object.keys(data).length){
      resp=await fetch("/.netlify/functions/get_contact?id="+encodeURIComponent(id));
      data=resp.ok?await resp.json():null;
    }
    if(!data||!Object.keys(data).length) throw new Error("no_contact");

    let glaeubiger=(data.glaeubiger ?? data["gläubiger"] ?? "").toString().trim();
    if(!glaeubiger) glaeubiger=id;
    setVal("glaeubiger",glaeubiger);
    ["firstname","name","strasse","hausnummer","plz","ort","country"].forEach(k=>setVal(k,data[k]));

    okBox.textContent=(i18n[lang]||i18n.de).gateOk; okBox.classList.remove("hidden");
    form.classList.remove("hidden");
  }catch(e){
    errBox.textContent=(i18n[lang]||i18n.de).gateFail; errBox.classList.remove("hidden"); return;
  }

  // AJAX Submit: urlencoded (Server erwartet das) → verhindert {"error":"invalid_json"}
  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const fd=new FormData(form);
    const body=new URLSearchParams(fd).toString();
    errBox.classList.add('hidden'); errBox.textContent="";
    try{
      const resp=await fetch(form.action,{
        method:'POST',
        headers:{
          'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept':'application/json',
          'X-Requested-With':'fetch'
        },
        body
      });
      if(resp.ok){
        const data=await resp.json().catch(()=>({}));
        if(data && data.redirect){ location.href=data.redirect; return; }
        if(resp.redirected){ location.href=resp.url; return; }
        location.href='/danke.html'; return;
      }
      const msg = (i18n[lang]||i18n.de).errGeneric;
      errBox.textContent = msg + ` (Server: ${resp.status})`;
      errBox.classList.remove('hidden');
    }catch(err){
      errBox.textContent=(i18n[lang]||i18n.de).errGeneric;
      errBox.classList.remove('hidden');
    }
  });
})();