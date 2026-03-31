/**
 * WhatsApp Magic Show Bot 🎩
 * Envía mensajes personalizados según el tipo de contacto:
 * cliente | cliente_nuevo | salon | empresa
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');
const readline  = require('readline');

// ─── Configuración ──────────────────────────────────────────────────────────────
const CONFIG = {
  delayMin:     28000,           // ms mínimo entre mensajes
  delayMax:     35000,           // ms máximo entre mensajes
  loginTimeout: 120000,          // ms para escanear el QR
  sessionDir:   './session',
  contactsFile: './contactos.csv',
  mensajesDir:  './mensajes',    // carpeta con los .txt de cada tipo
  logFile:      './logs/envios.log',
  headless:     false,
};

// Tipos válidos y el archivo .txt que corresponde a cada uno
const TIPOS = {
  cliente:       'mensaje_cliente.txt',
  cliente_nuevo: 'mensaje_cliente_nuevo.txt',
  salon:         'mensaje_salon.txt',
  empresa:       'mensaje_empresa.txt',
};

// ─── Estado global ──────────────────────────────────────────────────────────────
let pausado       = false;
let totalEnviados = 0;
let totalErrores  = 0;
let browser       = null;
let page          = null;

// ─── Logger ─────────────────────────────────────────────────────────────────────
function log(mensaje, nivel = 'INFO') {
  const timestamp = new Date().toISOString();
  const linea = `[${timestamp}] [${nivel}] ${mensaje}`;
  console.log(linea);
  const logDir = path.dirname(CONFIG.logFile);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(CONFIG.logFile, linea + '\n');
}

// ─── Lectura de contactos CSV ───────────────────────────────────────────────────
function leerContactos() {
  const archivo = CONFIG.contactsFile;
  if (!fs.existsSync(archivo)) {
    throw new Error(`No se encontró el archivo: ${archivo}`);
  }

  const lineas = fs.readFileSync(archivo, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  if (lineas.length < 2) throw new Error('El CSV está vacío o solo tiene encabezado.');

  const headers = lineas[0].split(',').map(h => h.trim().toLowerCase());
  const requeridos = ['nombre', 'numero', 'tipo'];
  for (const campo of requeridos) {
    if (!headers.includes(campo)) {
      throw new Error(`El CSV debe tener la columna "${campo}". Columnas encontradas: ${headers.join(', ')}`);
    }
  }

  return lineas.slice(1).map((linea, i) => {
    const valores = linea.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = valores[idx] || ''; });
    obj._fila = i + 2;
    return obj;
  });
}

// ─── Carga de plantillas de mensajes ───────────────────────────────────────────
function cargarPlantillas() {
  const plantillas = {};
  const dir = CONFIG.mensajesDir;

  if (!fs.existsSync(dir)) {
    throw new Error(`No se encontró la carpeta de mensajes: ${dir}`);
  }

  for (const [tipo, archivo] of Object.entries(TIPOS)) {
    const rutaCompleta = path.join(dir, archivo);
    if (!fs.existsSync(rutaCompleta)) {
      throw new Error(`Falta el archivo de mensaje: ${rutaCompleta}`);
    }
    plantillas[tipo] = fs.readFileSync(rutaCompleta, 'utf-8').trim();
    log(`📄 Plantilla cargada: ${archivo}`);
  }

  return plantillas;
}

// ─── Personalización del mensaje ───────────────────────────────────────────────
function personalizarMensaje(plantilla, contacto) {
  return plantilla.replace(/\{(\w+)\}/g, (match, clave) => {
    return contacto[clave] !== undefined && contacto[clave] !== ''
      ? contacto[clave]
      : match;
  });
}

// ─── Validación de contacto ─────────────────────────────────────────────────────
function validarContacto(contacto) {
  if (!contacto.nombre) return 'Falta el campo "nombre"';
  if (!contacto.numero) return 'Falta el campo "numero"';

  const numLimpio = contacto.numero.replace(/\D/g, '');
  if (numLimpio.length < 10) return `Número inválido: "${contacto.numero}"`;

  const tipoLimpio = contacto.tipo ? contacto.tipo.trim().toLowerCase() : '';
  if (!tipoLimpio) return 'Falta el campo "tipo"';
  if (!TIPOS[tipoLimpio]) {
    return `Tipo desconocido: "${contacto.tipo}". Válidos: ${Object.keys(TIPOS).join(', ')}`;
  }

  return null;
}

// ─── Control de teclado ─────────────────────────────────────────────────────────
function iniciarControlTeclado() {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  process.stdin.on('keypress', (str, key) => {
    if (key && key.name === 'p') {
      pausado = !pausado;
      log(pausado
        ? '⏸  Envíos PAUSADOS. Presioná P para reanudar.'
        : '▶️  Envíos REANUDADOS.',
        'CTRL');
    }
    if (key && key.ctrl && key.name === 'c') {
      log(`🛑 Detenido manualmente. Enviados: ${totalEnviados} | Errores: ${totalErrores}`, 'CTRL');
      if (browser) browser.close();
      process.exit(0);
    }
  });

  log('💡 P = pausar/reanudar  |  Ctrl+C = salir');
}

// ─── Delay aleatorio ────────────────────────────────────────────────────────────
function esperarRandom(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  log(`⏳ Esperando ${(ms / 1000).toFixed(1)}s...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Puppeteer: iniciar navegador ───────────────────────────────────────────────
async function iniciarNavegador() {
  if (!fs.existsSync(CONFIG.sessionDir)) {
    fs.mkdirSync(CONFIG.sessionDir, { recursive: true });
  }

  log('🚀 Iniciando navegador...');
  browser = await puppeteer.launch({
    headless: CONFIG.headless,
    userDataDir: CONFIG.sessionDir,
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
  await page.goto('https://web.whatsapp.com', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
}

// ─── Puppeteer: esperar login ────────────────────────────────────────────────────
// FIX: WhatsApp Web cambia sus selectores con frecuencia.
// Probamos múltiples a la vez para mayor robustez.
async function esperarLogin() {
  log('🔄 Esperando inicio de sesión (escaneá el QR si es necesario)...');
  try {
    await page.waitForFunction(
      () => {
        return (
          document.querySelector('[data-testid="chat-list"]') !== null ||
          document.querySelector('div[aria-label="Lista de chats"]') !== null ||
          document.querySelector('div[aria-label="Chat list"]') !== null ||
          document.querySelector('div[role="grid"]') !== null ||
          document.querySelector('#pane-side') !== null ||
          document.querySelector('div[data-testid="default-user"]') !== null
        );
      },
      { timeout: CONFIG.loginTimeout }
    );
    log('✅ Sesión iniciada.');
    // Pausa extra para que WhatsApp cargue completamente
    await new Promise(r => setTimeout(r, 3000));
  } catch {
    throw new Error('No se detectó el inicio de sesión. Asegurate de escanear el QR dentro de los 2 minutos.');
  }
}

// ─── Puppeteer: enviar mensaje ───────────────────────────────────────────────────
// FIX: Selector del cuadro de texto actualizado con múltiples fallbacks.
async function enviarMensaje(numero, mensaje) {
  const numLimpio = numero.replace(/\D/g, '');
  const url = `https://web.whatsapp.com/send?phone=${numLimpio}&text=${encodeURIComponent(mensaje)}`;

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // Intentamos múltiples selectores posibles para el cuadro de texto
  const selectores = [
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][data-tab="1"]',
    'footer div[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    '[data-testid="conversation-compose-box-input"]',
  ];

  let inputEncontrado = false;
  for (const selector of selectores) {
    try {
      await page.waitForSelector(selector, { timeout: 8000 });
      await page.click(selector);
      inputEncontrado = true;
      break;
    } catch {
      // Probar el siguiente
    }
  }

  if (!inputEncontrado) {
    throw new Error('No se encontró el cuadro de texto. WhatsApp puede haber cambiado su interfaz.');
  }

  // Pausa humana antes de enviar
  await new Promise(r => setTimeout(r, 1200 + Math.random() * 1000));

  await page.keyboard.press('Enter');

  // Esperar que el mensaje se envíe
  await new Promise(r => setTimeout(r, 3000));

  // Detectar error de número inválido
  const hayError = await page.$('[data-testid="popup-contents"]');
  if (hayError) {
    const textoError = await page.evaluate(el => el.innerText, hayError);
    throw new Error(`WhatsApp reportó: ${textoError.substring(0, 100)}`);
  }
}

// ─── Loop principal ──────────────────────────────────────────────────────────────
async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   🎩 Magic Show Bot — Mensajes por tipo     ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Cargar contactos y plantillas
  let contactos, plantillas;
  try {
    contactos  = leerContactos();
    plantillas = cargarPlantillas();
  } catch (err) {
    log(`❌ ${err.message}`, 'ERROR');
    process.exit(1);
  }

  // Resumen de contactos por tipo
  const resumen = {};
  for (const tipo of Object.keys(TIPOS)) resumen[tipo] = 0;
  resumen['invalido'] = 0;

  for (const c of contactos) {
    const tipo = c.tipo ? c.tipo.trim().toLowerCase() : '';
    if (TIPOS[tipo]) resumen[tipo]++;
    else resumen['invalido']++;
  }

  log(`📋 Contactos cargados: ${contactos.length} total`);
  log(`   ├─ 🧑 clientes:        ${resumen.cliente}`);
  log(`   ├─ 🆕 clientes nuevos: ${resumen.cliente_nuevo}`);
  log(`   ├─ 🏛️  salones:         ${resumen.salon}`);
  log(`   ├─ 🏢 empresas:        ${resumen.empresa}`);
  if (resumen.invalido > 0)
    log(`   └─ ⚠️  tipo inválido:   ${resumen.invalido}`, 'WARN');

  // 2. Iniciar control de teclado
  iniciarControlTeclado();

  // 3. Iniciar navegador y login
  try {
    await iniciarNavegador();
    await esperarLogin();
  } catch (err) {
    log(`❌ ${err.message}`, 'ERROR');
    if (browser) await browser.close();
    process.exit(1);
  }

  log(`\n🚀 Iniciando envíos...`);
  log(`⚙️  Delay: ${CONFIG.delayMin / 1000}s – ${CONFIG.delayMax / 1000}s entre mensajes\n`);

  // 4. Loop de envíos
  for (let i = 0; i < contactos.length; i++) {
    const contacto = contactos[i];
    const progreso = `[${i + 1}/${contactos.length}]`;

    // Esperar si está pausado
    while (pausado) await new Promise(r => setTimeout(r, 500));

    // Validar
    const errorValidacion = validarContacto(contacto);
    if (errorValidacion) {
      log(`${progreso} ⚠️  SKIP fila ${contacto._fila} — ${contacto.nombre || '?'} — ${errorValidacion}`, 'WARN');
      totalErrores++;
      continue;
    }

    const tipo = contacto.tipo.trim().toLowerCase();
    const plantilla = plantillas[tipo];
    const mensajeFinal = personalizarMensaje(plantilla, contacto);

    const etiquetaTipo = {
      cliente:       '🧑 cliente',
      cliente_nuevo: '🆕 cliente nuevo',
      salon:         '🏛️  salón',
      empresa:       '🏢 empresa',
    }[tipo];

    try {
      log(`${progreso} 📤 ${etiquetaTipo} — ${contacto.nombre} (${contacto.numero})`);
      await enviarMensaje(contacto.numero, mensajeFinal);
      totalEnviados++;
      log(`${progreso} ✅ OK — ${contacto.nombre}`, 'OK');
    } catch (err) {
      totalErrores++;
      log(`${progreso} ❌ ERROR — ${contacto.nombre} (${contacto.numero}) — ${err.message}`, 'ERROR');
    }

    log(`📊 Enviados: ${totalEnviados} | Errores: ${totalErrores}`);

    // Delay solo si no es el último
    if (i < contactos.length - 1) {
      await esperarRandom(CONFIG.delayMin, CONFIG.delayMax);
    }
  }

  // 5. Resumen final
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`🏁 COMPLETADO — Enviados: ${totalEnviados} | Errores: ${totalErrores}`, 'DONE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await browser.close();
}

main().catch(err => {
  log(`💥 Error fatal: ${err.message}`, 'FATAL');
  if (browser) browser.close();
  process.exit(1);
});