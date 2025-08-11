/* Sikura verify app.js – robust fetch/parse + shape unwrap + on-page debug */

const i18n = {
  de: { title:"Bitte bestätigen Sie Ihre Adresse", intro:"Felder sind vorbefüllt und können bei Bedarf aktualisiert werden.", ctx:"Bitte geben Sie Ihre vollständigen und korrekten Adressdaten ein.", glaeubiger:"Gläubiger‑Nr.", firstname:"Vorname", name:"Nachname", strasse:"Strasse", hausnummer:"Nr.", plz:"PLZ", ort:"Ort", country:"Land", hintGlaeubiger:"Nummer des Gläubigers.", hintFirst:"Vorname gemäss Personalausweis.", hintName:"Nachname gemäss Personalausweis.", hintStrasse:"Strassenname gemäss offizieller Adresse ohne Hausnummer.", hintHausnummer:"Hausnummer gemäss offizieller Adresse.", hintZIP:"Postleitzahl gemäss Land (CH/LI = 4 Ziffern, DE/IT = 5 Ziffern).", hintOrt:"Ort gemäss offizieller Adresse.", hintCountry:"Land gemäss offizieller Adresse.", confirm:"Ich bestätige, dass die angegebenen Daten korrekt sind.", privacy:"Ich stimme der Verarbeitung meiner Daten gemäss DSGVO zu.", privacyLink:"Datenschutzhinweise", submit:"Absenden", errRequired:"Pflichtfeld – bitte ausfüllen.", errDigits:"Es sind nur Ziffern erlaubt.", errConfirm:"Bitte bestätigen Sie die Richtigkeit der Angaben.", errPrivacy:"Bitte stimmen Sie der DSGVO‑Verarbeitung zu.", errZIPLenCH:"PLZ muss 4 Ziffern haben (CH).", errZIPLenLI:"PLZ muss 4 Ziffern haben (LI).", errZIPLenIT:"PLZ muss 5 Ziffern haben (IT).", errZIPLenDE:"PLZ muss 5 Ziffern haben (DE).", expiry:"Hinweis: Der Bestätigungslink ist aus Sicherheitsgründen 7 Tage gültig.", gateFail:"Verifizierung fehlgeschlagen. Der Link ist ungültig oder abgelaufen.", gateOk:"Link geprüft – Formular freigeschaltet.", errInvalidToken:"Link ungültig oder bereits verwendet.", errTokenExpired:"Link abgelaufen.", errTokenUsed:"Link bereits verwendet.", errGeneric:"Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut." },
  it: { title:"Per favore conferma il tuo indirizzo", intro:"I campi sono precompilati e possono essere aggiornati se necessario.", ctx:"Si prega di inserire i dati completi e corretti dell'indirizzo.", glaeubiger:"Numero del creditore", firstname:"Nome", name:"Cognome", strasse:"Via", hausnummer:"Nr.", plz:"CAP", ort:"Città", country:"Paese", hintGlaeubiger:"Numero del creditore come da comunicazione.", hintFirst:"Nome secondo la carta d'identità.", hintName:"Cognome secondo la carta d'identità.", hintStrasse:"Nome della via senza numero civico.", hintHausnummer:"Numero civico secondo l'indirizzo ufficiale.", hintZIP:"CAP secondo il paese (CH/LI = 4 cifre, DE/IT = 5 cifre).", hintOrt:"Località secondo l'indirizzo ufficiale.", hintCountry:"Paese secondo l'indirizzo ufficiale.", confirm:"Confermo che i dati forniti sono corretti.", privacy:"Acconsento al trattamento dei miei dati secondo il GDPR.", privacyLink:"Informativa privacy", submit:"Invia", errRequired:"Campo obbligatorio – compila per favore.", errDigits:"Sono consentite solo cifre.", errConfirm:"Conferma che i dati sono corretti.", errPrivacy:"Fornisci il consenso GDPR.", errZIPLenCH:"Il CAP deve avere 4 cifre (CH).", errZIPLenLI:"Il CAP deve avere 4 cifre (LI).", errZIPLenIT:"Il CAP deve avere 5 cifre (IT).", errZIPLenDE:"Il CAP deve avere 5 cifre (DE).", expiry:"Nota: Per motivi di sicurezza il link è valido per 7 giorni.", gateFail:"Verifica non riuscita. Il link non è valido o è scaduto.", gateOk:"Link verificato – modulo abilitato.", errInvalidToken:"Link non valido o già utilizzato.", errTokenExpired:"Link scaduto.", errTokenUsed:"Link già utilizzato.", errGeneric:"Si è verificato un errore. Riprova più tardi." },
  en: { title:"Please confirm your address", intro:"Fields are pre-filled and can be updated if needed.", ctx:"Please enter your complete and correct address details.", glaeubiger:"Creditor No.", firstname:"First name", name:"Last name", strasse:"Street", hausnummer:"No.", plz:"ZIP", ort:"City/Town", country:"Country", hintGlaeubiger:"Creditor number as stated in the letter.", hintFirst:"First name according to identity card.", hintName:"Last name according to identity card.", hintStrasse:"Street name without house number.", hintHausnummer:"House number as per official address.", hintZIP:"ZIP code according to country (CH/LI = 4 digits, DE/IT = 5 digits).", hintOrt:"City/Town as per official address.", hintCountry:"Country as per official address.", confirm:"I confirm that the information provided is correct.", privacy:"I consent to the processing of my data under GDPR.", privacyLink:"Privacy notice", submit:"Submit", errRequired:"Required field — please fill in.", errDigits:"Digits only.", errConfirm:"Please confirm the information is correct.", errPrivacy:"Please provide GDPR consent.", errZIPLenCH:"ZIP must be 4 digits (CH).", errZIPLenLI:"ZIP must be 4 digits (LI).", errZIPLenIT:"ZIP must be 5 digits (IT).", errZIPLenDE:"ZIP must be 5 digits (DE).", expiry:"Note: For security, the confirmation link is valid for 7 days.", gateFail:"Verification failed. The link is invalid or expired.", gateOk:"Link verified – form enabled.", errInvalidToken:"Link invalid or already used.", errTokenExpired:"Link expired.", errTokenUsed:"Link already used.", errGeneric:"An error occurred. Please try again later." }
};

function setLanguage(lang) {
  const d = i18n[lang] || i18n.de;
  document.documentElement.lang = lang;
  document.getElementById('title').textContent = d.title;
  document.getElementById('intro').textContent = d.intro;
  document.getElementById('lbl-glaeubiger').textContent = d.glaeubiger;
  document.getElementById('lbl-firstname').textContent = d.firstname;
  document.getElementById('lbl-name').textContent = d.name;
  document.getElementById('lbl-strasse').textContent = d.strasse;
  document.getElementById('lbl-hausnummer').textContent = d.hausnummer;
  document.getElementById('lbl-plz').textContent = d.plz;
  document.getElementById('lbl-ort').textContent = d.ort;
  document.getElementById('lbl-country').textContent = d.country;
  document.getElementById('txt-confirm').textContent = d.confirm;
  document.getElementById('txt-privacy').textContent = d.privacy;
  document.getElementById('btn-submit').textContent = d.submit;
  document.getElementById('hint-expiry').textContent = d.expiry;
  const box = document.getElementById('ctx-box'); if (box) box.textContent = d.ctx;
  const plink = document.getElementById('privacy-link'); if (plink) { plink.textContent = d.privacyLink; plink.href = `privacy.html?lang=${lang}`; }
}

function qs(name) { const p = new URLSearchParams(location.search); return p.get(name) || ""; }

function b64urlDecode(str) {
  if (!str) return "";
  let s = String(str).replace(/[^A-Za-z0-9\-_]/g, '');
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  while (s.length % 4) s += '=';
  try { return decodeURIComponent(escape(atob(s))); } catch { return ""; }
}

function safeSet(id, value) {
  if (value !== undefined && value !== null && String(value).trim() !== "") {
    document.getElementById(id).value = value;
  }
}

function showError(id, msgKey) {
  const langEl = document.getElementById('lang').value;
  const dict = i18n[langEl] || i18n.de;
  const input = document.getElementById(id);
  const errEl = document.getElementById('err-' + id);
  if (input) input.classList.add('error-field');
  if (errEl) { errEl.textContent = dict[msgKey] || ""; errEl.style.display = 'block'; }
}

function clearError(id) {
  const input = document.getElementById(id);
  const errEl = document.getElementById('err-' + id);
  if (input) input.classList.remove('error-field');
  if (errEl) { errEl.textContent = ""; errEl.style.display = 'none'; }
}

function normalizeCountry(raw) {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "";
  if (["ch","che","schweiz","switzerland","suisse","svizzera"].includes(s)) return "CH";
  if (["li","liechtenstein","lichtenstein"].includes(s)) return "LI";
  if (["it","ita","italien","italia","italy"].includes(s)) return "IT";
  if (["de","deu","deutschland","germany","alemania"].includes(s)) return "DE";
  return "";
}

// Try to parse JSON regardless of content-type; unwrap common shapes
async function parseJsonFlexible(resp) {
  const text = await resp.text();
  try {
    const obj = JSON.parse(text);
    // unwrap array with single item
    let data = obj;
    if (Array.isArray(data) && data.length === 1) data = data[0];
    // unwrap { data: {...} } or { result: {...} }
    if (data && typeof data === 'object') {
      if ('data' in data && data.data && typeof data.data === 'object') data = data.data;
      else if ('result' in data && data.result && typeof data.result === 'object') data = data.result;
      else if ('record' in data && data.record && typeof data.record === 'object') data = data.record;
    }
    return data || {};
  } catch {
    // not JSON -> return empty
    return {};
  }
}

(async function init() {
  const lang = (qs('lang') || '').toLowerCase();
  const currentLang = ['de','it','en'].includes(lang) ? lang : 'de';
  document.getElementById('language').value = currentLang;
  document.getElementById('lang').value = currentLang;
  setLanguage(currentLang);
  document.getElementById('language').addEventListener('change', (e)=>{
    const l = e.target.value; document.getElementById('lang').value = l; setLanguage(l);
  });

  const id = qs('id');
  const token = qs('token');
  const em = qs('em');

  if (!id || !token || !em) {
    const err = (i18n[currentLang] || i18n.de).gateFail;
    const el = document.getElementById('gate-error'); el.textContent = err; el.classList.remove('hidden'); el.focus?.(); return;
  }

  let email = b64urlDecode(em).trim();
  const emailQS = qs('email');
  if (!email && emailQS) email = emailQS.trim();

  safeSet('email', email); safeSet('id', id); safeSet('token', token); safeSet('em', em);

  try {
    let data = {};
    let lastErr = '';
    // email first
    let resp = await fetch('/.netlify/functions/get_contact?email=' + encodeURIComponent(email));
    if (resp.ok) {
      data = await parseJsonFlexible(resp);
    } else {
      lastErr = `email fetch ${resp.status}`;
    }

    if (!data || !Object.keys(data).length) {
      // fallback by id
      resp = await fetch('/.netlify/functions/get_contact?id=' + encodeURIComponent(id));
      if (resp.ok) {
        data = await parseJsonFlexible(resp);
      } else {
        lastErr += ` | id fetch ${resp.status}`;
      }
    }

    if (!data || !Object.keys(data).length) {
      const el = document.getElementById('gate-error');
      el.textContent = `Verifizierung fehlgeschlagen – keine Daten (${lastErr || 'leer'})`;
      el.classList.remove('hidden'); el.scrollIntoView({behavior:'smooth', block:'center'});
      // show raw debug line (safe)
      const box = document.getElementById('ctx-box'); if (box) box.textContent = `Debug: email=${email} id=${id}`;
      return;
    }

    // tolerant read
    const pick = (...keys) => {
      for (const k of keys) {
        const v = data[k];
        if (v !== undefined && v !== null) {
          const s = String(v).trim();
          if (s) return s;
        }
      }
      return "";
    };

    const glaeubiger = pick('glaeubiger','gläubiger','Glaeubiger','Gläubiger','GLAEUBIGER','GLÄUBIGER','id','ID','Id');
    safeSet('glaeubiger', glaeubiger);
    safeSet('firstname',  pick('firstname','vorname','Firstname','Vorname','FIRSTNAME','first_name','FirstName'));
    safeSet('name',       pick('name','nachname','Name','Nachname','NAME','last_name','LastName'));
    safeSet('strasse',    pick('strasse','Strasse','street','Street','adresse','address','Address'));
    safeSet('hausnummer', pick('hausnummer','Hausnummer','HAUSNUMMER','street_no','StreetNo'));
    safeSet('plz',        pick('plz','Plz','PLZ','zip','Zip','postal','postalCode','PostalCode'));
    safeSet('ort',        pick('ort','Ort','city','City','town','Town'));
    safeSet('country',    pick('country','Country','land','Land','country_code','CountryCode'));

    // strict id check
    if (String(glaeubiger).trim() !== String(id).trim()) {
      const el = document.getElementById('gate-error');
      el.textContent = (i18n[currentLang] || i18n.de).gateFail + " (ID mismatch)";
      el.classList.remove('hidden'); el.scrollIntoView({behavior:'smooth', block:'center'});
      return;
    }

    const ok = document.getElementById('gate-ok');
    ok.textContent = (i18n[currentLang] || i18n.de).gateOk;
    ok.classList.remove('hidden');
    document.getElementById('verify-form').classList.remove('hidden');
  } catch (e) {
    const el = document.getElementById('gate-error');
    el.textContent = (i18n[currentLang] || i18n.de).gateFail + " (Netzwerk/JS)";
    el.classList.remove('hidden'); el.scrollIntoView({behavior:'smooth', block:'center'});
  }

  // Validation
  const req = ['firstname','name','strasse','hausnummer','plz','ort','country'];
  const validateField = (id) => {
    const dict = i18n[document.getElementById('lang').value] || i18n.de;
    const el = document.getElementById(id);
    clearError(id);
    let v = (el.value || "").trim();
    if (!v) { showError(id, 'errRequired'); return false; }
    if (id === 'plz') {
      v = v.replace(/\D+/g, '');
      if (el.value !== v) el.value = v;
      if (!/^\d+$/.test(v)) { showError('plz','errDigits'); return false; }
      const cc = normalizeCountry(document.getElementById('country').value);
      if (cc === 'CH' && v.length !== 4) { showError('plz','errZIPLenCH'); return false; }
      if (cc === 'LI' && v.length !== 4) { showError('plz','errZIPLenLI'); return false; }
      if (cc === 'IT' && v.length !== 5) { showError('plz','errZIPLenIT'); return false; }
      if (cc === 'DE' && v.length !== 5) { showError('plz','errZIPLenDE'); return false; }
    }
    return true;
  };

  req.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => clearError(id));
    el.addEventListener('blur',  () => validateField(id));
  });
  ['confirm','privacy'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('change', () => clearError(id));
  });

  document.getElementById('country').addEventListener('input', () => {
    const el = document.getElementById('plz');
    if (!el.value.trim()) return;
    validateField('plz');
  });

  const form = document.getElementById('verify-form');
  form.addEventListener('submit', async (e) => {
    let hasError = false;
    const must = ['firstname','name','strasse','hausnummer','plz','ort','country'];
    must.forEach(id => { if (!validateField(id)) hasError = true; });
    if (!document.getElementById('confirm').checked) { showError('confirm', 'errConfirm'); hasError = true; }
    if (!document.getElementById('privacy').checked) { showError('privacy', 'errPrivacy'); hasError = true; }
    if (hasError) { e.preventDefault(); return false; }

    e.preventDefault();
    const fd = new FormData(form);
    const body = new URLSearchParams(fd).toString();

    const errBox = document.getElementById('gate-error');
    errBox.classList.add('hidden'); errBox.textContent = '';

    try {
      const resp = await fetch(form.action, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': 'application/json',
          'X-Requested-With': 'fetch'
        },
        body
      });

      if (resp.ok) {
        const data = await resp.json().catch(() => ({}));
        if (data && data.redirect) {
          window.location.href = data.redirect;
        } else if (resp.redirected) {
          window.location.href = resp.url;
        } else {
          window.location.href = '/danke.html';
        }
        return;
      }

      let msg = (i18n[document.getElementById('lang').value] || i18n.de).errGeneric;
      if (resp.status === 403) msg = (i18n[document.getElementById('lang').value] || i18n.de).errInvalidToken;
      else if (resp.status === 410) msg = (i18n[document.getElementById('lang').value] || i18n.de).errTokenExpired;
      else if (resp.status === 409) msg = (i18n[document.getElementById('lang').value] || i18n.de).errTokenUsed;

      const detail = await resp.text().catch(()=> '');
      errBox.textContent = msg;
      if (detail && detail.length < 200) errBox.title = detail;

      errBox.classList.remove('hidden');
      errBox.scrollIntoView({behavior:'smooth', block:'center'});
      if (getComputedStyle(errBox).display === 'none') alert(msg);

    } catch (err) {
      const errBox2 = document.getElementById('gate-error');
      errBox2.textContent = (i18n[document.getElementById('lang').value] || i18n.de).errGeneric;
      errBox2.classList.remove('hidden');
      errBox2.scrollIntoView({behavior:'smooth', block:'center'});
    }
  });
})();
