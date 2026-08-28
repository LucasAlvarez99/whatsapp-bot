'use strict';

const path = require('path');

module.exports = {

  timing: {
    delayMin:     150_000,    // 
    delayMax:     210_000,   // 
    loginTimeout: 120_000,   // 2 min máx. esperando que se escanee el QR
    sendTimeout:  30_000,    // 30s máx. por envío individual (y por reconexión antes de fallar)
    afterSend:    1_000,     // pausa fija tras cada envío exitoso (+ jitter aleatorio)

    // Simulación de "escribiendo..." antes de cada envío — hace que el
    // tráfico se vea menos como un bot golpeando la API y más como alguien
    // tipeando. No es una garantía contra el antispam de WhatsApp, pero es
    // una señal de comportamiento humano más que ayuda.
    typingMinMs:  1_500,
    typingMaxMs:  4_000,

    // Cada tanto (cantidad de mensajes aleatoria en este rango) se mete una
    // pausa larga, simulando que la persona se distrajo un rato — rompe el
    // ritmo perfectamente regular de "un mensaje cada X minutos" que es una
    // de las señales que usan los sistemas antispam para detectar bots.
    longBreakEveryMin: 12,
    longBreakEveryMax: 20,
    longBreakMinMs:    5 * 60_000,
    longBreakMaxMs:    12 * 60_000,
  },

  paths: {
    contacts: path.resolve(__dirname, '../../contactos.csv'),
    messages: path.resolve(__dirname, '../../mensajes'),
    session:  path.resolve(__dirname, '../../session'),
    log:      path.resolve(__dirname, '../../logs/envios.log'),
    progress: path.resolve(__dirname, '../../data/campaign-progress.json'),
  },

  types: {
    cliente:       'mensaje_cliente.txt',
    cliente_nuevo: 'mensaje_cliente_nuevo.txt',
    salon:         'mensaje_salon.txt',
    empresa:       'mensaje_empresa.txt',
  },

};