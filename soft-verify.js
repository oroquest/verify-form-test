
// soft-verify.js
// Non-blocking verification: suppress modal alerts for verify_check failure
(function() {
  const FAIL_TEXTS = new Set([
    "❌ Ungültiger oder abgelaufener Verifizierungslink.",
    "❌ Link di verifica non valido o scaduto.",
    "❌ Invalid or expired verification link.",
    "Ungültiger Link oder abgelaufener Zugriff. Bitte verwenden Sie den offiziellen Zugang."
  ]);

  // Filter intrusive alerts only for known verify messages
  const _alert = window.alert;
  window.alert = function(msg) {
    try {
      if (typeof msg === "string" && FAIL_TEXTS.has(msg.trim())) {
        console.warn("[soft-verify] suppressed alert:", msg);
        return;
      }
    } catch (_) {}
    return _alert.apply(window, arguments);
  };

  function getQS() {
    const p = new URLSearchParams(location.search);
    return {
      lang: p.get("lang") || "de",
      id: p.get("id") || "",
      token: p.get("token") || "",
      em: p.get("em") || ""
    };
  }

  async function softVerifyLink() {
    try {
      const params = getQS();
      const qs = new URLSearchParams(params).toString();
      const resp = await fetch(`/.netlify/functions/verify_check?${qs}`, {
        method: "GET",
        credentials: "omit",
        cache: "no-store"
      });
      if (!resp.ok) {
        console.warn("[soft-verify] verify_check soft-fail:", resp.status);
      } else {
        console.info("[soft-verify] verify_check OK");
      }
    } catch (e) {
      console.warn("[soft-verify] verify_check error:", e);
    }
  }

  // Run after DOM is ready, non-blocking
  document.addEventListener("DOMContentLoaded", softVerifyLink);
})();
