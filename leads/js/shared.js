/* ============================================================
   magic-bot/js/shared.js
   Utilidades compartidas por todas las páginas

   CAMBIOS v3.1:
   - Store.set muestra aviso cuando localStorage no está disponible
     (modo incógnito, otro navegador) en lugar de fallar silenciosamente.
   - Agregado Store.isAvailable() para detectar el problema al cargar.
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
  const icons = { ok: '✅', err: '❌', info: '💡' };
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ── HTML escape ─────────────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Storage helpers ──────────────────────────────────────────
const Store = {
  isAvailable() {
    try {
      localStorage.setItem('__test__', '1');
      localStorage.removeItem('__test__');
      return true;
    } catch {
      return false;
    }
  },
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      // Puede fallar en modo incógnito o si el storage está lleno
      console.warn('localStorage no disponible:', err.message);
      return false;
    }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch {}
  }
};

// ── Nav: marcar página activa ────────────────────────────────
function initNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    if (btn.dataset.page === currentPage) btn.classList.add('active');
  });
}

// ── Status pill update ───────────────────────────────────────
function updateStatusPill() {
  const contacts = Store.get('magic_contacts', []);
  const dotEl    = document.getElementById('status-dot');
  const textEl   = document.getElementById('status-text');
  if (!dotEl || !textEl) return;
  if (contacts.length > 0) {
    dotEl.className    = 'status-dot ready';
    textEl.textContent = `${contacts.length} contactos`;
  } else {
    dotEl.className    = 'status-dot';
    textEl.textContent = 'Sin contactos';
  }
}

// ── Aviso de localStorage no disponible ─────────────────────
function checkStorageAvailability() {
  if (!Store.isAvailable()) {
    const bar = document.createElement('div');
    bar.style.cssText = `
      position: fixed; top: 58px; left: 0; right: 0; z-index: 200;
      background: rgba(224,82,82,0.12); border-bottom: 1px solid rgba(224,82,82,0.4);
      padding: 8px 20px; font-size: 12px; color: #e8a8a8;
      font-family: 'JetBrains Mono', monospace; text-align: center;
    `;
    bar.textContent = '⚠ El almacenamiento local no está disponible (modo incógnito u otro navegador). Los datos no se guardarán entre sesiones.';
    document.body.appendChild(bar);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  updateStatusPill();
  checkStorageAvailability();
});
