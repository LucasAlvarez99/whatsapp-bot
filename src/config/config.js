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
    progress: path.resolve(__dirname, '../../data/campaign-progress.json'),
  },

  types: {
    cliente:       'mensaje_cliente.txt',
    cliente_nuevo: 'mensaje_cliente_nuevo.txt',
    salon:         'mensaje_salon.txt',
    empresa:       'mensaje_empresa.txt',
  },

};
