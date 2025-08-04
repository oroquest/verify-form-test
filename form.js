
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function submitForm() {
    const confirmed = document.getElementById('confirm').checked;
    if (!confirmed) {
        alert(i18n[currentLang]['confirm_alert']);
        return;
    }
    document.getElementById('successMsg').classList.remove('hidden');
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("glaeubigerId").value = getQueryParam("id") || "";
    document.getElementById("token").value = getQueryParam("token") || "";
});

const i18n = {
    de: {
        title: "Verifizierung Ihrer Daten",
        instruction: "Bitte bestätigen Sie Ihre Angaben für den weiteren Verlauf des Verfahrens.",
        glnr_label: "Gläubiger-Nr.",
        token_label: "Token",
        email_label: "E-Mail-Adresse",
        confirm_text: "Ich bestätige, dass die Angaben korrekt sind.",
        submit_button: "Bestätigen",
        success_msg: "Vielen Dank – Ihre Angaben wurden erfasst.",
        confirm_alert: "Bitte bestätigen Sie die Richtigkeit der Angaben."
    },
    en: {
        title: "Verification of Your Data",
        instruction: "Please confirm your information to proceed with the process.",
        glnr_label: "Creditor No.",
        token_label: "Token",
        email_label: "Email address",
        confirm_text: "I confirm that the information is correct.",
        submit_button: "Confirm",
        success_msg: "Thank you – your data has been received.",
        confirm_alert: "Please confirm the correctness of your information."
    },
    it: {
        title: "Verifica dei dati",
        instruction: "Confermi i suoi dati per procedere con il processo.",
        glnr_label: "Numero del creditore",
        token_label: "Token",
        email_label: "Indirizzo e-mail",
        confirm_text: "Confermo che le informazioni sono corrette.",
        submit_button: "Conferma",
        success_msg: "Grazie – i suoi dati sono stati ricevuti.",
        confirm_alert: "Confermi la correttezza delle informazioni."
    }
};

let currentLang = "de";

function switchLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (i18n[lang][key]) {
            el.textContent = i18n[lang][key];
        }
    });
}
