// script.js (fragment) – secure contact fetch with token binding
function b64urlDecode(input) {
  if (!input) return '';
  let s = String(input).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  try { return atob(s); } catch { return ''; }
}

function parseParams() {
  const p = new URLSearchParams(location.search);
  return {
    lang: (p.get('lang') || 'de'),
    id:   (p.get('id') || ''),
    token:(p.get('token') || ''),
    em:   (p.get('em') || '')
  };
}

async function loadContactSecure() {
  const params = parseParams();
  const email = b64urlDecode(params.em);
  if (!email) { console.warn('[contact] no email param'); return; }

  const url = `/.netlify/functions/get_contact?email=${encodeURIComponent(email)}&token=${encodeURIComponent(params.token)}&id=${encodeURIComponent(params.id)}`;
  const resp = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (!resp.ok) {
    console.warn('[contact] fetch failed', resp.status);
    return;
  }
  const data = await resp.json();
  console.log('[contact] Data received:', data);
  // populate form fields
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('glaeubiger', data.glaeubiger);
  set('firstname',  data.firstname);
  set('name',       data.name);
  set('strasse',    data.strasse);
  set('hausnummer', data.hausnummer);
  set('plz',        data.plz);
  set('ort',        data.ort);
  set('country',    data.country);
}

document.addEventListener('DOMContentLoaded', loadContactSecure);
