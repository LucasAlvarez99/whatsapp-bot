/**
 * scriptgen.js — Generador del bot-runner.js
 * Toma contactos + mensaje + config de delays y produce el script Node.js.
 * Depende de: store.js, ui.js
 */

let sgContacts = [];
let sgMessage  = '';
let sgDelayMin = 28;
let sgDelayMax = 35;
let sgLoginTO  = 120;
let sgReady    = false;

// ── Init ─────────────────────────────────────────────────────
function sgInit() {
  sgContacts = Store.get('magic_contacts', []);
  sgMessage  = Store.get('magic_message',  '');
  sgUpdateChecklist();
  sgUpdateSummary();
}

// ── Checklist ────────────────────────────────────────────────
function sgUpdateChecklist() {
  const hasC = sgContacts.length > 0;
  const hasM = sgMessage.trim().length > 0;

  sgSetChk('chk-c',
    hasC ? 'ok' : 'fail',
    hasC ? '✓' : '✕',
    hasC ? sgContacts.length + ' contacto(s) listos' : 'Sin contactos — ir a Contactos'
  );

  sgSetChk('chk-m',
    hasM ? 'ok' : 'fail',
    hasM ? '✓' : '✕',
    hasM ? sgMessage.length + ' caracteres guardados' : 'Sin mensaje — ir a Mensaje'
  );

  if (!hasM) {
    sgSetChk('chk-v', 'warn', '⚠', 'Guardá el mensaje primero');
  } else {
    const vars     = sgMessage.match(/\{(\w+)\}/g) ?? [];
    const known    = new Set(['nombre', 'numero', 'tipo', 'empresa']);
    const unknowns = vars.filter(v => !known.has(v.slice(1, -1)));
    if (unknowns.length) {
      sgSetChk('chk-v', 'warn', '⚠', 'Variables no estándar: ' + unknowns.join(' '));
    } else if (!vars.length) {
      sgSetChk('chk-v', 'warn', '⚠', 'Sin variables — mismo texto para todos');
    } else {
      sgSetChk('chk-v', 'ok', '✓', vars.length + ' variable(s): ' + vars.join(' '));
    }
  }

  const btn = document.getElementById('btn-gen');
  if (btn) btn.disabled = !(hasC && hasM);
}

function sgSetChk(id, type, icon, sub) {
  const el    = document.getElementById(id);
  const icEl  = document.getElementById(id + '-icon');
  const subEl = document.getElementById(id + '-sub');
  if (el)    el.className      = 'chk-item ' + type;
  if (icEl)  icEl.textContent  = icon;
  if (subEl) subEl.textContent = sub;
}

// ── Sliders ──────────────────────────────────────────────────
function sgOnSlider() {
  sgDelayMin = parseInt(document.getElementById('sl-min').value);
  sgDelayMax = parseInt(document.getElementById('sl-max').value);
  sgLoginTO  = parseInt(document.getElementById('sl-login').value);
  if (sgDelayMax < sgDelayMin) {
    sgDelayMax = sgDelayMin;
    document.getElementById('sl-max').value = sgDelayMax;
  }
  document.getElementById('lbl-min').textContent   = sgDelayMin + ' s';
  document.getElementById('lbl-max').textContent   = sgDelayMax + ' s';
  document.getElementById('lbl-login').textContent = sgLoginTO  + ' s';
  sgUpdateSummary();
  if (sgReady) sgBuild();
}

// ── Summary ──────────────────────────────────────────────────
function sgUpdateSummary() {
  const n   = sgContacts.length;
  const avg = (sgDelayMin + sgDelayMax) / 2;
  document.getElementById('sum-n').textContent   = n;
  document.getElementById('sum-msg').textContent = sgMessage ? sgMessage.length + ' chars ✓' : 'No guardado';
  document.getElementById('sum-avg').textContent = avg.toFixed(1) + ' s';
  if (n > 0) {
    const mins = Math.round(n * avg / 60);
    const el = document.getElementById('sum-time');
    el.textContent = '~' + mins + ' min';
    el.className   = 'summary-val ok';
  } else {
    const el = document.getElementById('sum-time');
    el.textContent = '—';
    el.className   = 'summary-val';
  }
}

// ── Generate ─────────────────────────────────────────────────
function sgGenerate() {
  if (!sgContacts.length || !sgMessage.trim()) {
    toast('Completá el checklist primero', 'err');
    return;
  }
  sgBuild();
  sgReady = true;
  const dlRow = document.getElementById('download-row');
  if (dlRow) dlRow.style.display = 'flex';
  toast('Script generado — podés descargarlo', 'ok');
}

function sgBuild() {
  const clean = sgContacts.map(({ id, _valid, _error, ...c }) => c);

  const escapedMsg = sgMessage
    .replace(/\\/g, '\\\\')
    .replace(/`/g,  '\\`')
    .replace(/\$/g, '\\$');

  const script = [
    '/**',
    ' * bot-runner.js — Generado por Magic Show Bot v3.1',
    ' * Requisitos: node >= 18 · npm install puppeteer',
    ' * Uso:        node bot-runner.js',
    ' * Controles:  P = pausar/reanudar | Ctrl+C = detener',
    ' */',
    "'use strict';",
    '',
    "const puppeteer = require('puppeteer');",
    "const readline  = require('readline');",
    '',
    '// ── Configuración ──────────────────────────────────────────',
    'const CONFIG = {',
    '  delayMin:     ' + (sgDelayMin * 1000) + ',',
    '  delayMax:     ' + (sgDelayMax * 1000) + ',',
    '  loginTimeout: ' + (sgLoginTO  * 1000) + ',',
    '  sendTimeout:  30000,',
    '  afterSend:    3000,',
    '  humanPause:   1200,',
    '  headless:     false,',
    "  sessionDir:   './session',",
    '};',
    '',
    '// ── Mensaje ────────────────────────────────────────────────',
    'const MENSAJE_TEMPLATE = `' + escapedMsg + '`;',
    '',
    '// ── Contactos ──────────────────────────────────────────────',
    '// ' + clean.length + ' contacto(s) — generado: ' + new Date().toLocaleString('es-AR'),
    'const CONTACTOS = ' + JSON.stringify(clean, null, 2) + ';',
    '',
    '// ── Selectores WhatsApp Web (fallbacks) ───────────────────',
    'const SEL = {',
    '  chatList: [',
    '    \'[data-testid="chat-list"]\',',
    '    \'#pane-side\',',
    '    \'div[aria-label="Chat list"]\',',
    '    \'div[aria-label="Lista de chats"]\',',
    '    \'div[role="grid"]\',',
    '  ],',
    '  composeBox: [',
    '    \'[data-testid="conversation-compose-box-input"]\',',
    '    \'div[contenteditable="true"][data-tab="10"]\',',
    '    \'div[contenteditable="true"][data-tab="1"]\',',
    '    \'footer div[contenteditable="true"]\',',
    '    \'div[contenteditable="true"][role="textbox"]\',',
    '  ],',
    '  errorPopup: \'[data-testid="popup-contents"]\',',
    '};',
    '',
    '// ── Estado ─────────────────────────────────────────────────',
    'let pausado = false;',
    'let browser = null;',
    'let page    = null;',
    '',
    '// ── Utilidades ─────────────────────────────────────────────',
    'const sleep = ms => new Promise(r => setTimeout(r, ms));',
    '',
    'function personalize(template, contact) {',
    '  return template.replace(/\\{(\\w+)\\}/g, (match, key) =>',
    '    (contact[key] !== undefined && contact[key] !== \'\') ? contact[key] : match',
    '  );',
    '}',
    '',
    'function randomDelay(min, max) {',
    '  const ms = Math.floor(Math.random() * (max - min + 1)) + min;',
    '  console.log(`  ⏳ Esperando ${(ms / 1000).toFixed(1)}s...`);',
    '  return sleep(ms);',
    '}',
    '',
    '// ── Teclado ─────────────────────────────────────────────────',
    'function initKeyboard() {',
    '  readline.emitKeypressEvents(process.stdin);',
    '  if (process.stdin.isTTY) process.stdin.setRawMode(true);',
    '  process.stdin.on(\'keypress\', (str, key) => {',
    '    if (!key) return;',
    '    if (key.name === \'p\') {',
    '      pausado = !pausado;',
    '      console.log(pausado ? \'\\n⏸  PAUSADO\' : \'\\n▶  REANUDADO\');',
    '    }',
    '    if (key.ctrl && key.name === \'c\') {',
    '      console.log(\'\\n🛑 Deteniendo...\');',
    '      shutdown(0);',
    '    }',
    '  });',
    '  console.log(\'💡 [P] pausar/reanudar  |  [Ctrl+C] detener\\n\');',
    '}',
    '',
    '// ── Navegador ───────────────────────────────────────────────',
    'async function launch() {',
    '  const fs = require(\'fs\');',
    '  if (!fs.existsSync(CONFIG.sessionDir))',
    '    fs.mkdirSync(CONFIG.sessionDir, { recursive: true });',
    '  console.log(\'🚀 Iniciando Chrome...\');',
    '  browser = await puppeteer.launch({',
    '    headless:    CONFIG.headless,',
    '    userDataDir: CONFIG.sessionDir,',
    '    args: [\'--no-sandbox\', \'--disable-setuid-sandbox\', \'--disable-dev-shm-usage\'],',
    '  });',
    '  page = (await browser.pages())[0] || await browser.newPage();',
    '  await page.setViewport({ width: 1280, height: 800 });',
    '  console.log(\'🌐 Abriendo WhatsApp Web...\');',
    '  await page.goto(\'https://web.whatsapp.com\', { waitUntil: \'networkidle2\', timeout: 60000 });',
    '}',
    '',
    '// ── Login ───────────────────────────────────────────────────',
    'async function waitLogin() {',
    '  console.log(\'🔄 Esperando sesión — escaneá el QR si es necesario...\');',
    '  await page.waitForFunction(',
    '    sels => sels.some(sel => !!document.querySelector(sel)),',
    '    { timeout: CONFIG.loginTimeout },',
    '    SEL.chatList',
    '  );',
    '  console.log(\'✅ Sesión activa.\\n\');',
    '  await sleep(3000);',
    '}',
    '',
    '// ── Enviar ──────────────────────────────────────────────────',
    'async function sendMessage(numero, texto) {',
    '  const clean = numero.replace(/\\D/g, \'\');',
    '  const url   = `https://web.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(texto)}`;',
    '  await page.goto(url, { waitUntil: \'networkidle2\', timeout: CONFIG.sendTimeout });',
    '  let found = false;',
    '  for (const sel of SEL.composeBox) {',
    '    try {',
    '      await page.waitForSelector(sel, { timeout: 8000 });',
    '      await page.click(sel);',
    '      found = true; break;',
    '    } catch {}',
    '  }',
    '  if (!found) throw new Error(\'No se encontró el cuadro de texto. Actualizá puppeteer.\');',
    '  await sleep(CONFIG.humanPause + Math.random() * 800);',
    '  await page.keyboard.press(\'Enter\');',
    '  await sleep(CONFIG.afterSend);',
    '  const errEl = await page.$(SEL.errorPopup);',
    '  if (errEl) {',
    '    const txt = await page.evaluate(el => el.innerText, errEl);',
    '    throw new Error(\'WhatsApp: \' + txt.slice(0, 120));',
    '  }',
    '}',
    '',
    '// ── Shutdown ────────────────────────────────────────────────',
    'async function shutdown(code = 0) {',
    '  if (browser) try { await browser.close(); } catch {}',
    '  process.exit(code);',
    '}',
    '',
    '// ── Main ────────────────────────────────────────────────────',
    'async function main() {',
    '  console.log(\'\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\');',
    '  console.log(\'   🎩 Magic Show Bot v3.1\');',
    '  console.log(`   📋 Contactos: ${CONTACTOS.length} | Delay: ${CONFIG.delayMin/1000}s–${CONFIG.delayMax/1000}s`);',
    '  console.log(\'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\');',
    '  initKeyboard();',
    '  await launch();',
    '  await waitLogin();',
    '  let enviados = 0, errores = 0;',
    '  for (let i = 0; i < CONTACTOS.length; i++) {',
    '    const c    = CONTACTOS[i];',
    '    const prog = `[${i + 1}/${CONTACTOS.length}]`;',
    '    while (pausado) await sleep(500);',
    '    console.log(`${prog} 📤 ${c.nombre} (${c.numero})`);',
    '    try {',
    '      await sendMessage(c.numero, personalize(MENSAJE_TEMPLATE, c));',
    '      enviados++;',
    '      console.log(`${prog} ✅ Enviado — ${c.nombre}`);',
    '    } catch (err) {',
    '      errores++;',
    '      console.log(`${prog} ❌ Error — ${c.nombre}: ${err.message}`);',
    '    }',
    '    console.log(`    Progreso: ${enviados} ok, ${errores} err, ${CONTACTOS.length - i - 1} pendientes\\n`);',
    '    if (i < CONTACTOS.length - 1) await randomDelay(CONFIG.delayMin, CONFIG.delayMax);',
    '  }',
    '  console.log(\'\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\');',
    '  console.log(`🏁 COMPLETADO — Enviados: ${enviados} | Errores: ${errores}`);',
    '  console.log(\'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\');',
    '  await shutdown(errores > 0 ? 1 : 0);',
    '}',
    '',
    "main().catch(async err => { console.error('\\n💥 Error fatal:', err.message); await shutdown(1); });",
  ].join('\n');

  document.getElementById('script-out').textContent = script;
}

// ── Download / Copy ──────────────────────────────────────────
function sgGetScript() {
  return document.getElementById('script-out').textContent.trim();
}

function sgDownload() {
  const s = sgGetScript();
  if (s.startsWith('—')) { toast('Generá el script primero', 'err'); return; }
  const blob = new Blob([s], { type: 'text/javascript' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'bot-runner.js';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  toast('bot-runner.js descargado', 'ok');
}

function sgCopy() {
  const s = sgGetScript();
  if (s.startsWith('—')) { toast('Generá el script primero', 'err'); return; }
  navigator.clipboard.writeText(s)
    .then(() => toast('Script copiado', 'ok'))
    .catch(() => toast('No se pudo copiar — usá Descargar', 'err'));
}