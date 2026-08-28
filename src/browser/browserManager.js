'use strict';

const { default: makeWASocket, useMultiFileAuthState,
        DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { Boom }   = require('@hapi/boom');
const QRCode     = require('qrcode');
const pino       = require('pino');
const path       = require('path');
const fs         = require('fs');
const { timing } = require('../config/config');

const SESSION_DIR = process.env.SESSION_DIR
  ? path.resolve(process.env.SESSION_DIR)
  : path.resolve(__dirname, '../../session');

const MAX_RETRIES = 5;

let sock          = null;
let _logCb        = null;   // callback opcional para rutear logs al SSE
let _authState    = null;   // { state, saveCreds } — se arma una vez y se reusa en cada reconexión
let _waVersion    = null;
let connected     = false;  // true mientras el socket esté realmente abierto y utilizable
let _loggedOut    = false;  // true si WhatsApp cerró la sesión (401) — no tiene sentido reintentar
let _reconnecting = null;   // Promise en curso mientras se está reconectando, o null
let _closing      = false;  // true mientras close() está en curso o ya terminó — cancela
                             // cualquier reconexión programada para esa conexión (ver bug de
                             // "Cannot read properties of null (reading 'state')" más abajo)

function log(msg) {
  const line = `[BrowserManager] ${new Date().toISOString()} — ${msg}`;
  console.log(line);
  if (_logCb) _logCb(msg);   // reenviar al SSE sin override global de console.log
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Corre una promesa con un límite de tiempo — si se pasa, rechaza en vez de
// colgarse para siempre (esto es lo que faltaba: sin esto, una conexión
// muerta hacía que sendMessage() esperara indefinidamente sin avisar nada).
function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout: ${label} tardó más de ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
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

// ── Conexión persistente ────────────────────────────────────────
// connect() arma (o rearma) el socket de Baileys. Se llama una vez para el
// login inicial y, a partir de ahí, cada vez que la conexión se corta de
// forma inesperada durante el envío — antes esto último no pasaba: una vez
// resuelto el login, un corte de conexión posterior no reconectaba y el
// socket quedaba muerto en silencio.
function connect({ onQR, onOpen, onFatal }) {
  if (sock) { try { sock.end(undefined); } catch (_) {} }
  connected = false;
  _closing  = false; // arranca (o rearma) un ciclo de conexión nuevo — habilita reconexión

  let retries = 0;

  function attempt() {
    // close() puede haber sido llamado mientras este attempt() estaba
    // programado con setTimeout (ver bug de _authState null más abajo) —
    // si ya estamos cerrando, no seguir.
    if (_closing || !_authState) {
      log('Reconexión cancelada — la conexión ya fue cerrada');
      return;
    }

    sock = makeWASocket({
      version:             _waVersion,
      auth:                _authState.state,
      printQRInTerminal:   false,
      logger:              pino({ level: 'silent' }),
      browser:             Browsers.ubuntu('Chrome'),
      connectTimeoutMs:    60_000,
      keepAliveIntervalMs: 25_000,
      // Un WhatsApp Web real se muestra "en línea" mientras la pestaña está
      // abierta — un socket que nunca aparece online, solo despierta para
      // mandar y se queda mudo el resto del tiempo, es otra señal de bot.
      markOnlineOnConnect: true,
    });

    sock.ev.on('creds.update', _authState.saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {

      if (qr && onQR) {
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
        connected = true;
        retries   = 0; // se resetea: un corte ocasional en una campaña larga no debe agotar los reintentos
        log('Sesión activa — conexión establecida');
        onOpen();
      }

      if (connection === 'close') {
        connected = false;
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        log(`Conexión cerrada — código: ${code}`);

        // 401 = logged out — WhatsApp cerró la sesión, no tiene sentido reintentar
        if (code === DisconnectReason.loggedOut) {
          _loggedOut = true;
          log('Sesión expirada — limpiando archivos...');
          try {
            fs.readdirSync(SESSION_DIR)
              .filter(f => f.endsWith('.json'))
              .forEach(f => fs.unlinkSync(path.join(SESSION_DIR, f)));
          } catch (_) {}
          onFatal(new Error('Sesión cerrada — volvé a ejecutar y escaneá el QR de nuevo'));
          return;
        }

        // Cualquier otro corte (515/restartRequired, red, timeout, etc.) —
        // reintentar SIEMPRE, esté o no ya logueados, con backoff creciente.
        // Excepto si el cierre fue provocado por close() (bot detenido,
        // campaña terminada, redeploy) — ahí _closing ya está en true y no
        // tiene sentido reconectar algo que cerramos nosotros a propósito.
        if (_closing) {
          log('Cierre intencional — no se reconecta');
          return;
        }

        retries++;
        if (retries <= MAX_RETRIES) {
          const wait = retries * 2_000;
          log(`Reconectando (${retries}/${MAX_RETRIES}) en ${wait / 1000}s...`);
          sleep(wait).then(attempt);
        } else {
          onFatal(new Error(`Sin conexión después de ${MAX_RETRIES} intentos (código: ${code})`));
        }
      }
    });
  }

  attempt();
}

// ── Login con QR ─────────────────────────────────────────────
async function waitForLoginWithQR(onQR) {
  log('Iniciando conexión Baileys...');

  _authState = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();
  _waVersion = version;
  log(`WA Web version: ${version.join('.')}`);
  _loggedOut = false;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      err ? reject(err) : resolve();
    };

    connect({
      onQR,
      onOpen: () => finish(),
      onFatal: (err) => finish(err),
    });

    // Timeout del login inicial únicamente (no aplica a reconexiones
    // posteriores, esas usan su propio backoff con MAX_RETRIES).
    const loginTimeoutMs = timing.loginTimeout || 120_000;
    setTimeout(() => finish(new Error(`Timeout: ${loginTimeoutMs / 60_000} minutos sin login`)), loginTimeoutMs);
  });
}

// ── Enviar mensaje ────────────────────────────────────────────
async function sendMessage(rawNumber, message) {
  if (_loggedOut) throw new Error('Sesión cerrada — hay que volver a escanear el QR');

  // Si la conexión se cortó y está reconectando en segundo plano, esperamos
  // un poco (no para siempre) en vez de fallar de inmediato — muchos cortes
  // se resuelven solos en unos segundos.
  if (!connected) {
    const waitMs = timing.sendTimeout || 30_000;
    const start  = Date.now();
    while (!connected && !_loggedOut && Date.now() - start < waitMs) {
      await sleep(500);
    }
    if (_loggedOut) throw new Error('Sesión cerrada — hay que volver a escanear el QR');
    if (!connected) throw new Error('Sin conexión con WhatsApp — no se pudo reconectar a tiempo');
  }

  const number = rawNumber.replace(/\D/g, '');
  const jid    = `${number}@s.whatsapp.net`;

  // Simular que alguien está tipeando antes de mandar — un bot que manda
  // en seco, mensaje tras mensaje, es una de las señales más obvias que
  // usa WhatsApp para detectar automatización. Esto no lo elimina, pero
  // ayuda a que el patrón de tráfico se vea más humano.
  try {
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate('composing', jid);
    const typingMs = timing.typingMinMs && timing.typingMaxMs
      ? Math.floor(Math.random() * (timing.typingMaxMs - timing.typingMinMs + 1) + timing.typingMinMs)
      : 2_000;
    await sleep(typingMs);
    await sock.sendPresenceUpdate('paused', jid);
  } catch (_) {
    // Si falla la simulación de tipeo no es motivo para abortar el envío
  }

  log(`Enviando a ${number}...`);

  // El envío en sí también tiene límite de tiempo — así una llamada colgada
  // no frena la campaña entera en silencio, se marca como error y se sigue.
  await withTimeout(sock.sendMessage(jid, { text: message }), timing.sendTimeout || 30_000, 'envío de mensaje');

  await sleep((timing.afterSend || 1_000) + Math.random() * 500);
  log(`Enviado a ${number}`);
}

// ── Cerrar ────────────────────────────────────────────────────
async function close() {
  _closing = true; // primero esto — el evento 'close' que dispara sock.end()
                    // más abajo puede llegar antes de que terminemos de limpiar,
                    // y necesita ver esta bandera para no programar una reconexión
  if (sock) {
    log('Cerrando conexión Baileys...');
    try { sock.end(undefined); } catch (_) {}
    sock       = null;
    connected  = false;
    _authState = null;
    _logCb     = null;
    log('Conexión cerrada');
  }
}

module.exports = { launch, waitForLoginWithQR, sendMessage, close };