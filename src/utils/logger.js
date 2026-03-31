/**
 * logger.js — Logging centralizado
 * ──────────────────────────────────
 * Escribe en consola y en archivo de log.
 * Niveles: INFO | OK | WARN | ERROR | CTRL | FATAL | DONE
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { paths } = require('../config/config');

// Colores ANSI para consola
const COLORS = {
  INFO:  '\x1b[37m',   // blanco
  OK:    '\x1b[32m',   // verde
  WARN:  '\x1b[33m',   // amarillo
  ERROR: '\x1b[31m',   // rojo
  CTRL:  '\x1b[36m',   // cyan
  FATAL: '\x1b[35m',   // magenta
  DONE:  '\x1b[32m',   // verde
  RESET: '\x1b[0m',
};

function ensureLogDir() {
  const dir = path.dirname(paths.log);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const plain     = `[${timestamp}] [${level.padEnd(5)}] ${message}`;
  const colored   = `${COLORS[level] || ''}${plain}${COLORS.RESET}`;

  console.log(colored);

  try {
    ensureLogDir();
    fs.appendFileSync(paths.log, plain + '\n');
  } catch (err) {
    console.error('⚠ No se pudo escribir en el log:', err.message);
  }
}

// Shortcuts por nivel
module.exports = {
  info:  (msg) => log(msg, 'INFO'),
  ok:    (msg) => log(msg, 'OK'),
  warn:  (msg) => log(msg, 'WARN'),
  error: (msg) => log(msg, 'ERROR'),
  ctrl:  (msg) => log(msg, 'CTRL'),
  fatal: (msg) => log(msg, 'FATAL'),
  done:  (msg) => log(msg, 'DONE'),
  raw:   log,
};
