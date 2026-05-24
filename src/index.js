'use strict';

const { readContacts }  = require('./contacts/contactReader');
const { loadTemplates } = require('./messages/messageLoader');
const browserManager    = require('./browser/browserManager');
const { runSendLoop }   = require('./sender');
const keyboard          = require('./utils/keyboardController');
const logger            = require('./utils/logger');
const { types }         = require('./config/config');

function printBanner() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   🎩 Magic Show Bot v3.2');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function shutdown(code = 0) {
  await browserManager.close();
  logger.closeStream();
  process.exit(code);
}

async function main() {
  printBanner();

  let contacts, templates;
  try {
    const result  = readContacts();
    contacts      = result.valid;
    templates     = loadTemplates();
    logger.info(`📋 ${contacts.length} contactos válidos`);
    if (!contacts.length) { logger.error('Sin contactos válidos.'); await shutdown(1); }
  } catch (err) {
    logger.fatal(`❌ ${err.message}`);
    logger.closeStream();
    process.exit(1);
  }

  keyboard.init(() => shutdown(0));

  try {
    await browserManager.launch();
    await browserManager.waitForLogin();
  } catch (err) {
    logger.fatal(`❌ ${err.message}`);
    await shutdown(1);
  }

  logger.info(`\n🚀 Iniciando envíos — ${contacts.length} en cola\n`);
  const { sent, errors } = await runSendLoop(contacts, templates, keyboard.state);

  logger.done(`🏁 Completado — Enviados: ${sent} | Errores: ${errors}`);
  await shutdown(errors > 0 ? 1 : 0);
}

main().catch(async err => {
  logger.fatal(`💥 Error fatal: ${err.message}`);
  await shutdown(1);
});
