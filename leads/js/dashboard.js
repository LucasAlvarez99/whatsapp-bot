/**
 * dashboard.js — Lógica del dashboard principal
 * Depende de: store.js, messages-store.js, ui.js
 */

function dashInit() {
  dashLoad();
}

function dashLoad() {
  const contacts  = Store.get('magic_contacts', []);
  const totalMsgs = MessagesStore.countAll();

  document.getElementById('d-total').textContent = contacts.length;

  const types  = [...new Set(contacts.map(c => c.tipo))].filter(Boolean);
  const dTipos = document.getElementById('d-tipos');
  dTipos.textContent  = types.length ? types.join(', ') : '—';
  dTipos.style.fontSize = types.length > 2 ? '13px' : '1.4rem';

  const dMsg = document.getElementById('d-msg');
  dMsg.textContent  = totalMsgs ? totalMsgs + ' mensajes' : '—';
  dMsg.style.fontSize = totalMsgs ? '1rem' : '1.4rem';

  const dTime = document.getElementById('d-time');
  if (contacts.length && totalMsgs) {
    const mins = Math.round(contacts.length * 10 / 60 * 60); // promedio ~10 min entre envíos
    dTime.textContent  = '~' + mins + ' min';
    dTime.style.fontSize = '1.4rem';
  } else {
    dTime.textContent = '—';
  }
}

function dashResetAll() {
  if (!confirm('¿Resetear toda la información guardada (contactos + mensajes)?')) return;
  ['magic_contacts', 'magic_contacts_all', 'magic_message', 'magic_messages', 'magic_last_sent'].forEach(k => Store.del(k));
  dashLoad();
  updateStatusPill();
  toast('Todo reseteado', 'info');
}