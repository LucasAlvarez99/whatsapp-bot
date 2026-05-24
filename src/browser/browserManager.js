'use strict';

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const IS_PROD = process.env.NODE_ENV === 'production';

const TIMING = {
  loginTimeout: 120_000,
  sendTimeout:  30_000,
  afterSend:    3_000,
  humanPause:   1_200,
};

const SESSION_DIR = path.resolve(__dirname, '../../session');
const WA_URL      = 'https://web.whatsapp.com';

const SEL = {
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
  qr: [
    'canvas',
    '[data-testid="qrcode"]',
    '[aria-label="Scan me!"]',
    '[aria-label="Escanéame!"]',
  ],
};

let browser = null;
let page    = null;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function log(msg) {
  console.log(`[BrowserManager] ${new Date().toISOString()} — ${msg}`);
}

// ── Launch ────────────────────────────────────────────────────
async function launch() {
  log(`Entorno: ${IS_PROD ? 'PRODUCCIÓN' : 'LOCAL'}`);
  log(`SESSION_DIR: ${SESSION_DIR}`);
  log(`PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH || '(no seteado)'}`);

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    log('Carpeta de sesión creada');
  } else {
    log('Carpeta de sesión ya existe');
    const files = fs.readdirSync(SESSION_DIR);
    log(`Archivos en session/: ${files.length > 0 ? files.join(', ') : '(vacía)'}`);
  }

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--window-size=1280,800',
    '--disable-blink-features=AutomationControlled',
  ];

  const launchOptions = {
    headless: IS_PROD ? 'new' : false,
    userDataDir: SESSION_DIR,
    args,
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    log(`Usando Chromium del sistema: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
  } else {
    log('Usando Chromium incluido en puppeteer');
  }

  log(`Lanzando con headless=${launchOptions.headless}`);
  browser = await puppeteer.launch(launchOptions);
  log('Browser lanzado OK');

  const pages = await browser.pages();
  log(`Páginas abiertas al inicio: ${pages.length}`);
  page = pages[0] ?? await browser.newPage();

  // ── Anti-detección ────────────────────────────────────────
  // WhatsApp bloquea Chromium headless viejo — fingimos ser Chrome moderno
  const USER_AGENT =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

  await page.setUserAgent(USER_AGENT);
  log(`User-agent seteado: ${USER_AGENT}`);

  // Ocultar que es un browser automatizado
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages', { get: () => ['es-AR', 'es', 'en'] });
    window.chrome = { runtime: {} };
  });
  log('Anti-detección aplicada');

  // Capturar errores de consola del browser
  page.on('console', msg => {
    if (msg.type() === 'error') {
      log(`[PAGE console.error] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    log(`[PAGE ERROR] ${err.message}`);
  });

  await page.setViewport({ width: 1280, height: 800 });
  log(`Navegando a ${WA_URL}...`);

  try {
    await page.goto(WA_URL, { waitUntil: 'networkidle2', timeout: 60_000 });
    log(`Navegación OK — URL actual: ${page.url()}`);
    log(`Título de la página: ${await page.title()}`);
  } catch (err) {
    log(`ERROR en goto: ${err.message}`);
    throw err;
  }
}

// ── waitForLoginWithQR ────────────────────────────────────────
async function waitForLoginWithQR(onQR) {
  log('Iniciando waitForLoginWithQR...');
  let pollingActive = true;
  let pollCount     = 0;
  let qrSentCount   = 0;

  async function pollQR() {
    while (pollingActive) {
      pollCount++;
      log(`Poll #${pollCount} — verificando estado de la página...`);

      try {
        const currentUrl = page.url();
        log(`  URL actual: ${currentUrl}`);

        // Verificar si ya está logueado
        const loggedIn = await page.evaluate(
          sels => sels.some(s => !!document.querySelector(s)),
          SEL.chatList
        );
        log(`  ¿Logueado?: ${loggedIn}`);

        if (loggedIn) {
          log('  ✅ Sesión activa detectada — saliendo del poll');
          break;
        }

        // Ver qué hay en el DOM
        const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 200) || '(vacío)');
        log(`  Texto del body (primeros 200 chars): ${bodyText.replace(/\n/g, ' ')}`);

        // Buscar el QR
        log('  Buscando QR en la página...');
        let qrFound = false;

        for (const sel of SEL.qr) {
          const el = await page.$(sel).catch(() => null);
          if (!el) {
            log(`    Selector "${sel}": no encontrado`);
            continue;
          }

          log(`    Selector "${sel}": ENCONTRADO — tomando screenshot...`);
          const buf = await el.screenshot({ type: 'png' }).catch(e => {
            log(`    Screenshot falló: ${e.message}`);
            return null;
          });

          if (buf) {
            qrSentCount++;
            log(`    QR capturado OK (${buf.length} bytes) — enviando al cliente (envío #${qrSentCount})`);
            onQR('data:image/png;base64,' + buf.toString('base64'));
            qrFound = true;
            break;
          } else {
            log(`    Screenshot devolvió null`);
          }
        }

        if (!qrFound) {
          log('  ⚠ QR no encontrado en ningún selector');

          // Listar todos los elementos canvas e img por si hay algo
          const elements = await page.evaluate(() => {
            const canvases = document.querySelectorAll('canvas');
            const imgs     = document.querySelectorAll('img');
            return {
              canvases: canvases.length,
              imgs: imgs.length,
              bodyClasses: document.body?.className || '',
            };
          });
          log(`  canvas en página: ${elements.canvases}, img: ${elements.imgs}, body.class: "${elements.bodyClasses}"`);
        }

      } catch (err) {
        log(`  ERROR en poll: ${err.message}`);
      }

      log(`  Esperando 3s antes del próximo poll...`);
      await sleep(3_000);
    }

    log(`Poll terminado — total polls: ${pollCount}, QRs enviados: ${qrSentCount}`);
  }

  const pollPromise = pollQR();

  log('Esperando detección de sesión activa (waitForFunction)...');
  try {
    await page.waitForFunction(
      sels => sels.some(sel => !!document.querySelector(sel)),
      { timeout: TIMING.loginTimeout },
      SEL.chatList
    );
    log('waitForFunction completado — sesión detectada');
  } catch (err) {
    log(`waitForFunction FALLÓ: ${err.message}`);
    pollingActive = false;
    await pollPromise;
    throw err;
  }

  pollingActive = false;
  await pollPromise;

  log('Esperando 3s para que WhatsApp termine de cargar...');
  await sleep(3_000);
  log('waitForLoginWithQR completado OK');
}

// ── Legacy ────────────────────────────────────────────────────
async function waitForLogin() {
  log('waitForLogin (legacy) iniciado...');
  await page.waitForFunction(
    sels => sels.some(sel => !!document.querySelector(sel)),
    { timeout: TIMING.loginTimeout },
    SEL.chatList
  );
  await sleep(3_000);
  log('waitForLogin completado');
}

// ── Send ──────────────────────────────────────────────────────
async function sendMessage(rawNumber, message) {
  const number = rawNumber.replace(/\D/g, '');
  const url    = `${WA_URL}/send?phone=${number}&text=${encodeURIComponent(message)}`;

  log(`Enviando a ${number}...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: TIMING.sendTimeout });

  let found = false;
  for (const sel of SEL.composeBox) {
    try {
      await page.waitForSelector(sel, { timeout: 8_000 });
      await page.click(sel);
      found = true;
      log(`  composeBox encontrado con: ${sel}`);
      break;
    } catch (_) {}
  }

  if (!found) throw new Error('No se encontró el cuadro de texto. Actualizá puppeteer.');

  await sleep(TIMING.humanPause + Math.random() * 800);
  await page.keyboard.press('Enter');
  await sleep(TIMING.afterSend);

  const errEl = await page.$(SEL.errorPopup);
  if (errEl) {
    const txt = await page.evaluate(el => el.innerText, errEl);
    throw new Error('WhatsApp: ' + txt.substring(0, 120));
  }

  log(`  ✅ Mensaje enviado a ${number}`);
}

// ── Close ─────────────────────────────────────────────────────
async function close() {
  if (browser) {
    log('Cerrando browser...');
    try { await browser.close(); } catch (e) { log(`Error al cerrar: ${e.message}`); }
    browser = null;
    page    = null;
    log('Browser cerrado');
  }
}

module.exports = { launch, waitForLogin, waitForLoginWithQR, sendMessage, close };
