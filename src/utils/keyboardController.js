/**
 * keyboardController.js — Control por teclado
 * ─────────────────────────────────────────────
 * P         → Pausar / reanudar envíos
 * Ctrl + C  → Salir limpiamente
 *
 * Exporta un objeto de estado reactivo { paused }
 * que el loop principal puede leer sin acoplamientos.
 */

'use strict';

const readline = require('readline');
const logger   = require('../utils/logger');

// Estado compartido — el loop lee `state.paused`
const state = { paused: false };

function init(onExit) {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  process.stdin.on('keypress', (str, key) => {
    if (!key) return;

    if (key.name === 'p') {
      state.paused = !state.paused;
      logger.ctrl(state.paused
        ? '⏸  Envíos PAUSADOS — presioná P para reanudar'
        : '▶️  Envíos REANUDADOS'
      );
    }

    if (key.ctrl && key.name === 'c') {
      logger.ctrl('🛑 Ctrl+C detectado — saliendo...');
      if (typeof onExit === 'function') onExit();
      process.exit(0);
    }
  });

  logger.info('💡 Controles: [P] pausar/reanudar  |  [Ctrl+C] salir');
}

module.exports = { init, state };
