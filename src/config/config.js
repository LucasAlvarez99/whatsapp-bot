/**
 * config.js — Configuración central del bot
 * ─────────────────────────────────────────
 * ÚNICO lugar donde tocar parámetros del sistema.
 * Todos los demás módulos importan desde acá.
 */

'use strict';

const path = require('path');

module.exports = {

  // ── Tiempos ────────────────────────────────────────────
  timing: {
    delayMin:     28_000,   // ms mínimo entre mensajes
    delayMax:     35_000,   // ms máximo entre mensajes
    loginTimeout: 120_000,  // ms para escanear QR
    sendTimeout:  30_000,   // ms timeout por mensaje
    afterSend:    3_000,    // ms de espera post-envío
    humanPause:   1_200,    // ms pausa "humana" antes de Enter
  },

  // ── Rutas ──────────────────────────────────────────────
  paths: {
    contacts:  path.resolve(__dirname, '../../contactos.csv'),
    messages:  path.resolve(__dirname, '../../mensajes'),
    session:   path.resolve(__dirname, '../../session'),
    log:       path.resolve(__dirname, '../../logs/envios.log'),
  },

  // ── Tipos de contacto → archivo de mensaje ─────────────
  types: {
    cliente:        'mensaje_cliente.txt',
    cliente_nuevo:  'mensaje_cliente_nuevo.txt',
    salon:          'mensaje_salon.txt',
    empresa:        'mensaje_empresa.txt',
  },

  // ── Navegador ──────────────────────────────────────────
  browser: {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1280,800',
    ],
  },

  // ── WhatsApp ───────────────────────────────────────────
  whatsapp: {
    url:           'https://web.whatsapp.com',
    selectors: {
      chatList:    '[data-testid="chat-list"]',
      composeBox:  '[data-testid="conversation-compose-box-input"]',
      errorPopup:  '[data-testid="popup-contents"]',
    },
  },

};
