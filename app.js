// Hilfen
const qs = n => new URLSearchParams(location.search).get(n) || "";
function b64urlDecode(s){ if(!s) return ""; s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4)s+="="; try{return decodeURIComponent(escape(atob(s)))}catch(e){try{return atob(s)}catch{return ""}}}
function setVal(id,v){ if(v!=null && String(v).trim()!=="") document.getElementById(id).value=String(v).trim(); }

(async () => {
  const id=qs("id"), token=qs("token"), em=qs("em");
  const email=b64urlDecode(em) || qs("email") || "";
  const errBox = document.getElementById("gate-error");

  if(!id || !token || !em){
    errBox.textContent = "Link ungültig oder unvollständig.";
    errBox.classList.remove("hidden");
    return;
  }

  setVal("email",email); setVal("id",id); setVal("token",token); setVal("em",em);

  try{
    // 1) zuerst per EMAIL suchen (richtiger Param!)
    let resp = await fetch("/.netlify/functions/get_contact?email=" + encodeURIComponent(email));
    let data = resp.ok ? await resp.json() : null;

    // 2) Fallback: per ID, falls Email nichts liefert
    if(!data || !Object.keys(data).length){
      resp = await fetch("/.netlify/functions/get_contact?id=" + encodeURIComponent(id));
      data = resp.ok ? await resp.json() : null;
    }
    if(!data || !Object.keys(data).length) throw new Error("no_contact");

    // glaeubiger: falls leer, ID aus URL einsetzen
    let glaeubiger = (data.glaeubiger ?? data["gläubiger"] ?? "").toString().trim();
    if(!glaeubiger) glaeubiger = id;
    setVal("glaeubiger", glaeubiger);

    // übrige Felder
    ["firstname","name","strasse","hausnummer","plz","ort","country"].forEach(k => setVal(k, data[k]));

    document.getElementById("gate-ok").textContent = "Link geprüft – Formular freigeschaltet.";
    document.getElementById("gate-ok").classList.remove("hidden");
    document.getElementById("verify-form").classList.remove("hidden");
  }catch(e){
    errBox.textContent = "Verifizierung fehlgeschlagen oder keine Kontaktdaten gefunden.";
    errBox.classList.remove("hidden");
  }
})();
