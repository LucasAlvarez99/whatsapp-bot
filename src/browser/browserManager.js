/**
 * browserManager.js — Ciclo de vida del navegador (Puppeteer)
 * ─────────────────────────────────────────────────────────────
 * Responsabilidades:
 *   - Lanzar y cerrar el navegador
 *   - Esperar el login de WhatsApp
 *   - Enviar un mensaje a un número
 *
 * NO contiene lógica de negocio ni loops de envío.
 */

'use strict';

const puppeteer = require('puppeteer');
const fs        = require('fs');
const logger    = require('../utils/logger');
const { paths, browser: BROWSER_CFG, whatsapp: WA, timing } = require('../config/config');

let browser = null;
let page    = null;

// ── Launch ─────────────────────────────────────────────────────────────────────
async function launch() {
  if (!fs.existsSync(paths.session)) {
    fs.mkdirSync(paths.session, { recursive: true });
  }

  logger.info('🚀 Iniciando navegador...');

  browser = await puppeteer.launch({
    headless:    BROWSER_CFG.headless,
    userDataDir: paths.session,
    args:        BROWSER_CFG.args,
  });

  page = await browser.newPage();
  await page.setViewport(BROWSER_CFG.viewport);

  logger.info('🌐 Navegando a WhatsApp Web...');
  await page.goto(WA.url, { waitUntil: 'networkidle2', timeout: 60_000 });
}

// ── Login ──────────────────────────────────────────────────────────────────────
async function waitForLogin() {
  logger.info('🔄 Esperando inicio de sesión (escaneá el QR si es necesario)...');
  await page.waitForSelector(WA.selectors.chatList, { timeout: timing.loginTimeout });
  logger.ok('✅ Sesión de WhatsApp activa.');
}

// ── Send ───────────────────────────────────────────────────────────────────────
async function sendMessage(rawNumber, message) {
  const number = rawNumber.replace(/\D/g, '');
  const url    = `${WA.url}/send?phone=${number}&text=${encodeURIComponent(message)}`;

  await page.goto(url, { waitUntil: 'networkidle2', timeout: timing.sendTimeout });
  await page.waitForSelector(WA.selectors.composeBox, { timeout: 20_000 });

  // Pausa humanizada antes de enviar
  await sleep(timing.humanPause + Math.random() * 800);
  await page.keyboard.press('Enter');
  await sleep(timing.afterSend);

  // Detección de error de WhatsApp
  const errorEl = await page.$(WA.selectors.errorPopup);
  if (errorEl) {
    const errorText = await page.evaluate(el => el.innerText, errorEl);
    throw new Error(`WhatsApp: ${errorText.substring(0, 120)}`);
  }
}

// ── Close ──────────────────────────────────────────────────────────────────────
async function close() {
  if (browser) {
    await browser.close();
    browser = null;
    page    = null;
  }
}

// ── Util ───────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { launch, waitForLogin, sendMessage, close };
