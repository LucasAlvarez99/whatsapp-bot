'use strict';

/**
 * browserManager.js — implementación con @whiskeysockets/baileys
 * Reemplaza Puppeteer completamente. Sin Chromium, sin detección,
 * funciona perfecto en Render y cualquier entorno headless.
 */

const { default: makeWASocket, useMultiFileAuthState,
        DisconnectReason, fetchLatestBaileysVersion,
        delay } = require('@whiskeysockets/baileys');
const { Boom }   = require('@hapi/boom');
const QRCode     = require('qrcode');
const pino       = require('pino');
const path       = require('path');
const fs         = require('fs');

const SESSION_DIR = process.env.SESSION_DIR
  ? path.resolve(process.env.SESSION_DIR)
  : path.resolve(__dirname, '../../session');

let sock         = null;
let _saveCreds   = null;

function log(msg) {
  console.log(`[BrowserManager] ${new Date().toISOString()} — ${msg}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Launch (con Baileys no hace falta iniciar browser) ────────
async function launch() {
  log(`SESSION_DIR: ${SESSION_DIR}`);
  log('Motor: Baileys (WebSocket directo — sin Chromium)');
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    log('Carpeta de sesión creada');
  } else {
    log('Carpeta de sesión ya existe');
  }
}

// ── Login con QR ──────────────────────────────────────────────
async function waitForLoginWithQR(onQR) {
  log('Iniciando conexión Baileys...');

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  _saveCreds = saveCreds;

  let { version } = await fetchLatestBaileysVersion();
  log(`WA Web version: ${version.join('.')}`);

  return new Promise((resolve, reject) => {
    let resolved  = false;
    let qrCount   = 0;

    const done = (err) => {
      if (resolved) return;
      resolved = true;
      err ? reject(err) : resolve();
    };

    sock = makeWASocket({
      version,
      auth:               state,
      printQRInTerminal:  false,                     // no spamear la terminal
      logger:             pino({ level: 'silent' }), // silenciar logs internos
      browser:            ['Magic Show Bot', 'Chrome', '120.0.0'],
      connectTimeoutMs:   60_000,
      keepAliveIntervalMs: 25_000,
      markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {

      // ── QR disponible ──────────────────────────────────────
      if (qr) {
        qrCount++;
        log(`QR generado (${qrCount}) — convirtiendo a imagen...`);
        try {
          const dataUrl = await QRCode.toDataURL(qr, {
            width:  256,
            margin: 2,
            color:  { dark: '#000000', light: '#ffffff' },
          });
          onQR(dataUrl);
          log(`QR enviado al cliente (envío #${qrCount})`);
        } catch (err) {
          log(`Error generando QR: ${err.message}`);
        }
      }

      // ── Conectado ──────────────────────────────────────────
      if (connection === 'open') {
        log('✅ Sesión activa — conexión Baileys establecida');
        done();
      }

      // ── Desconectado ───────────────────────────────────────
      if (connection === 'close') {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        log(`Conexión cerrada — código: ${statusCode}`);

        if (statusCode === DisconnectReason.loggedOut) {
          // Limpiar la sesión corrupta para forzar nuevo QR la próxima vez
          try {
            const files = fs.readdirSync(SESSION_DIR);
            files.forEach(f => {
              if (f.endsWith('.json')) fs.unlinkSync(path.join(SESSION_DIR, f));
            });
            log('Sesión limpiada — en el próximo inicio escaneá el QR de nuevo');
          } catch (_) {}
          done(new Error('WhatsApp cerró la sesión — volvé a ejecutar y escaneá el QR'));
        } else if (!resolved) {
          done(new Error(`Conexión cerrada antes de autenticar (código: ${statusCode})`));
        }
      }
    });

    // Timeout global de 5 minutos
    setTimeout(() => done(new Error('Timeout: 5 minutos sin login')), 300_000);
  });
}

// ── Legacy (alias) ────────────────────────────────────────────
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
  // Pequeña pausa post-envío para que WA no detecte ráfagas
  await sleep(1_000 + Math.random() * 500);

  log(`✅ Enviado a ${number}`);
}

// ── Cerrar conexión ───────────────────────────────────────────
async function close() {
  if (sock) {
    log('Cerrando conexión Baileys...');
    try { sock.end(undefined); } catch (_) {}
    sock = null;
    log('Conexión cerrada');
  }
}

module.exports = { launch, waitForLogin, waitForLoginWithQR, sendMessage, close };