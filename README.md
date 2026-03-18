# 📱 WhatsApp Bot — Mensajes Automáticos

Bot de envío automatizado de mensajes por WhatsApp Web, construido con Node.js y Puppeteer.

---

## 📋 Tabla de contenidos

- [Requisitos previos](#-requisitos-previos)
- [Instalación paso a paso](#-instalación-paso-a-paso)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Cómo cargar contactos](#-cómo-cargar-contactos)
- [Cómo personalizar mensajes](#-cómo-personalizar-mensajes)
- [Cómo ejecutar](#-cómo-ejecutar)
- [Controles durante la ejecución](#-controles-durante-la-ejecución)
- [Buenas prácticas para evitar bloqueos](#-buenas-prácticas-para-evitar-bloqueos)
- [Configuración avanzada](#-configuración-avanzada)
- [Solución de problemas](#-solución-de-problemas)
- [Advertencias importantes](#-advertencias-importantes)

---

## ✅ Requisitos previos

- **Node.js** versión 18 o superior → [nodejs.org](https://nodejs.org)
- **Google Chrome** instalado (Puppeteer lo usa internamente)
- **Cuenta de WhatsApp** activa en tu celular
- **Conexión a internet** estable

Verificá que tenés Node instalado:

```bash
node --version
# Debe mostrar v18.x.x o superior
```

---

## 🚀 Instalación paso a paso

### 1. Descargá o cloná el proyecto

```bash
git clone https://github.com/tu-usuario/whatsapp-bot.git
cd whatsapp-bot
```

O simplemente copiá los archivos a una carpeta en tu computadora.

### 2. Instalá las dependencias

```bash
npm install
```

Esto instalará Puppeteer (~300MB, incluye Chromium).

### 3. Configurá tus contactos

Editá el archivo `contactos.json` con tus datos (ver sección de contactos).

### 4. Configurá tu mensaje

Editá el archivo `mensajes.txt` con el texto que querés enviar.

### 5. Ejecutá el bot

```bash
npm start
```

---

## 📁 Estructura del proyecto

```
whatsapp-bot/
├── index.js          → Código principal del bot
├── contactos.json    → Lista de contactos (formato JSON)
├── contactos.csv     → Lista de contactos (formato CSV alternativo)
├── mensajes.txt      → Plantilla del mensaje a enviar
├── package.json      → Configuración del proyecto
├── README.md         → Este archivo
├── session/          → Carpeta de sesión (se crea automáticamente)
│   └── ...           → Datos de sesión de WhatsApp (no borrar)
└── logs/
    └── envios.log    → Historial completo de envíos
```

---

## 👥 Cómo cargar contactos

### Formato JSON (recomendado)

Editá `contactos.json`. Cada contacto es un objeto con al menos `nombre` y `numero`:

```json
[
  {
    "nombre": "María García",
    "numero": "5491112345678",
    "empresa": "TechCorp",
    "producto": "Plan Pro"
  },
  {
    "nombre": "Juan Pérez",
    "numero": "5491198765432",
    "empresa": "StartupBA",
    "producto": "Plan Básico"
  }
]
```

### Formato CSV (alternativo)

También podés usar `contactos.csv`. Cambiá `contactsFile` en la config a `'./contactos.csv'`:

```csv
nombre,numero,empresa,producto
María García,5491112345678,TechCorp,Plan Pro
Juan Pérez,5491198765432,StartupBA,Plan Básico
```

### Formato del número de teléfono

El número debe incluir el **código de país** sin espacios, guiones ni símbolos:

| País        | Prefijo | Ejemplo correcto    |
|-------------|---------|---------------------|
| Argentina   | 54      | `5491112345678`     |
| México      | 52      | `5215512345678`     |
| España      | 34      | `34612345678`       |
| Colombia    | 57      | `5731512345678`     |
| Chile       | 56      | `56912345678`       |

> ⚠️ Para Argentina: incluí el 9 después del 54 (ej: 54**9**11...). Sin el 9 puede fallar.

### Podés agregar cualquier campo personalizado

Agregá los campos que necesites al JSON/CSV, y luego usalos en el mensaje con `{nombre_del_campo}`.

---

## 💬 Cómo personalizar mensajes

Editá el archivo `mensajes.txt`. Usá `{nombre_del_campo}` para insertar datos del contacto:

```
Hola {nombre}, ¿cómo estás? 👋

Te escribo sobre {producto} para tu empresa {empresa}.

¿Tenés 5 minutos para que te cuente más? 😊
```

Los `{campos}` se reemplazan automáticamente con los datos de cada contacto.

**Campos disponibles por defecto:**
- `{nombre}` → Nombre del contacto
- `{numero}` → Número de teléfono
- `{empresa}` → Empresa (si lo agregaste al JSON)
- `{producto}` → Producto (si lo agregaste al JSON)
- Cualquier campo extra que hayas definido en el JSON/CSV

---

## ▶️ Cómo ejecutar

```bash
npm start
```

Al ejecutar por primera vez:

1. Se abre Chrome con WhatsApp Web
2. Aparece el código QR
3. Abrí WhatsApp en tu celular → Dispositivos vinculados → Vincular dispositivo
4. Escaneá el QR con tu celular
5. El bot detecta el login y comienza a enviar

**Desde la segunda ejecución:** Si la sesión está guardada en `./session/`, no necesitás escanear el QR nuevamente.

---

## 🎮 Controles durante la ejecución

| Tecla   | Acción                        |
|---------|-------------------------------|
| `P`     | Pausar / Reanudar envíos      |
| `Ctrl+C`| Detener el bot completamente  |

Los logs se muestran en tiempo real en la consola y se guardan en `logs/envios.log`.

---

## 🛡️ Buenas prácticas para evitar bloqueos

WhatsApp puede detectar y bloquear números que envían mensajes de forma masiva. Seguí estas recomendaciones:

### ✅ Hacé esto

- **Usá delays de al menos 28-35 segundos** entre mensajes (ya configurado por defecto)
- **Enviá a contactos que te conocen** o que dieron consentimiento
- **Comenzá con listas pequeñas** (10-20 contactos) para probar
- **Usá el número de forma normal** también (respondé mensajes, usalo a diario)
- **Varía ligeramente los mensajes** si podés, para que no sean idénticos

### ❌ Evitá esto

- Enviar a cientos de contactos en una sola sesión
- Usar números nuevos o recién registrados para volumen alto
- Enviar el mismo mensaje exacto a muchos contactos seguidos
- Dejar el bot corriendo 24/7 sin pausas

### 📊 Límites sugeridos por sesión

| Situación                    | Máximo recomendado |
|------------------------------|--------------------|
| Número nuevo (< 1 mes)       | 20-30 mensajes/día |
| Número normal (> 3 meses)    | 50-80 mensajes/día |
| Número muy activo (> 1 año)  | 100-150 mensajes/día |

---

## ⚙️ Configuración avanzada

En `index.js`, encontrás el objeto `CONFIG` al inicio del archivo:

```javascript
const CONFIG = {
  delayMin: 28000,        // Delay mínimo entre mensajes (ms)
  delayMax: 35000,        // Delay máximo entre mensajes (ms)
  loginTimeout: 120000,   // Tiempo para escanear el QR (ms)
  sessionDir: './session',
  contactsFile: './contactos.json',  // o './contactos.csv'
  mensajesFile: './mensajes.txt',
  logFile: './logs/envios.log',
  headless: false,        // true = sin ventana (no recomendado)
};
```

Modificá los valores según tus necesidades.

---

## 🔧 Solución de problemas

### "No se pudo iniciar sesión"
- El QR expiró antes de escanearlo (tenés 2 minutos)
- Solucion: Volvé a ejecutar `npm start`

### "El número no existe" / Error al enviar
- El número no tiene WhatsApp activo
- El formato del número es incorrecto (falta código de país)
- WhatsApp bloqueó temporalmente el envío

### El bot se abre pero no hace nada
- WhatsApp Web puede haber cambiado sus selectores internos
- Revisá si hay una actualización del bot disponible

### "Cannot find module 'puppeteer'"
```bash
npm install
```

### El QR no aparece en pantalla
- Asegurate que `headless: false` en el CONFIG
- Esperá unos segundos, a veces tarda en cargar

### Sesión expirada (te pide QR de nuevo)
- WhatsApp cierra sesiones inactivas periódicamente
- Es normal, solo escaneás el QR nuevamente

---

## ⚠️ Advertencias importantes

> **Este bot es para uso personal y educativo.**

- **WhatsApp prohíbe** el uso de bots no oficiales en sus Términos de Servicio
- Usar bots para spam puede resultar en el **bloqueo permanente** de tu número
- **No envíes mensajes no solicitados** — respetá la privacidad de las personas
- El autor no se responsabiliza por cuentas suspendidas o bloqueadas
- Para uso comercial masivo, considerá la **API oficial de WhatsApp Business**

---

## 📈 Escalabilidad futura

Si necesitás escalar, considerá:

- **API oficial de WhatsApp Business** (Meta) — para envíos masivos legales
- **Twilio WhatsApp API** — integración sencilla para empresas
- Agregar una base de datos (SQLite/MongoDB) en lugar de archivos JSON
- Interfaz web con estado en tiempo real

---

*Creado con Node.js + Puppeteer*