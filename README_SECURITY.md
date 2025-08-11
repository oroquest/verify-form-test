# Minimal Security Hardening – Install & Test

## Installation (Netlify)
1. Set the following environment variables in your Netlify site (Production + Deploy Previews if relevant):
   - `VERIFY_TEST_MODE=0`
   - `MJ_APIKEY_PUBLIC` / `MJ_APIKEY_PRIVATE` (unchanged)
2. Deploy the project (drag & drop or git). The added response headers are configured in `netlify.toml`.
3. No Template- oder Logikänderungen – Endpunkte/Parameter bleiben identisch.

## Geaenderte Dateien
- `netlify/functions/verify_check.js` (Input-Validation, timingSafeEqual, TEST_MODE aus ENV)
- `netlify/functions/get_contact.js` (CORS Allowlist statt `*`)
- `netlify/functions/verify_submit.js` (Feldlaengen/Email-Pruefung, Header-Sanitize helper)
- `netlify.toml` (Security-Header global)

## Schnelltest (manuell)
1. **Positivfall** (echter Link aus Mail):
   - Aufruf `GET /?lang=de&id=<id>&token=<token>&em=<b64url>`
   - Erwartet: `200` + Gruen-Text ✅
2. **Ungültige Eingaben**:
   - `id=abc` oder `token=%20`: Erwartet `400` (fail‑Message).
3. **Falscher Token**:
   - Gueltige `id`, aber Token vertauscht: Erwartet `400` (fail‑Message).
4. **Abgelaufen** (nur Hinweis wenn `VERIFY_TEST_MODE=1`):
   - Falls Property `token_verify_expiry` in Mailjet < jetzt: Erwartet gelbe Hinweiszeile **ohne** Block.
   - In Produktion `VERIFY_TEST_MODE=0` lassen (kein Hinweis).
5. **CORS** (get_contact):
   - Von `https://verify.sikuralife.com` laden: `200` + Daten.
   - Von Fremddomain: Header `Access-Control-Allow-Origin` zeigt Default-Domain.

## Hinweise
- `Content-Security-Policy` ist streng auf `'self'` gesetzt. Falls externe Ressourcen noetig sind (z. B. Fonts/Bilder/CDNs), bitte melden – ich lockere gezielt `img-src`/`font-src`.
- Keine PII in Logs hinzugefügt. Keine Aenderungen an Mailjet-Templates/Variablen.
