
function setLanguage(lang) {
  const i18n = {
    de: {
      title: "Bitte bestätigen Sie Ihre Daten",
      glaeubiger: "Gläubiger-Nr.",
      token: "Token",
      email: "E-Mail-Adresse",
      confirm1: "Ich bestätige, dass die angegebenen Daten korrekt sind.",
      confirm2: "Ich stimme der Verarbeitung meiner Daten im Rahmen des Konkursverfahrens der SIKURA Leben AG. i.L. gemäss DSGVO zu.",
      submit: "Absenden"
    },
    it: {
      title: "Si prega di confermare i propri dati",
      glaeubiger: "Numero del creditore",
      token: "Token",
      email: "Indirizzo e-mail",
      confirm1: "Confermo che i dati forniti sono corretti.",
      confirm2: "Acconsento al trattamento dei miei dati nell'ambito della procedura fallimentare di SIKURA Vita SA i.L. ai sensi del GDPR.",
      submit: "Invia"
    },
    en: {
      title: "Please confirm your information",
      glaeubiger: "Creditor No.",
      token: "Token",
      email: "Email address",
      confirm1: "I confirm that the provided data is correct.",
      confirm2: "I consent to the processing of my data in the context of the bankruptcy proceedings of SIKURA Life AG i.L. in accordance with GDPR.",
      submit: "Submit"
    }
  };

  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = i18n[lang][key] || el.textContent;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  document.getElementById("glaeubiger").value = params.get("id") || "";
  document.getElementById("token").value = params.get("token") || "";
});
