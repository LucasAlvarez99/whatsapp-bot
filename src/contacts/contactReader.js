/**
 * contactReader.js — Lectura y validación de contactos
 * ──────────────────────────────────────────────────────
 * Lee el CSV, valida cada fila y devuelve un array limpio.
 * Cualquier error de formato se reporta con número de fila exacto.
 */

'use strict';

const fs     = require('fs');
const logger = require('../utils/logger');
const { paths, types } = require('../config/config');

const REQUIRED_COLUMNS = ['nombre', 'numero', 'tipo'];

// ── Parseo del CSV ─────────────────────────────────────────────────────────────
function parseCSV(raw) {
  const lines = raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('El CSV está vacío o solo tiene encabezado.');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) {
      throw new Error(
        `Columna requerida ausente: "${col}". Columnas encontradas: ${headers.join(', ')}`
      );
    }
  }

  return lines.slice(1).map((line, i) => {
    const values = line.split(',').map(v => v.trim());
    const row    = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
    row._row = i + 2; // fila real en el CSV (1 = encabezado)
    return row;
  });
}

// ── Validación por fila ────────────────────────────────────────────────────────
function validateRow(contact) {
  if (!contact.nombre) {
    return `Fila ${contact._row}: falta "nombre"`;
  }

  const digits = contact.numero.replace(/\D/g, '');
  if (!digits || digits.length < 10) {
    return `Fila ${contact._row}: número inválido "${contact.numero}" (mínimo 10 dígitos)`;
  }

  const tipo = contact.tipo?.trim().toLowerCase();
  if (!tipo) {
    return `Fila ${contact._row}: falta "tipo"`;
  }
  if (!types[tipo]) {
    return `Fila ${contact._row}: tipo desconocido "${contact.tipo}". Válidos: ${Object.keys(types).join(', ')}`;
  }

  return null; // sin error
}

// ── Función principal ──────────────────────────────────────────────────────────
function readContacts() {
  if (!fs.existsSync(paths.contacts)) {
    throw new Error(`Archivo de contactos no encontrado: ${paths.contacts}`);
  }

  const raw      = fs.readFileSync(paths.contacts, 'utf-8');
  const rows     = parseCSV(raw);
  const valid    = [];
  const invalid  = [];

  for (const row of rows) {
    const err = validateRow(row);
    if (err) {
      logger.warn(`SKIP — ${err}`);
      invalid.push({ row, reason: err });
    } else {
      // Normalizar tipo a minúsculas
      row.tipo = row.tipo.trim().toLowerCase();
      valid.push(row);
    }
  }

  return { valid, invalid, total: rows.length };
}

module.exports = { readContacts };
