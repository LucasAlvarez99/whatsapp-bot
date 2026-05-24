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

// ── Launch ────────────────────────────────────────────────────
async function launch() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  // Flags base + extras para entornos sin display (Linux server / Docker)
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--window-size=1280,800',
  ];

  const launchOptions = {
    headless: IS_PROD ? 'new' : false,   // headless en producción, visible en local
    userDataDir: SESSION_DIR,
    args,
  };

  // En producción usa el Chromium del sistema (seteado por la variable de entorno)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  browser = await puppeteer.launch(launchOptions);
  page    = (await browser.pages())[0] ?? await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(WA_URL, { waitUntil: 'networkidle2', timeout: 60_000 });
}

// ── waitForLoginWithQR ────────────────────────────────────────
async function waitForLoginWithQR(onQR) {
  let pollingActive = true;

  async function pollQR() {
    while (pollingActive) {
      try {
        const loggedIn = await page.evaluate(
          sels => sels.some(s => !!document.querySelector(s)),
          SEL.chatList
        );
        if (loggedIn) break;

        for (const sel of SEL.qr) {
          const el  = await page.$(sel).catch(() => null);
          if (!el) continue;
          const buf = await el.screenshot({ type: 'png' }).catch(() => null);
          if (buf) {
            onQR('data:image/png;base64,' + buf.toString('base64'));
            break;
          }
        }
      } catch (_) {}

      await sleep(3_000);
    }
  }

  const pollPromise = pollQR();

  await page.waitForFunction(
    sels => sels.some(sel => !!document.querySelector(sel)),
    { timeout: TIMING.loginTimeout },
    SEL.chatList
  );

  pollingActive = false;
  await pollPromise;
  await sleep(3_000);
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

  await page.goto(url, { waitUntil: 'networkidle2', timeout: TIMING.sendTimeout });

  let found = false;
  for (const sel of SEL.composeBox) {
    try {
      await page.waitForSelector(sel, { timeout: 8_000 });
      await page.click(sel);
      found = true;
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
}

// ── Close ─────────────────────────────────────────────────────
async function close() {
  if (browser) {
    try { await browser.close(); } catch (_) {}
    browser = null;
    page    = null;
  }
}

module.exports = { launch, waitForLogin, waitForLoginWithQR, sendMessage, close };
