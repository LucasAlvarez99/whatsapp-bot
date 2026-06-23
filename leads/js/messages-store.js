/**
 * messages-store.js — Modelo de datos para mensajes por categoría
 *
 * Estructura guardada en localStorage bajo 'magic_messages':
 * {
 *   cliente:        [{ id, text }, ...],
 *   cliente_nuevo:  [{ id, text }, ...],
 *   salon:          [{ id, text }, ...],
 *   empresa:        [{ id, text }, ...]
 * }
 *
 * Escalabilidad: para agregar una categoría nueva (ej. "proveedores")
 * solo hay que sumarla a CATEGORIES — el resto del sistema (CRUD,
 * selección aleatoria, anti-repetición, envío) funciona automáticamente
 * para cualquier categoría presente en el objeto.
 */

const CATEGORIES = [
  { id: 'cliente',       label: 'Clientes' },
  { id: 'cliente_nuevo',  label: 'Clientes nuevos' },
  { id: 'salon',          label: 'Salones' },
  { id: 'empresa',        label: 'Empresas' },
];

const MSG_KEY      = 'magic_messages';      // mensajes por categoría
const LASTSENT_KEY = 'magic_last_sent';     // { numero: lastMessageId } anti-repetición
const LEGACY_KEY    = 'magic_message';      // mensaje único viejo (Prioridad 2 anterior)

const MessagesStore = {

  /** Devuelve el objeto completo { categoria: [mensajes] }, migrando datos viejos si hace falta. */
  getAll() {
    let data = Store.get(MSG_KEY, null);

    if (!data) {
      data = {};
      CATEGORIES.forEach(c => { data[c.id] = []; });

      // Migración: si existía un mensaje único viejo, lo copiamos a todas las categorías
      const legacy = Store.get(LEGACY_KEY, '');
      if (legacy && legacy.trim()) {
        CATEGORIES.forEach(c => {
          data[c.id] = [{ id: Date.now() + Math.random(), text: legacy.trim() }];
        });
      }
      Store.set(MSG_KEY, data);
    }

    // Asegurar que existan todas las categorías conocidas (por si se agregan nuevas)
    let changed = false;
    CATEGORIES.forEach(c => {
      if (!Array.isArray(data[c.id])) { data[c.id] = []; changed = true; }
    });
    if (changed) Store.set(MSG_KEY, data);

    return data;
  },

  getByCategory(categoryId) {
    const all = this.getAll();
    return all[categoryId] || [];
  },

  add(categoryId, text) {
    const all = this.getAll();
    if (!all[categoryId]) all[categoryId] = [];
    const msg = { id: Date.now() + Math.random(), text: text.trim() };
    all[categoryId].push(msg);
    Store.set(MSG_KEY, all);
    return msg;
  },

  update(categoryId, id, text) {
    const all = this.getAll();
    const list = all[categoryId] || [];
    const item = list.find(m => m.id === id);
    if (!item) return false;
    item.text = text.trim();
    Store.set(MSG_KEY, all);
    return true;
  },

  remove(categoryId, id) {
    const all = this.getAll();
    if (!all[categoryId]) return false;
    all[categoryId] = all[categoryId].filter(m => m.id !== id);
    Store.set(MSG_KEY, all);
    return true;
  },

  countAll() {
    const all = this.getAll();
    return Object.values(all).reduce((sum, list) => sum + list.length, 0);
  },

  /* ── Selección aleatoria con anti-repetición consecutiva ───────── */

  _getLastSentMap() {
    return Store.get(LASTSENT_KEY, {});
  },

  _setLastSent(numero, messageId) {
    const map = this._getLastSentMap();
    map[numero] = messageId;
    Store.set(LASTSENT_KEY, map);
  },

  /**
   * Elige un mensaje al azar de la categoría, evitando repetir el último
   * mensaje enviado a ese número de contacto (si hay más de una opción).
   * Devuelve el objeto { id, text } o null si la categoría no tiene mensajes.
   */
  pickMessage(categoryId, numero) {
    const list = this.getByCategory(categoryId);
    if (!list.length) return null;
    if (list.length === 1) {
      this._setLastSent(numero, list[0].id);
      return list[0];
    }

    const lastMap = this._getLastSentMap();
    const lastId  = lastMap[numero];

    let candidates = list;
    if (lastId !== undefined) {
      const filtered = list.filter(m => m.id !== lastId);
      if (filtered.length) candidates = filtered; // hay otras opciones: nunca repetir
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    this._setLastSent(numero, chosen.id);
    return chosen;
  },
};