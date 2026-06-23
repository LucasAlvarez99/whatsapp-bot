'use strict';

const path = require('path');

module.exports = {

  timing: {
    delayMin:     300_000,
    delayMax:     900_000,
    loginTimeout: 120_000,
    sendTimeout:  30_000,
    afterSend:    3_000,
    humanPause:   1_200,
  },

  paths: {
    contacts: path.resolve(__dirname, '../../contactos.csv'),
    messages: path.resolve(__dirname, '../../mensajes'),
    session:  path.resolve(__dirname, '../../session'),
    log:      path.resolve(__dirname, '../../logs/envios.log'),
  },

  types: {
    cliente:       'mensaje_cliente.txt',
    cliente_nuevo: 'mensaje_cliente_nuevo.txt',
    salon:         'mensaje_salon.txt',
    empresa:       'mensaje_empresa.txt',
  },

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

  whatsapp: {
    url: 'https://web.whatsapp.com',
    selectors: {
      chatList: [
        '[data-testid="chat-list"]',
        '#pane-side',
        'div[aria-label="Chat list"]',
        'div[aria-label="Lista de chats"]',
        'div[role="grid"]',
      ],
      composeBox: [
        '[data-testid="conversation-compose-box-input"]',
        'div[contenteditable="true"][data-tab="10"]',
        'div[contenteditable="true"][data-tab="1"]',
        'footer div[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
      ],
      errorPopup: '[data-testid="popup-contents"]',
    },
  },

};
