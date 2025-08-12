// Frontend Script Patch for Final Secure Build
function populateForm(data) {
  document.querySelector('[name="firstname"]').value = data.firstname || '';
  document.querySelector('[name="name"]').value = data.name || '';
  document.querySelector('[name="strasse"]').value = data.strasse || '';
  document.querySelector('[name="hausnummer"]').value = data.hausnummer || '';
  document.querySelector('[name="plz"]').value = data.plz || '';
  document.querySelector('[name="ort"]').value = data.ort || '';
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const em = params.get('em');
  const token = params.get('token');
  const id = params.get('id');

  if (!em || !token) {
    console.error("Missing parameters");
    return;
  }

  fetch(`/.netlify/functions/get_contact_secure?em=${encodeURIComponent(em)}&token=${encodeURIComponent(token)}&id=${encodeURIComponent(id || '')}`)
    .then(resp => {
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      return resp.json();
    })
    .then(data => populateForm(data))
    .catch(err => console.error("Data fetch failed:", err));
});
