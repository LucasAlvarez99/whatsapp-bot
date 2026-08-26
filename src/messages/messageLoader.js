'use strict';

const fs   = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { paths, types } = require('../config/config');

function loadTemplates() {
  if (!fs.existsSync(paths.messages)) {
    throw new Error(`Carpeta de mensajes no encontrada: ${paths.messages}`);
  }

  const templates = {};

  for (const [tipo, filename] of Object.entries(types)) {
    const fullPath = path.join(paths.messages, filename);
    if (!fs.existsSync(fullPath)) throw new Error(`Archivo faltante: ${fullPath}`);
    const content = fs.readFileSync(fullPath, 'utf-8').trim();
    if (!content) throw new Error(`Archivo vacío: ${fullPath}`);
    templates[tipo] = content;
    logger.info(`📄 Plantilla cargada: ${filename}`);
  }

  return templates;
}

const { personalize } = require('../utils/personalize');

module.exports = { loadTemplates, personalize };
