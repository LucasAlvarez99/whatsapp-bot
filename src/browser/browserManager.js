/**
 * browserManager.js — Ciclo de vida del navegador (Puppeteer)
 * ─────────────────────────────────────────────────────────────
 * Responsabilidades:
 *   - Lanzar y cerrar el navegador
 *   - Esperar el login de WhatsApp
 *   - Enviar un mensaje a un número
 *
 * CAMBIOS v3.1:
 *   - waitForLogin usa waitForFunction con array de selectores (robusto ante
 *     cambios de UI de WhatsApp)
 *   - sendMessage itera el array composeBox en lugar de un selector único
 *   - sleep movido acá para no depender de delay.js (evita circular dep)
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
// Usa waitForFunction con todos los selectores del array para que no falle
// cuando WhatsApp cambia uno de ellos.
async function waitForLogin() {
  logger.info('🔄 Esperando inicio de sesión (escaneá el QR si es necesario)...');

  const selectors = WA.selectors.chatList;

  await page.waitForFunction(
    (sels) => sels.some(sel => document.querySelector(sel) !== null),
    { timeout: timing.loginTimeout },
    selectors
  );

  logger.ok('✅ Sesión de WhatsApp activa.');
  // Pausa extra para que WhatsApp termine de cargar los chats
  await sleep(3_000);
}

// ── Send ───────────────────────────────────────────────────────────────────────
// Itera el array de selectores de composeBox hasta encontrar uno que funcione.
async function sendMessage(rawNumber, message) {
  const number = rawNumber.replace(/\D/g, '');
  const url    = `${WA.url}/send?phone=${number}&text=${encodeURIComponent(message)}`;

  await page.goto(url, { waitUntil: 'networkidle2', timeout: timing.sendTimeout });

  // Buscar el cuadro de texto probando cada selector
  let found = false;
  for (const selector of WA.selectors.composeBox) {
    try {
      await page.waitForSelector(selector, { timeout: 8_000 });
      await page.click(selector);
      found = true;
      break;
    } catch {
      // Selector no encontrado, probar el siguiente
    }
  }

  if (!found) {
    throw new Error(
      'No se encontró el cuadro de texto. WhatsApp puede haber actualizado su interfaz. ' +
      'Ejecutá "npm update puppeteer" y revisá los selectores en config.js.'
    );
  }

  // Pausa humanizada antes de enviar
  await sleep(timing.humanPause + Math.random() * 800);
  await page.keyboard.press('Enter');
  await sleep(timing.afterSend);

  // Detección de error de WhatsApp (número inválido, etc.)
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