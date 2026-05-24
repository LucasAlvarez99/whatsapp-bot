'use strict';

const browserManager  = require('./browser/browserManager');
const { personalize } = require('./messages/messageLoader');
const { randomDelay, sleep } = require('./utils/delay');
const logger          = require('./utils/logger');

const TYPE_ICONS = {
  cliente:       '🧑  cliente',
  cliente_nuevo: '🆕 cliente nuevo',
  salon:         '🏛️  salón',
  empresa:       '🏢 empresa',
};

async function runSendLoop(contacts, templates, pauseState) {
  let sent   = 0;
  let errors = 0;
  const total = contacts.length;

  for (let i = 0; i < total; i++) {
    const contact  = contacts[i];
    const progress = `[${i + 1}/${total}]`;

    while (pauseState.paused) await sleep(500);

    const template     = templates[contact.tipo];
    const finalMessage = personalize(template, contact);
    const typeLabel    = TYPE_ICONS[contact.tipo] || contact.tipo;

    try {
      logger.info(`${progress} 📤 ${typeLabel} — ${contact.nombre} (${contact.numero})`);
      await browserManager.sendMessage(contact.numero, finalMessage);
      sent++;
      logger.ok(`${progress} ✅ Enviado — ${contact.nombre}`);
    } catch (err) {
      errors++;
      logger.error(`${progress} ❌ ERROR — ${contact.nombre}: ${err.message}`);
    }

    logger.info(`📊 Enviados: ${sent} | Errores: ${errors} | Pendientes: ${total - i - 1}`);
    if (i < total - 1) await randomDelay();
  }

  return { sent, errors };
}

module.exports = { runSendLoop };
