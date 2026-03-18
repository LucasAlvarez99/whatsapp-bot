/**
 * WhatsApp Web Automation Bot
 * Envía mensajes personalizados a una lista de contactos con delays seguros.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── Configuración ─────────────────────────────────────────────────────────────
const CONFIG = {
  delayMin: 28000,        // Delay mínimo entre mensajes (ms)
  delayMax: 35000,        // Delay máximo entre mensajes (ms)
  loginTimeout: 120000,   // Tiempo máximo para escanear QR (ms)
  sessionDir: './session',
  contactsFile: './contactos.json',
  mensajesFile: './mensajes.txt',
  logFile: './logs/envios.log',
  headless: false,        // false = muestra el navegador (necesario para QR)
};

// ─── Estado global ──────────────────────────────────────────────────────────────
let pausado = false;
let totalEnviados = 0;
let totalErrores = 0;
let browser = null;
let page = null;

// ─── Utilidades ─────────────────────────────────────────────────────────────────

/**
 * Espera un tiempo aleatorio entre min y max milisegundos.
 */
function esperarRandom(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  const segundos = (ms / 1000).toFixed(1);
  log(`⏳ Esperando ${segundos}s antes del próximo mensaje...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Logger con timestamp, salida en consola y archivo.
 */
function log(mensaje, nivel = 'INFO') {
  const timestamp = new Date().toISOString();
  const linea = `[${timestamp}] [${nivel}] ${mensaje}`;
  console.log(linea);

  // Guardar en archivo de log
  const logDir = path.dirname(CONFIG.logFile);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(CONFIG.logFile, linea + '\n');
}

/**
 * Lee y parsea el archivo de contactos (JSON o CSV).
 */
function leerContactos() {
  const archivo = CONFIG.contactsFile;
  if (!fs.existsSync(archivo)) {
    throw new Error(`Archivo de contactos no encontrado: ${archivo}`);
  }

  const ext = path.extname(archivo).toLowerCase();

  if (ext === '.json') {
    const raw = fs.readFileSync(archivo, 'utf-8');
    return JSON.parse(raw);
  }

  if (ext === '.csv') {
    const lineas = fs.readFileSync(archivo, 'utf-8').split('\n').filter(Boolean);
    const headers = lineas[0].split(',').map(h => h.trim());
    return lineas.slice(1).map(linea => {
      const valores = linea.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = valores[i] || ''; });
      return obj;
    });
  }

  throw new Error(`Formato de contactos no soportado: ${ext}. Usá .json o .csv`);
}

/**
 * Lee el mensaje plantilla desde mensajes.txt.
 */
function leerMensajePlantilla() {
  if (!fs.existsSync(CONFIG.mensajesFile)) {
    throw new Error(`Archivo de mensajes no encontrado: ${CONFIG.mensajesFile}`);
  }
  return fs.readFileSync(CONFIG.mensajesFile, 'utf-8').trim();
}

/**
 * Personaliza el mensaje reemplazando {variables} con datos del contacto.
 */
function personalizarMensaje(plantilla, contacto) {
  return plantilla.replace(/\{(\w+)\}/g, (match, clave) => {
    return contacto[clave] !== undefined ? contacto[clave] : match;
  });
}

/**
 * Valida que el contacto tenga número y nombre.
 */
function validarContacto(contacto) {
  if (!contacto.numero) return 'Falta el campo "numero"';
  const numLimpio = contacto.numero.replace(/\D/g, '');
  if (numLimpio.length < 10) return `Número inválido: ${contacto.numero}`;
  return null;
}

// ─── Control de teclado (pausa/reanudar) ───────────────────────────────────────

function iniciarControlTeclado() {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  process.stdin.on('keypress', (str, key) => {
    if (key.name === 'p') {
      pausado = !pausado;
      log(pausado ? '⏸  Envíos PAUSADOS. Presioná P para reanudar.' : '▶️  Envíos REANUDADOS.', 'CTRL');
    }
    if (key.ctrl && key.name === 'c') {
      log(`🛑 Interrupción manual. Enviados: ${totalEnviados} | Errores: ${totalErrores}`, 'CTRL');
      if (browser) browser.close();
      process.exit(0);
    }
  });

  log('💡 Presioná P para pausar/reanudar. Ctrl+C para salir.', 'INFO');
}

// ─── WhatsApp Web ───────────────────────────────────────────────────────────────

/**
 * Lanza el navegador y abre WhatsApp Web.
 * Reutiliza sesión si existe para evitar escanear QR cada vez.
 */
async function iniciarNavegador() {
  // Crear carpeta de sesión si no existe
  if (!fs.existsSync(CONFIG.sessionDir)) {
    fs.mkdirSync(CONFIG.sessionDir, { recursive: true });
  }

  log('🚀 Iniciando navegador...');

  browser = await puppeteer.launch({
    headless: CONFIG.headless,
    userDataDir: CONFIG.sessionDir, // Guarda cookies/sesión aquí
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1280,800',
    ],
  });

  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  log('🌐 Abriendo WhatsApp Web...');
  await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 60000 });
}

/**
 * Espera a que el usuario inicie sesión (escaneo de QR o sesión existente).
 */
async function esperarLogin() {
  log('🔄 Verificando sesión...');

  try {
    // Selector del panel principal de WhatsApp Web (indica login exitoso)
    await page.waitForSelector('#app > div > div.two._3bpqn', {
      timeout: CONFIG.loginTimeout,
    });
    log('✅ Sesión iniciada correctamente.');
  } catch {
    // Fallback: esperar cualquier indicador de que cargó
    try {
      await page.waitForSelector('[data-testid="chat-list"]', {
        timeout: CONFIG.loginTimeout,
      });
      log('✅ Sesión iniciada correctamente.');
    } catch {
      throw new Error('No se pudo iniciar sesión. Asegurate de escanear el QR dentro de los 2 minutos.');
    }
  }
}

/**
 * Envía un mensaje a un número de WhatsApp.
 * @param {string} numero - Número con código de país, sin espacios ni símbolos
 * @param {string} mensaje - Texto a enviar
 */
async function enviarMensaje(numero, mensaje) {
  const numLimpio = numero.replace(/\D/g, '');

  // Navegamos directamente a la URL de chat (no necesitamos buscar el contacto)
  const url = `https://web.whatsapp.com/send?phone=${numLimpio}&text=${encodeURIComponent(mensaje)}`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // Esperar que aparezca el campo de texto
  const selectorInput = '[data-testid="conversation-compose-box-input"]';
  await page.waitForSelector(selectorInput, { timeout: 20000 });

  // Pequeña pausa humana antes de enviar
  await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

  // Enviar con Enter
  await page.keyboard.press('Enter');

  // Esperar confirmación visual (checkmarks)
  await new Promise(r => setTimeout(r, 3000));

  // Verificar que no aparezca el diálogo de "número inválido"
  const hayError = await page.$('[data-testid="popup-contents"]');
  if (hayError) {
    const textoError = await page.evaluate(el => el.innerText, hayError);
    throw new Error(`WhatsApp reportó error: ${textoError.substring(0, 80)}`);
  }
}

// ─── Loop principal ─────────────────────────────────────────────────────────────

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   📱 WhatsApp Bot - Mensajes Automáticos  ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Cargar recursos
  let contactos, plantilla;
  try {
    contactos = leerContactos();
    plantilla = leerMensajePlantilla();
    log(`📋 ${contactos.length} contactos cargados.`);
    log(`💬 Plantilla: "${plantilla.substring(0, 60)}..."`);
  } catch (err) {
    log(`❌ Error al cargar recursos: ${err.message}`, 'ERROR');
    process.exit(1);
  }

  // Iniciar control de teclado
  iniciarControlTeclado();

  // Iniciar navegador y sesión
  try {
    await iniciarNavegador();
    await esperarLogin();
  } catch (err) {
    log(`❌ Error al iniciar: ${err.message}`, 'ERROR');
    if (browser) await browser.close();
    process.exit(1);
  }

  log(`\n🚀 Iniciando envíos...`);
  log(`⚙️  Delay: ${CONFIG.delayMin / 1000}s - ${CONFIG.delayMax / 1000}s entre mensajes\n`);

  // ─── Loop de envíos ──────────────────────────────────────────────
  for (let i = 0; i < contactos.length; i++) {
    const contacto = contactos[i];
    const progreso = `[${i + 1}/${contactos.length}]`;

    // Esperar si está pausado
    while (pausado) {
      await new Promise(r => setTimeout(r, 1000));
    }

    // Validar contacto
    const errorValidacion = validarContacto(contacto);
    if (errorValidacion) {
      log(`${progreso} ⚠️  SKIP - ${contacto.nombre || 'Sin nombre'} - ${errorValidacion}`, 'WARN');
      totalErrores++;
      continue;
    }

    // Personalizar mensaje
    const mensajeFinal = personalizarMensaje(plantilla, contacto);

    // Enviar
    try {
      log(`${progreso} 📤 Enviando a ${contacto.nombre} (${contacto.numero})...`);
      await enviarMensaje(contacto.numero, mensajeFinal);
      totalEnviados++;
      log(`${progreso} ✅ OK - ${contacto.nombre} (${contacto.numero})`, 'OK');
    } catch (err) {
      totalErrores++;
      log(`${progreso} ❌ ERROR - ${contacto.nombre} (${contacto.numero}) - ${err.message}`, 'ERROR');
    }

    // Mostrar resumen parcial
    log(`📊 Progreso: ${totalEnviados} enviados, ${totalErrores} errores`);

    // Delay entre mensajes (excepto después del último)
    if (i < contactos.length - 1) {
      await esperarRandom(CONFIG.delayMin, CONFIG.delayMax);
    }
  }

  // ─── Resumen final ───────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`✅ COMPLETADO - Total enviados: ${totalEnviados} | Errores: ${totalErrores}`, 'DONE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await browser.close();
}

// ─── Arranque ───────────────────────────────────────────────────────────────────
main().catch(err => {
  log(`💥 Error fatal: ${err.message}`, 'FATAL');
  if (browser) browser.close();
  process.exit(1);
});