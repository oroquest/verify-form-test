
let currentLang = "de";

function setLanguage(lang) {
  currentLang = lang;
  const i18n = {
    de: {
      title: "Bitte bestätigen Sie Ihre Daten",
      glaeubiger: "Gläubiger-Nr.",
      token: "Token",
      email: "E-Mail-Adresse",
      adresse: "Aktuelle Adresse",
      confirm1: "Ich bestätige, dass die angegebenen Daten korrekt sind.",
      confirm2: "Ich stimme der Verarbeitung meiner Daten im Rahmen des Konkursverfahrens der SIKURA Leben AG. i.L. gemäss DSGVO zu.",
      submit: "Absenden"
    },
    it: {
      title: "Si prega di confermare i propri dati",
      glaeubiger: "Numero del creditore",
      token: "Token",
      email: "Indirizzo e-mail",
      adresse: "Indirizzo attuale",
      confirm1: "Confermo che i dati forniti sono corretti.",
      confirm2: "Acconsento al trattamento dei miei dati nell'ambito della procedura fallimentare di SIKURA Vita SA i.L. ai sensi del GDPR.",
      submit: "Invia"
    },
    en: {
      title: "Please confirm your information",
      glaeubiger: "Creditor No.",
      token: "Token",
      email: "Email address",
      adresse: "Current Address",
      confirm1: "I confirm that the provided data is correct.",
      confirm2: "I consent to the processing of my data in the context of the bankruptcy proceedings of SIKURA Life AG i.L. in accordance with GDPR.",
      submit: "Submit"
    }
  };

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = i18n[lang][key] || el.textContent;
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const glaeubigerId = params.get("id") || "";
  const token = params.get("token") || "";

  document.getElementById("glaeubiger").value = glaeubigerId;
  document.getElementById("token").value = token;

  try {
    const response = await fetch(`/.netlify/functions/verify?id=${glaeubigerId}&token=${token}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Ungültiger Zugriff");
    }

    document.getElementById("name").value = result.name || "";
    document.getElementById("adresse").value = result.adresse || "";

    setLanguage(currentLang);

  } catch (error) {
    alert("Ungültiger Link oder abgelaufener Zugriff. Bitte verwenden Sie den offiziellen Zugang.");
    const form = document.getElementById("verify-form");
    if (form) form.style.display = "none";
  }
});

document.getElementById("verify-form").addEventListener("submit", function(event) {
  const email = document.getElementById("email").value.trim();
  const adresse = document.getElementById("adresse").value.trim();
  const confirm = document.getElementById("confirm").checked;
  const privacy = document.getElementById("privacy").checked;

  const blockedDomains = ["mailrez.com", "yopmail.com", "tempmail.com", "sharklasers.com"];
  const emailDomain = email.split("@")[1]?.toLowerCase() || "";

  if (blockedDomains.includes(emailDomain)) {
    alert("Bitte verwenden Sie eine gültige, persönliche E-Mail-Adresse.");
    event.preventDefault();
    return;
  }

  const messages = {
    de: {
      email: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      adresse: "Bitte geben Sie Ihre Adresse ein.",
      confirm: "Bitte bestätigen Sie die Richtigkeit der Angaben.",
      privacy: "Bitte stimmen Sie der Datenschutzvereinbarung zu."
    },
    en: {
      email: "Please enter a valid email address.",
      adresse: "Please enter your address.",
      confirm: "Please confirm the accuracy of your information.",
      privacy: "Please accept the privacy agreement."
    },
    it: {
      email: "Si prega di inserire un indirizzo e-mail valido.",
      adresse: "Si prega di inserire l'indirizzo.",
      confirm: "Confermi la correttezza delle informazioni.",
      privacy: "Accetti l'informativa sulla privacy."
    }
  };

  const m = messages[currentLang];
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!regex.test(email)) { alert(m.email); event.preventDefault(); return; }
  if (!adresse) { alert(m.adresse); event.preventDefault(); return; }
  if (!confirm) { alert(m.confirm); event.preventDefault(); return; }
  if (!privacy) { alert(m.privacy); event.preventDefault(); return; }
});



/* --- Moved from inline HTML (CSP cleanup) --- */
const i18n = {
      de: {
        title: "Bitte bestätigen Sie Ihre Adresse",
        intro: "Felder sind vorbefüllt und können bei Bedarf aktualisiert werden.",
        ctx: "Bitte geben Sie Ihre vollständigen und korrekten Adressdaten ein.",
        glaeubiger: "Gläubiger‑Nr.",
        firstname: "Vorname",
        name: "Nachname",
        strasse: "Strasse",
        hausnummer: "Nr.",
        plz: "PLZ",
        ort: "Ort",
        country: "Land",
        hintGlaeubiger: "Nummer des Gläubigers.",
        hintFirst: "Vorname gemäss Personalausweis.",
        hintName: "Nachname gemäss Personalausweis.",
        hintStrasse: "Strassenname gemäss offizieller Adresse ohne Hausnummer.",
        hintHausnummer: "Hausnummer gemäss offizieller Adresse.",
        hintZIP: "Postleitzahl gemäss Land (CH/LI = 4 Ziffern, DE/IT = 5 Ziffern).",
        hintOrt: "Ort gemäss offizieller Adresse.",
        hintCountry: "Land gemäss offizieller Adresse.",
        confirm: "Ich bestätige, dass die angegebenen Daten korrekt sind.",
        privacy: "Ich stimme der Verarbeitung meiner Daten gemäss DSGVO zu.",
        privacyLink: "Datenschutzhinweise",
        submit: "Absenden",
        errRequired: "Pflichtfeld – bitte ausfüllen.",
        errDigits: "Es sind nur Ziffern erlaubt.",
        errConfirm: "Bitte bestätigen Sie die Richtigkeit der Angaben.",
        errPrivacy: "Bitte stimmen Sie der DSGVO‑Verarbeitung zu.",
        errZIPLenCH: "PLZ muss 4 Ziffern haben (CH).",
        errZIPLenLI: "PLZ muss 4 Ziffern haben (LI).",
        errZIPLenIT: "PLZ muss 5 Ziffern haben (IT).",
        errZIPLenDE: "PLZ muss 5 Ziffern haben (DE).",
        expiry: "Hinweis: Der Bestätigungslink ist aus Sicherheitsgründen 7 Tage gültig.",
        gateFail: "Verifizierung fehlgeschlagen. Der Link ist ungültig oder abgelaufen.",
        gateOk: "Link geprüft – Formular freigeschaltet.",
        errInvalidToken: "Link ungültig oder bereits verwendet.",
        errTokenExpired: "Link abgelaufen.",
        errTokenUsed: "Link bereits verwendet.",
        errGeneric: "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut."
      },
      it: {
        title: "Per favore conferma il tuo indirizzo",
        intro: "I campi sono precompilati e possono essere aggiornati se necessario.",
        ctx: "Si prega di inserire i dati completi e corretti dell'indirizzo.",
        glaeubiger: "Numero del creditore",
        firstname: "Nome",
        name: "Cognome",
        strasse: "Via",
        hausnummer: "Nr.",
        plz: "CAP",
        ort: "Città",
        country: "Paese",
        hintGlaeubiger: "Numero del creditore come da comunicazione.",
        hintFirst: "Nome secondo la carta d'identità.",
        hintName: "Cognome secondo la carta d'identità.",
        hintStrasse: "Nome della via senza numero civico.",
        hintHausnummer: "Numero civico secondo l'indirizzo ufficiale.",
        hintZIP: "CAP secondo il paese (CH/LI = 4 cifre, DE/IT = 5 cifre).",
        hintOrt: "Località secondo l'indirizzo ufficiale.",
        hintCountry: "Paese secondo l'indirizzo ufficiale.",
        confirm: "Confermo che i dati forniti sono corretti.",
        privacy: "Acconsento al trattamento dei miei dati secondo il GDPR.",
        privacyLink: "Informativa privacy",
        submit: "Invia",
        errRequired: "Campo obbligatorio – compila per favore.",
        errDigits: "Sono consentite solo cifre.",
        errConfirm: "Conferma che i dati sono corretti.",
        errPrivacy: "Fornisci il consenso GDPR.",
        errZIPLenCH: "Il CAP deve avere 4 cifre (CH).",
        errZIPLenLI: "Il CAP deve avere 4 cifre (LI).",
        errZIPLenIT: "Il CAP deve avere 5 cifre (IT).",
        errZIPLenDE: "Il CAP deve avere 5 cifre (DE).",
        expiry: "Nota: Per motivi di sicurezza il link è valido per 7 giorni.",
        gateFail: "Verifica non riuscita. Il link non è valido o è scaduto.",
        gateOk: "Link verificato – modulo abilitato.",
        errInvalidToken: "Link non valido o già utilizzato.",
        errTokenExpired: "Link scaduto.",
        errTokenUsed: "Link già utilizzato.",
        errGeneric: "Si è verificato un errore. Riprova più tardi."
      },
      en: {
        title: "Please confirm your address",
        intro: "Fields are pre-filled and can be updated if needed.",
        ctx: "Please enter your complete and correct address details.",
        glaeubiger: "Creditor No.",
        firstname: "First name",
        name: "Last name",
        strasse: "Street",
        hausnummer: "No.",
        plz: "ZIP",
        ort: "City/Town",
        country: "Country",
        hintGlaeubiger: "Creditor number as stated in the letter.",
        hintFirst: "First name according to identity card.",
        hintName: "Last name according to identity card.",
        hintStrasse: "Street name without house number.",
        hintHausnummer: "House number as per official address.",
        hintZIP: "ZIP code according to country (CH/LI = 4 digits, DE/IT = 5 digits).",
        hintOrt: "City/Town as per official address.",
        hintCountry: "Country as per official address.",
        confirm: "I confirm that the information provided is correct.",
        privacy: "I consent to the processing of my data under GDPR.",
        privacyLink: "Privacy notice",
        submit: "Submit",
        errRequired: "Required field — please fill in.",
        errDigits: "Digits only.",
        errConfirm: "Please confirm the information is correct.",
        errPrivacy: "Please provide GDPR consent.",
        errZIPLenCH: "ZIP must be 4 digits (CH).",
        errZIPLenLI: "ZIP must be 4 digits (LI).",
        errZIPLenIT: "ZIP must be 5 digits (IT).",
        errZIPLenDE: "ZIP must be 5 digits (DE).",
        expiry: "Note: For security, the confirmation link is valid for 7 days.",
        gateFail: "Verification failed. The link is invalid or expired.",
        gateOk: "Link verified – form enabled.",
        errInvalidToken: "Link invalid or already used.",
        errTokenExpired: "Link expired.",
        errTokenUsed: "Link already used.",
        errGeneric: "An error occurred. Please try again later."
      }
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
      const map = [
        ['hint-glaeubiger','hintGlaeubiger'],
        ['hint-firstname','hintFirst'],
        ['hint-name','hintName'],
        ['hint-strasse','hintStrasse'],
        ['hint-hausnummer','hintHausnummer'],
        ['hint-plz','hintZIP'],
        ['hint-ort','hintOrt'],
        ['hint-country','hintCountry']
      ];
      for (const [id,key] of map) {
        const el = document.getElementById(id);
        if (el) el.textContent = d[key] || '';
      }
      const plink = document.getElementById('privacy-link');
      if (plink) {
        plink.textContent = d.privacyLink;
        plink.href = `privacy.html?lang=${lang}`;
      }
    }

    function qs(name) {
      const p = new URLSearchParams(location.search);
      return p.get(name) || "";
    }

    function b64urlDecode(str) {
      try {
        let s = str.replace(/-/g,'+').replace(/_/g,'/');
        while (s.length % 4 !== 0) s += '=';
        return decodeURIComponent(escape(atob(s)));
      } catch (e) {
        try {
          let s = str.replace(/-/g,'+').replace(/_/g,'/');
          while (s.length % 4 !== 0) s += '=';
          return atob(s);
        } catch (err) { return ""; }
      }
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

    // Harden PLZ
    document.addEventListener('DOMContentLoaded', () => {
      const plzEl = document.getElementById('plz');

      plzEl.addEventListener('beforeinput', (e) => {
        if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') return;
        if (typeof e.data === 'string' && /\D/.test(e.data)) e.preventDefault();
      });

      plzEl.addEventListener('input', (e) => {
        const cleaned = e.target.value.replace(/\D+/g, '');
        if (e.target.value !== cleaned) e.target.value = cleaned;
      });

      plzEl.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const onlyDigits = String(text).replace(/\D+/g, '');
        document.execCommand('insertText', false, onlyDigits);
      });

      plzEl.addEventListener('drop', (e) => {
        e.preventDefault();
        const text = (e.dataTransfer && e.dataTransfer.getData('text')) || '';
        const onlyDigits = String(text).replace(/\D+/g, '');
        if (onlyDigits) plzEl.value = plzEl.value + onlyDigits;
        plzEl.dispatchEvent(new Event('input', { bubbles: true }));
      });

      plzEl.addEventListener('blur', () => {
        const cleaned = plzEl.value.replace(/\D+/g, '');
        if (plzEl.value !== cleaned) plzEl.value = cleaned;
      });
    });

    function normalizeCountry(raw) {
      const s = (raw || "").trim().toLowerCase();
      if (!s) return "";
      if (["ch","che","schweiz","switzerland","suisse","svizzera"].includes(s)) return "CH";
      if (["li","liechtenstein","lichtenstein"].includes(s)) return "LI";
      if (["it","ita","italien","italia","italy"].includes(s)) return "IT";
      if (["de","deu","deutschland","germany","alemania"].includes(s)) return "DE";
      return "";
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

      // URL-Params
      const id = qs('id');
      const token = qs('token');
      const em = qs('em');

      if (!id || !token || !em) {
        const err = i18n[currentLang].gateFail;
        const el = document.getElementById('gate-error'); el.textContent = err; el.classList.remove('hidden'); el.focus?.(); return;
      }

      const email = b64urlDecode(em).trim() || (qs('email') || "");
      safeSet('email', email); safeSet('id', id); safeSet('token', token); safeSet('em', em);

      try {
        const resp = await fetch('/.netlify/functions/get_contact?id=' + encodeURIComponent(email));
        if (!resp.ok) throw new Error('lookup failed');
        const data = await resp.json();

        const glaeubiger = (data.glaeubiger ?? data['gläubiger'] ?? "").toString().trim();
        safeSet('glaeubiger', glaeubiger);
        ['firstname','name','strasse','hausnummer','plz','ort','country'].forEach(k => safeSet(k, data[k]));

        if (glaeubiger !== id) {
          const el = document.getElementById('gate-error');
          el.textContent = i18n[currentLang].gateFail + " (ID mismatch)";
          el.classList.remove('hidden'); el.scrollIntoView({behavior:'smooth', block:'center'});
          return;
        }

        const ok = document.getElementById('gate-ok');
        ok.textContent = i18n[currentLang].gateOk;
        ok.classList.remove('hidden');
        document.getElementById('verify-form').classList.remove('hidden');
      } catch (e) {
        const el = document.getElementById('gate-error');
        el.textContent = i18n[currentLang].gateFail;
        el.classList.remove('hidden'); el.scrollIntoView({behavior:'smooth', block:'center'});
      }

      // Live-clear + blur validation
      const req = ['firstname','name','strasse','hausnummer','plz','ort','country'];
      req.forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('input', () => clearError(id));
        el.addEventListener('blur',  () => validateField(id));
      });
      ['confirm','privacy'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('change', () => clearError(id));
      });

      // Revalidate PLZ on country change
      document.getElementById('country').addEventListener('input', () => {
        const el = document.getElementById('plz');
        if (!el.value.trim()) return;
        validateField('plz');
      });

      // Submit via AJAX
      const form = document.getElementById('verify-form');
      form.addEventListener('submit', async (e) => {
        let hasError = false;
        const must = ['firstname','name','strasse','hausnummer','plz','ort','country'];
        must.forEach(id => { if (!validateField(id)) hasError = true; });
        if (!document.getElementById('confirm').checked) { showError('confirm', 'errConfirm'); hasError = true; }
        if (!document.getElementById('privacy').checked) { showError('privacy', 'errPrivacy'); hasError = true; }
        if (hasError) { e.preventDefault(); return false; }

        e.preventDefault();
        const dict = i18n[document.getElementById('lang').value] || i18n.de;

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

          let msg = dict.errGeneric;
          if (resp.status === 403) msg = dict.errInvalidToken;
          else if (resp.status === 410) msg = dict.errTokenExpired;
          else if (resp.status === 409) msg = dict.errTokenUsed;

          // Try to append server detail for debugging (hidden for users, via title attr)
          const detail = await resp.text().catch(()=>'');
          errBox.textContent = msg;
          if (detail && detail.length < 200) errBox.title = detail;

          errBox.classList.remove('hidden');
          errBox.scrollIntoView({behavior:'smooth', block:'center'});

          // Fallback safety net
          if (getComputedStyle(errBox).display === 'none') {
            alert(msg);
          }

        } catch (err) {
          const errBox2 = document.getElementById('gate-error');
          errBox2.textContent = (i18n[document.getElementById('lang').value] || i18n.de).errGeneric;
          errBox2.classList.remove('hidden');
          errBox2.scrollIntoView({behavior:'smooth', block:'center'});
        }
      });
    })();

    function validateField(id) {
      const langEl = document.getElementById('lang').value;
      const dict = i18n[langEl] || i18n.de;
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
    }
function qs(name) { const p = new URLSearchParams(location.search); return p.get(name) || ""; }
    function setVisible(lang) {
      var ids = ['de','it','en'];
      ids.forEach(function(k) {
        var el = document.getElementById('lang-' + k);
        if (el) el.style.display = (k===lang ? 'block' : 'none');
      });
      document.documentElement.lang = lang;
      var url = new URL(location.href);
      url.searchParams.set('lang', lang);
      history.replaceState({}, '', url);
    }
    (function init() {
      var select = document.getElementById('language');
      var lang = (qs('lang')||'de').toLowerCase();
      var current = ['de','it','en'].includes(lang) ? lang : 'de';
      select.value = current;
      setVisible(current);
      select.addEventListener('change', function(e) { setVisible(e.target.value); });
    })();
