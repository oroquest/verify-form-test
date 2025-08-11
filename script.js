
// script.js
// Combined contact loading and soft verification logic

(function() {
  // Utility to parse query params
  function getQS() {
    const p = new URLSearchParams(location.search);
    return {
      lang: p.get("lang") || "de",
      id: p.get("id") || "",
      token: p.get("token") || "",
      em: p.get("em") || ""
    };
  }

  // Base64URL decode function
  function base64UrlDecode(str) {
    try {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      const pad = str.length % 4;
      if (pad) {
        str += '='.repeat(4 - pad);
      }
      return decodeURIComponent(escape(atob(str)));
    } catch (e) {
      console.error("Base64URL decode failed:", e);
      return "";
    }
  }

  // Load contact data
  async function loadContact(params) {
    try {
      const decodedEmail = base64UrlDecode(params.em);
      if (!decodedEmail) {
        console.warn("[contact] No email decoded from URL");
        return;
      }
      const url = `/.netlify/functions/get_contact?email=${encodeURIComponent(decodedEmail)}`;
      const resp = await fetch(url, { method: "GET", cache: "no-store" });
      if (resp.ok) {
        const data = await resp.json();
        console.info("[contact] Data received:", data);
        // Fill form fields by name if data keys match
        for (const [key, value] of Object.entries(data)) {
          const el = document.querySelector(`[name="${key}"]`);
          if (el) {
            el.value = value;
          }
        }
      } else {
        console.warn("[contact] get_contact failed:", resp.status);
      }
    } catch (err) {
      console.error("[contact] Error:", err);
    }
  }

  // Soft verify check (non-blocking)
  async function softVerifyLink(params) {
    const FAIL_TEXTS = new Set([
      "❌ Ungültiger oder abgelaufener Verifizierungslink.",
      "❌ Link di verifica non valido o scaduto.",
      "❌ Invalid or expired verification link.",
      "Ungültiger Link oder abgelaufener Zugriff. Bitte verwenden Sie den offiziellen Zugang."
    ]);
    // Override alert to suppress known failure messages
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
    try {
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

  // On DOM ready, run both tasks
  document.addEventListener("DOMContentLoaded", () => {
    const params = getQS();
    loadContact(params);
    softVerifyLink(params);
  });

})();
