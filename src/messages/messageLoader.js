/**
 * messageLoader.js — Carga y personalización de plantillas
 * ──────────────────────────────────────────────────────────
 * Lee los .txt de /mensajes y reemplaza variables {campo}
 * con los datos del contacto.
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const logger = require('../utils/logger');
const { paths, types } = require('../config/config');

// ── Carga de todas las plantillas ──────────────────────────────────────────────
function loadTemplates() {
  if (!fs.existsSync(paths.messages)) {
    throw new Error(`Carpeta de mensajes no encontrada: ${paths.messages}`);
  }

  const templates = {};

  for (const [tipo, filename] of Object.entries(types)) {
    const fullPath = path.join(paths.messages, filename);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Archivo de mensaje faltante: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8').trim();

    if (!content) {
      throw new Error(`El archivo de mensaje está vacío: ${fullPath}`);
    }

    templates[tipo] = content;
    logger.info(`📄 Plantilla cargada: ${filename}`);
  }

  return templates;
}

// ── Personalización ────────────────────────────────────────────────────────────
// Reemplaza {variable} con el valor del contacto.
// Si el campo no existe o está vacío, deja el placeholder tal cual.
function personalize(template, contact) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = contact[key];
    return value !== undefined && value !== '' ? value : match;
  });
}

module.exports = { loadTemplates, personalize };
