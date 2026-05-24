/**
 * store.js — Manejo de estado global via localStorage
 */

const Store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn('[Store] write failed:', err.message);
      return false;
    }
  },

  del(key) {
    try { localStorage.removeItem(key); } catch {}
  },

  available() {
    try {
      localStorage.setItem('__ping__', '1');
      localStorage.removeItem('__ping__');
      return true;
    } catch {
      return false;
    }
  }
};
