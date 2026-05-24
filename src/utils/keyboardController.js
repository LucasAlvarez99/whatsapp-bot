'use strict';

const readline = require('readline');
const logger   = require('./logger');

const state = { paused: false };

function init(onExit) {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  process.stdin.on('keypress', (str, key) => {
    if (!key) return;
    if (key.name === 'p') {
      state.paused = !state.paused;
      logger.ctrl(state.paused ? '⏸ Pausado' : '▶️ Reanudado');
    }
    if (key.ctrl && key.name === 'c') {
      logger.ctrl('🛑 Ctrl+C — saliendo...');
      if (typeof onExit === 'function') onExit();
    }
  });

  logger.info('💡 [P] pausar/reanudar  |  [Ctrl+C] salir');
}

module.exports = { init, state };
