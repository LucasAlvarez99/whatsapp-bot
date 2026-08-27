'use strict';

const { default: makeWASocket, useMultiFileAuthState,
        DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom }   = require('@hapi/boom');
const QRCode     = require('qrcode');
const pino       = require('pino');
const path       = require('path');
const fs         = require('fs');

const SESSION_DIR = process.env.SESSION_DIR
  ? path.resolve(process.env.SESSION_DIR)
  : path.resolve(__dirname, '../../session');

const MAX_RETRIES = 5;

let sock       = null;
let _logCb     = null;   // callback opcional para rutear logs al SSE

function log(msg) {
  const line = `[BrowserManager] ${new Date().toISOString()} — ${msg}`;
  console.log(line);
  if (_logCb) _logCb(msg);   // reenviar al SSE sin override global de console.log
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Launch ────────────────────────────────────────────────────
async function launch(logCallback) {
  _logCb = logCallback || null;
  log(`SESSION_DIR: ${SESSION_DIR}`);
  log('Motor: Baileys (WebSocket directo — sin Chromium)');
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    log('Carpeta de sesión creada');
  } else {
    log('Carpeta de sesión ya existe');
  }
}

// ── Login con QR + auto-retry en 515 ─────────────────────────
async function waitForLoginWithQR(onQR) {
  log('Iniciando conexión Baileys...');

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version }          = await fetchLatestBaileysVersion();
  log(`WA Web version: ${version.join('.')}`);

  return new Promise((resolve, reject) => {
    let resolved = false;
    let retries  = 0;

    const done = (err) => {
      if (resolved) return;
      resolved = true;
      err ? reject(err) : resolve();
    };

    function connect() {
      if (sock) { try { sock.end(undefined); } catch (_) {} }

      sock = makeWASocket({
        version,
        auth:                state,
        printQRInTerminal:   false,
        logger:              pino({ level: 'silent' }),
        browser:             ['Magic Show Bot', 'Chrome', '120.0.0'],
        connectTimeoutMs:    60_000,
        keepAliveIntervalMs: 25_000,
        markOnlineOnConnect: false,
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {

        if (qr) {
          log('QR generado — convirtiendo a imagen...');
          try {
            const dataUrl = await QRCode.toDataURL(qr, {
              width: 256, margin: 2,
              color: { dark: '#000000', light: '#ffffff' },
            });
            onQR(dataUrl);
            log('QR enviado al cliente');
          } catch (err) {
            log(`Error generando QR: ${err.message}`);
          }
        }

        if (connection === 'open') {
          log('Sesión activa — conexión establecida');
          done();
        }

        if (connection === 'close') {
          const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
          log(`Conexión cerrada — código: ${code}`);

          // 515 = restartRequired — WhatsApp pide reconectar
          if (code === 515 || code === DisconnectReason.restartRequired) {
            retries++;
            if (retries <= MAX_RETRIES) {
              const wait = retries * 2_000;
              log(`Restart requerido — reintento ${retries}/${MAX_RETRIES} en ${wait/1000}s...`);
              sleep(wait).then(connect);
            } else {
              done(new Error(`Demasiados reinicios (${MAX_RETRIES})`));
            }
            return;
          }

          // 401 = logged out — limpiar sesión guardada
          if (code === DisconnectReason.loggedOut) {
            log('Sesión expirada — limpiando archivos...');
            try {
              fs.readdirSync(SESSION_DIR)
                .filter(f => f.endsWith('.json'))
                .forEach(f => fs.unlinkSync(path.join(SESSION_DIR, f)));
            } catch (_) {}
            done(new Error('Sesión cerrada — volvé a ejecutar y escaneá el QR de nuevo'));
            return;
          }

          // Cualquier otro código — reintentar si no resolvimos aún
          if (!resolved) {
            retries++;
            if (retries <= MAX_RETRIES) {
              log(`Reconectando (${retries}/${MAX_RETRIES})...`);
              sleep(3_000).then(connect);
            } else {
              done(new Error(`Sin conexión después de ${MAX_RETRIES} intentos (código: ${code})`));
            }
          }
        }
      });
    }

    connect();

    // Timeout global de 5 minutos
    setTimeout(() => done(new Error('Timeout: 5 minutos sin login')), 300_000);
  });
}

async function waitForLogin() {
  return waitForLoginWithQR(() => {});
}

// ── Enviar mensaje ────────────────────────────────────────────
async function sendMessage(rawNumber, message) {
  if (!sock) throw new Error('Sin conexión WhatsApp');
  const number = rawNumber.replace(/\D/g, '');
  const jid    = `${number}@s.whatsapp.net`;
  log(`Enviando a ${number}...`);
  await sock.sendMessage(jid, { text: message });
  await sleep(1_000 + Math.random() * 500);
  log(`Enviado a ${number}`);
}

// ── Cerrar ────────────────────────────────────────────────────
async function close() {
  if (sock) {
    log('Cerrando conexión Baileys...');
    try { sock.end(undefined); } catch (_) {}
    sock  = null;
    _logCb = null;
    log('Conexión cerrada');
  }
}

module.exports = { launch, waitForLogin, waitForLoginWithQR, sendMessage, close };