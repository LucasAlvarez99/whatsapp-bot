'use strict';

const logger = require('./logger');
const { timing } = require('../config/config');

function randomDelay() {
  const ms = Math.floor(
    Math.random() * (timing.delayMax - timing.delayMin + 1) + timing.delayMin
  );
  logger.info(`⏳ Esperando ${(ms / 1000).toFixed(1)}s antes del próximo envío...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { randomDelay, sleep };
