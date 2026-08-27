'use strict';

const path = require('path');

module.exports = {

  timing: {
    delayMin:     150_000,    // 
    delayMax:     210_000,   // 
    loginTimeout: 120_000,   // 2 min máx. esperando que se escanee el QR
    sendTimeout:  30_000,    // 30s máx. por envío individual (y por reconexión antes de fallar)
    afterSend:    1_000,     // pausa fija tras cada envío exitoso (+ jitter aleatorio)
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
