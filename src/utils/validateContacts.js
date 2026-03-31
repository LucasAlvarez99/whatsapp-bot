/**
 * validateContacts.js — Validación standalone
 * ─────────────────────────────────────────────
 * Ejecutar con: npm run validate
 *
 * Muestra un reporte completo de qué contactos son válidos,
 * cuáles tienen errores y por qué — SIN abrir el navegador.
 */

'use strict';

const { readContacts } = require('../contacts/contactReader');
const { loadTemplates, personalize } = require('../messages/messageLoader');
const logger = require('./logger');

const TYPE_ICONS = {
  cliente:       '🧑',
  cliente_nuevo: '🆕',
  salon:         '🏛️ ',
  empresa:       '🏢',
};

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  🔍 Validación de Contactos y Mensajes');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

try {
  // 1. Leer y validar contactos
  const { valid, invalid, total } = readContacts();

  console.log(`\n📋 Total de filas en CSV: ${total}`);
  console.log(`   ✅ Válidos:  ${valid.length}`);
  console.log(`   ❌ Inválidos: ${invalid.length}\n`);

  if (invalid.length > 0) {
    console.log('── Errores encontrados ──────────────────────');
    invalid.forEach(({ reason }) => logger.warn(reason));
    console.log('');
  }

  // 2. Verificar plantillas
  const templates = loadTemplates();
  console.log('\n── Plantillas cargadas ──────────────────────');
  Object.keys(templates).forEach(tipo =>
    console.log(`   ${TYPE_ICONS[tipo] || '📄'} ${tipo}: OK (${templates[tipo].length} chars)`)
  );

  // 3. Preview de mensajes por tipo
  console.log('\n── Preview de mensajes por tipo ─────────────');
  const seen = new Set();
  for (const contact of valid) {
    if (seen.has(contact.tipo)) continue;
    seen.add(contact.tipo);
    const msg = personalize(templates[contact.tipo], contact);
    console.log(`\n  [${contact.tipo.toUpperCase()}] → ${contact.nombre}`);
    console.log('  ' + '─'.repeat(50));
    console.log(msg.split('\n').map(l => '  ' + l).join('\n'));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Validación completada — ${valid.length} contactos listos para envío`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(invalid.length > 0 ? 1 : 0);

} catch (err) {
  logger.fatal(`❌ ${err.message}`);
  process.exit(1);
}
