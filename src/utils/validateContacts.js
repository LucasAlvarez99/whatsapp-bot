'use strict';

const { readContacts }               = require('../contacts/contactReader');
const { loadTemplates, personalize } = require('../messages/messageLoader');
const logger                         = require('./logger');

console.log('\n===========================================');
console.log('  Validación de Contactos y Mensajes');
console.log('===========================================\n');

try {
  const { valid, invalid, total } = readContacts();
  console.log(`Total: ${total} | Válidos: ${valid.length} | Inválidos: ${invalid.length}\n`);

  if (invalid.length > 0) {
    invalid.forEach(({ reason }) => logger.warn(reason));
    console.log('');
  }

  const templates = loadTemplates();
  Object.keys(templates).forEach(tipo =>
    console.log(`   ${tipo}: OK`)
  );

  console.log('\n── Preview ──────────────────────────────────');
  const seen = new Set();
  for (const contact of valid) {
    if (seen.has(contact.tipo)) continue;
    seen.add(contact.tipo);
    const msg = personalize(templates[contact.tipo], contact);
    console.log(`\n  [${contact.tipo.toUpperCase()}] -> ${contact.nombre}`);
    console.log('  ' + '─'.repeat(50));
    console.log(msg.split('\n').map(l => '  ' + l).join('\n'));
  }

  logger.closeStream();
  process.exit(invalid.length > 0 ? 1 : 0);
} catch (err) {
  logger.fatal(err.message);
  logger.closeStream();
  process.exit(1);
}
