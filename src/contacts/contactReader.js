/**
 * contactReader.js — Lectura y validación de contactos
 * ──────────────────────────────────────────────────────
 * Lee el CSV, valida cada fila y devuelve un array limpio.
 * Cualquier error de formato se reporta con número de fila exacto.
 *
 * CAMBIOS v3.1:
 *   - Parser CSV propio respeta RFC 4180: campos entre comillas con comas
 *     adentro ("García, María") ya no explotan el parseo.
 */

'use strict';

const fs     = require('fs');
const logger = require('../utils/logger');
const { paths, types } = require('../config/config');

const REQUIRED_COLUMNS = ['nombre', 'numero', 'tipo'];

// ── Parser CSV RFC 4180 ────────────────────────────────────────────────────────
// Soporta:
//   - Campos con comas internas entre comillas dobles: "García, María"
//   - Comillas dobles escapadas dentro de un campo: "dijo ""hola"""
//   - Saltos de línea \r\n y \n
function parseCSVLine(line) {
  const fields = [];
  let current  = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch   = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;                      // saltar la segunda comilla
      } else if (ch === '"') {
        inQuotes = false;         // fin del campo entrecomillado
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;          // inicio de campo entrecomillado
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());   // último campo
  return fields;
}

function parseCSV(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('El CSV está vacío o solo tiene encabezado.');
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());

  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) {
      throw new Error(
        `Columna requerida ausente: "${col}". Columnas encontradas: ${headers.join(', ')}`
      );
    }
  }

  return lines.slice(1).map((line, i) => {
    const values = parseCSVLine(line);
    const row    = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
    row._row = i + 2;
    return row;
  });
}

// ── Validación por fila ────────────────────────────────────────────────────────
function validateRow(contact) {
  if (!contact.nombre) {
    return `Fila ${contact._row}: falta "nombre"`;
  }

  const digits = (contact.numero || '').replace(/\D/g, '');
  if (!digits || digits.length < 10) {
    return `Fila ${contact._row}: número inválido "${contact.numero}" (mínimo 10 dígitos con código de país)`;
  }

  const tipo = contact.tipo?.trim().toLowerCase();
  if (!tipo) {
    return `Fila ${contact._row}: falta "tipo"`;
  }
  if (!types[tipo]) {
    return `Fila ${contact._row}: tipo desconocido "${contact.tipo}". Válidos: ${Object.keys(types).join(', ')}`;
  }

  return null;
}

// ── Función principal ──────────────────────────────────────────────────────────
function readContacts() {
  if (!fs.existsSync(paths.contacts)) {
    throw new Error(`Archivo de contactos no encontrado: ${paths.contacts}`);
  }

  const raw     = fs.readFileSync(paths.contacts, 'utf-8');
  const rows    = parseCSV(raw);
  const valid   = [];
  const invalid = [];

  for (const row of rows) {
    const err = validateRow(row);
    if (err) {
      logger.warn(`SKIP — ${err}`);
      invalid.push({ row, reason: err });
    } else {
      row.tipo = row.tipo.trim().toLowerCase();
      valid.push(row);
    }
  }

  return { valid, invalid, total: rows.length };
}

module.exports = { readContacts };