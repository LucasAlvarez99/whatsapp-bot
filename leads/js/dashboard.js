/**
 * dashboard.js — Lógica del dashboard principal
 * Depende de: store.js, ui.js
 */

function dashInit() {
  dashLoad();
}

function dashLoad() {
  const contacts = Store.get('magic_contacts', []);
  const message  = Store.get('magic_message',  '');

  document.getElementById('d-total').textContent = contacts.length;

  const types = [...new Set(contacts.map(c => c.tipo))].filter(Boolean);
  const dTipos = document.getElementById('d-tipos');
  dTipos.textContent  = types.length ? types.join(', ') : '—';
  dTipos.style.fontSize = types.length ? '13px' : '22px';

  const dMsg = document.getElementById('d-msg');
  dMsg.textContent  = message ? message.length + ' chars' : '—';
  dMsg.style.fontSize = message ? '14px' : '22px';

  const dTime = document.getElementById('d-time');
  if (contacts.length && message) {
    const mins = Math.round(contacts.length * 31.5 / 60);
    dTime.textContent  = '~' + mins + ' min';
    dTime.style.fontSize = '22px';
  } else {
    dTime.textContent = '—';
  }
}

function dashResetAll() {
  if (!confirm('¿Resetear toda la información guardada (contactos + mensaje)?')) return;
  ['magic_contacts', 'magic_contacts_all', 'magic_message'].forEach(k => Store.del(k));
  dashLoad();
  updateStatusPill();
  toast('Todo reseteado', 'info');
}