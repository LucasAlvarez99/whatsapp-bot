/**
 * config.js — Configuración central del bot
 * ─────────────────────────────────────────
 * ÚNICO lugar donde tocar parámetros del sistema.
 * Todos los demás módulos importan desde acá.
 *
 * CAMBIOS v3.1:
 *  - Selectores de WhatsApp como arrays (fallbacks ante cambios de UI)
 *  - Agregado selector de login con múltiples alternativas
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
    contacts: path.resolve(__dirname, '../../contactos.csv'),
    messages: path.resolve(__dirname, '../../mensajes'),
    session:  path.resolve(__dirname, '../../session'),
    log:      path.resolve(__dirname, '../../logs/envios.log'),
  },

  // ── Tipos de contacto → archivo de mensaje ─────────────
  types: {
    cliente:       'mensaje_cliente.txt',
    cliente_nuevo: 'mensaje_cliente_nuevo.txt',
    salon:         'mensaje_salon.txt',
    empresa:       'mensaje_empresa.txt',
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
  // Los selectores son arrays ordenados por prioridad.
  // browserManager itera hasta encontrar el primero que funcione.
  whatsapp: {
    url: 'https://web.whatsapp.com',
    selectors: {
      // Login: cualquiera de estos indica que la sesión está activa
      chatList: [
        '[data-testid="chat-list"]',
        '#pane-side',
        'div[aria-label="Chat list"]',
        'div[aria-label="Lista de chats"]',
        'div[role="grid"]',
      ],
      // Cuadro de texto donde se escribe el mensaje
      composeBox: [
        '[data-testid="conversation-compose-box-input"]',
        'div[contenteditable="true"][data-tab="10"]',
        'div[contenteditable="true"][data-tab="1"]',
        'footer div[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
      ],
      // Popup de error de WhatsApp (número inválido, etc.)
      errorPopup: '[data-testid="popup-contents"]',
    },
  },

};