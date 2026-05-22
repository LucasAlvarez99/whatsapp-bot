/**
 * index.js — Punto de entrada
 * ────────────────────────────
 * Orquestador delgado: conecta módulos, NO contiene lógica de negocio.
 *
 * Flujo:
 *   1. Cargar contactos y plantillas
 *   2. Mostrar resumen por tipo
 *   3. Iniciar control de teclado
 *   4. Lanzar navegador y esperar login
 *   5. Ejecutar loop de envíos
 *   6. Mostrar resumen final y cerrar
 *
 * CAMBIOS v3.1:
 *   - Cierra el stream del logger antes de salir (logger.closeStream())
 */

'use strict';

const { readContacts }  = require('./contacts/contactReader');
const { loadTemplates } = require('./messages/messageLoader');
const browserManager    = require('./browser/browserManager');
const { runSendLoop }   = require('./sender');
const keyboard          = require('./utils/keyboardController');
const logger            = require('./utils/logger');
const { types }         = require('./config/config');

// ─────────────────────────────────────────────────────────────────────────────

function printBanner() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   🎩 Magic Show Bot v3.1 — Envíos por tipo ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function printContactSummary(valid, invalid) {
  const counts = Object.fromEntries(Object.keys(types).map(t => [t, 0]));
  valid.forEach(c => { if (counts[c.tipo] !== undefined) counts[c.tipo]++; });

  logger.info(`📋 Contactos: ${valid.length} válidos | ${invalid.length} omitidos`);
  logger.info(`   ├─ 🧑  clientes:        ${counts.cliente}`);
  logger.info(`   ├─ 🆕  clientes nuevos: ${counts.cliente_nuevo}`);
  logger.info(`   ├─ 🏛️   salones:          ${counts.salon}`);
  logger.info(`   └─ 🏢  empresas:         ${counts.empresa}`);

  if (invalid.length > 0) {
    logger.warn(`\n⚠️  ${invalid.length} fila(s) omitidas. Ejecutá "npm run validate" para ver el detalle.\n`);
  }
}

async function shutdown(code = 0) {
  await browserManager.close();
  logger.closeStream();
  process.exit(code);
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  printBanner();

  // 1. Cargar datos
  let contacts, templates;
  try {
    const result  = readContacts();
    contacts      = result.valid;
    const invalid = result.invalid;

    templates = loadTemplates();
    printContactSummary(contacts, invalid);

    if (contacts.length === 0) {
      logger.error('No hay contactos válidos para enviar. Abortando.');
      await shutdown(1);
    }
  } catch (err) {
    logger.fatal(`❌ ${err.message}`);
    logger.closeStream();
    process.exit(1);
  }

  // 2. Teclado
  keyboard.init(() => shutdown(0));

  // 3. Navegador
  try {
    await browserManager.launch();
    await browserManager.waitForLogin();
  } catch (err) {
    logger.fatal(`❌ Error al iniciar navegador: ${err.message}`);
    await shutdown(1);
  }

  // 4. Envíos
  logger.info(`\n🚀 Iniciando envíos — ${contacts.length} contactos en cola\n`);
  const { sent, errors } = await runSendLoop(contacts, templates, keyboard.state);

  // 5. Resumen final
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.done(`🏁 COMPLETADO — Enviados: ${sent} | Errores: ${errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await shutdown(errors > 0 ? 1 : 0);
}

main().catch(async err => {
  logger.fatal(`💥 Error fatal inesperado: ${err.message}`);
  await shutdown(1);
});
