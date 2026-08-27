'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { paths } = require('../config/config');

const FILE = paths.progress;

// Identifica una "campaña" (misma lista de contactos + mismo mensaje por
// contacto, en el mismo orden) para poder detectar si un progreso guardado
// corresponde a la tanda que se está por lanzar.
function campaignHash(contacts) {
  const raw = contacts.map(c => c.numero + '|' + c.mensaje).join('\n');
  return crypto.createHash('sha1').update(raw).digest('hex');
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return null; // no hay checkpoint, o está corrupto/ilegible — arrancamos de cero
  }
}

function save(state) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
  } catch {
    // El filesystem puede ser de solo lectura en algunos hosts (p. ej. Vercel);
    // si falla, seguimos sin checkpoint en vez de tirar abajo el envío.
  }
}

function clear() {
  try { fs.unlinkSync(FILE); } catch { /* ya no existía */ }
}

module.exports = { campaignHash, load, save, clear };
