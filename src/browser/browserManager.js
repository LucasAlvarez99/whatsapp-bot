'use strict';

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const IS_PROD = process.env.NODE_ENV === 'production';

const TIMING = {
  loginTimeout:    300_000,   // 5 min total
  postScanTimeout: 180_000,   // 3 min esperando que carguen los chats (Render es lento)
  sendTimeout:     30_000,
  afterSend:       3_000,
  humanPause:      1_200,
};

const SESSION_DIR = process.env.SESSION_DIR
  ? path.resolve(process.env.SESSION_DIR)
  : path.resolve(__dirname, '../../session');

const WA_URL = 'https://web.whatsapp.com';

const SEL = {
  chatList: [
    '[data-testid="chat-list"]',
    '[data-testid="side"]',
    'header[data-testid="chatlist-header"]',
    '#pane-side',
    'div[aria-label="Chat list"]',
    'div[aria-label="Lista de chats"]',
    'div[role="grid"]',
    'div#side',
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

// Textos que indican que el QR fue escaneado pero WA aún está sincronizando
const POST_SCAN_TEXTS = [
  'loading your chats',
  'cargando tus chats',
  'end-to-end encrypted',
  'cifrado de extremo',
  'connecting to whatsapp',
  "don't close this window",
  'no cierres esta ventana',
];

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
  }

  log(`Lanzando con headless=${launchOptions.headless}`);
  browser = await puppeteer.launch(launchOptions);
  log('Browser lanzado OK');

  const pages = await browser.pages();
  log(`Páginas abiertas al inicio: ${pages.length}`);
  page = pages[0] ?? await browser.newPage();

  const USER_AGENT =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

  await page.setUserAgent(USER_AGENT);

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages', { get: () => ['es-AR', 'es', 'en'] });
    window.chrome = { runtime: {} };
  });

  page.on('console', msg => {
    if (msg.type() === 'error') log(`[PAGE console.error] ${msg.text()}`);
  });

  await page.setViewport({ width: 1280, height: 800 });
  log(`Navegando a ${WA_URL}...`);

  await page.goto(WA_URL, { waitUntil: 'networkidle2', timeout: 60_000 });
  log(`Navegación OK — URL: ${page.url()} — Título: ${await page.title()}`);
}

// ── waitForLoginWithQR ────────────────────────────────────────
async function waitForLoginWithQR(onQR) {
  log('Iniciando waitForLoginWithQR...');

  let resolved         = false;
  let qrWasScanned     = false;
  let postScanStart    = null;
  let pollCount        = 0;
  let qrSentCount      = 0;

  async function pollLoop() {
    while (!resolved) {
      pollCount++;
      log(`Poll #${pollCount} — verificando estado...`);

      // FIX 2: si page es null (stop() fue llamado), salir del loop
      if (!page) {
        log('  page es null — stop() llamado, saliendo del poll');
        break;
      }

      try {
        const loggedIn = await page.evaluate(
          sels => sels.some(s => !!document.querySelector(s)),
          SEL.chatList
        ).catch(() => false);

        log(`  ¿Logueado?: ${loggedIn}`);

        if (loggedIn) {
          log('  ✅ Chat list detectado — login OK');
          resolved = true;
          break;
        }

        const bodyText = await page.evaluate(
          () => (document.body?.innerText || '').slice(0, 300)
        ).catch(() => '');
        log(`  Body: ${bodyText.replace(/\n/g, ' ')}`);

        const bodyLower = bodyText.toLowerCase();
        const postScan  = POST_SCAN_TEXTS.some(t => bodyLower.includes(t));

        if (postScan && !qrWasScanned) {
          qrWasScanned  = true;
          postScanStart = Date.now();
          log('  🔄 QR escaneado — esperando que cargue el chat list...');
        }

        // FIX 3: si llevamos mucho tiempo en estado post-scan,
        // WhatsApp ya autenticó pero tarda en renderizar (típico en Render).
        // Intentamos navegar directamente al envío.
        if (qrWasScanned && postScanStart) {
          const elapsed = Date.now() - postScanStart;
          log(`  ⏱ Post-scan elapsed: ${Math.round(elapsed / 1000)}s`);

          if (elapsed >= TIMING.postScanTimeout) {
            log('  ⚠ Timeout post-scan — asumiendo sesión activa y continuando');
            resolved = true;
            break;
          }
        }

        // Buscar QR solo si aún no fue escaneado
        if (!qrWasScanned) {
          let qrFound = false;
          for (const sel of SEL.qr) {
            const el = await page.$(sel).catch(() => null);
            if (!el) { log(`  Selector "${sel}": no encontrado`); continue; }

            log(`  Selector "${sel}": ENCONTRADO — capturando...`);
            const buf = await el.screenshot({ type: 'png' }).catch(e => {
              log(`  Screenshot falló: ${e.message}`);
              return null;
            });

            if (buf) {
              qrSentCount++;
              log(`  QR OK (${buf.length} bytes) — envío #${qrSentCount}`);
              onQR('data:image/png;base64,' + buf.toString('base64'));
              qrFound = true;
              break;
            }
          }

          if (!qrFound) {
            log('  ⚠ QR no encontrado');
          }
        }

      } catch (err) {
        log(`  ERROR en poll: ${err.message}`);
        // Si el error es por page null, salir
        if (err.message.includes('null')) break;
      }

      const wait = qrWasScanned ? 2_000 : 3_000;
      await sleep(wait);
    }

    log(`Poll terminado — polls: ${pollCount}, QRs enviados: ${qrSentCount}`);
  }

  // Timeout global de seguridad
  const timeout = sleep(TIMING.loginTimeout).then(() => {
    if (!resolved) {
      resolved = true;
      throw new Error(`Login timeout global: ${TIMING.loginTimeout / 1000}s excedidos`);
    }
  });

  await Promise.race([pollLoop(), timeout]);

  log('Esperando 3s para que WhatsApp termine de cargar...');
  await sleep(3_000);
  log('waitForLoginWithQR completado OK');
}

// ── Legacy ────────────────────────────────────────────────────
async function waitForLogin() {
  await page.waitForFunction(
    sels => sels.some(sel => !!document.querySelector(sel)),
    { timeout: TIMING.loginTimeout },
    SEL.chatList
  );
  await sleep(3_000);
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
      log(`  composeBox: ${sel}`);
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

  log(`  ✅ Enviado a ${number}`);
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