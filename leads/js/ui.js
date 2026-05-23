/**
 * ui.js — Helpers de interfaz reutilizables
 * Toast, escape HTML, nav activa, status pill
 */

// ── HTML escape ──────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Toast ────────────────────────────────────────────────────
function toast(msg, type = 'info', ms = 3200) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { ok: '✅', err: '❌', info: '💡' };
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = '<span>' + (icons[type] ?? 'ℹ️') + '</span><span>' + esc(msg) + '</span>';
  container.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ── Nav activa ───────────────────────────────────────────────
function initNav() {
  const page = window.location.pathname.split('/').pop() || '';
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}

// ── Status pill ──────────────────────────────────────────────
function updateStatusPill() {
  const contacts = Store.get('magic_contacts', []);
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!dot || !text) return;
  if (contacts.length > 0) {
    dot.className = 'status-dot ready';
    text.textContent = contacts.length + ' contactos';
  } else {
    dot.className = 'status-dot';
    text.textContent = 'Sin contactos';
  }
}

// ── Aviso si localStorage no disponible ──────────────────────
function checkStorage() {
  if (!Store.available()) {
    const bar = document.createElement('div');
    bar.className = 'storage-warning';
    bar.textContent = '⚠ Almacenamiento local no disponible — los datos no se guardarán entre sesiones.';
    document.body.insertBefore(bar, document.body.firstChild);
  }
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  updateStatusPill();
  checkStorage();
});