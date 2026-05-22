/* ============================================================
   magic-bot/js/shared.js
   Utilidades compartidas por todas las páginas
   ============================================================ */

// ── Toast ───────────────────────────────────────────────────
function toast(msg, type = 'info', ms = 3200) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { ok:'✅', err:'❌', info:'💡' };
  el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ── HTML escape ─────────────────────────────────────────────
function esc(str) {
  return String(str||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Storage helpers ──────────────────────────────────────────
const Store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  del(key) { try { localStorage.removeItem(key); } catch {} }
};

// ── Nav: mark current page active ───────────────────────────
function initNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    if (btn.dataset.page === path) btn.classList.add('active');
  });
}

// ── Status pill update ───────────────────────────────────────
function updateStatusPill() {
  const contacts = Store.get('magic_contacts', []);
  const message  = Store.get('magic_message', '');
  const dotEl    = document.getElementById('status-dot');
  const textEl   = document.getElementById('status-text');
  if (!dotEl || !textEl) return;
  if (contacts.length > 0) {
    dotEl.className = 'status-dot ready';
    textEl.textContent = `${contacts.length} contactos`;
  } else {
    dotEl.className = 'status-dot';
    textEl.textContent = 'Sin contactos';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  updateStatusPill();
});