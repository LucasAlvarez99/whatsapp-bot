# 🎩 Magic Show Bot v3

Bot de WhatsApp para enviar mensajes personalizados según el tipo de contacto.

---

## 📁 Estructura del proyecto

```
magic-show-bot/
│
├── src/                          → Código fuente (todo acá)
│   ├── index.js                  → Punto de entrada — orquestador delgado
│   ├── sender.js                 → Loop de envíos
│   │
│   ├── config/
│   │   └── config.js             → ⭐ Configuración central (delays, rutas, selectores)
│   │
│   ├── contacts/
│   │   └── contactReader.js      → Lectura y validación del CSV
│   │
│   ├── messages/
│   │   └── messageLoader.js      → Carga de plantillas y personalización
│   │
│   ├── browser/
│   │   └── browserManager.js     → Ciclo de vida de Puppeteer (lanzar, login, enviar)
│   │
│   └── utils/
│       ├── logger.js             → Logging centralizado con colores y archivo
│       ├── delay.js              → Delays aleatorios humanizados
│       ├── keyboardController.js → Control P/Ctrl+C
│       └── validateContacts.js   → Script de validación standalone
│
├── mensajes/                     → Plantillas de texto por tipo
│   ├── mensaje_cliente.txt
│   ├── mensaje_cliente_nuevo.txt
│   ├── mensaje_salon.txt
│   └── mensaje_empresa.txt
│
├── leads/
│   └── magic-leads-app.html      → App de búsqueda y gestión de contactos
│
├── contactos.csv                 → Lista de contactos
├── session/                      → Sesión de WhatsApp (auto-generado)
├── logs/
│   └── envios.log                → Historial de envíos
└── package.json
```

---

## ⚙️ Instalación

```bash
npm install
```

---

## 🚀 Uso

### 1. Validar antes de enviar (recomendado)
```bash
npm run validate
```
Muestra qué contactos están bien, cuáles tienen errores y un preview de cada mensaje — **sin abrir el navegador**.

### 2. Enviar
```bash
npm start
```

### 3. Gestión de contactos (app visual)
```bash
npm run leads
```
Abre la app de búsqueda de salones/empresas cercanos y gestión de la base de datos.

---

## 🔧 Configuración

**Todo en un solo archivo: `src/config/config.js`**

| Sección      | Qué controla                              |
|--------------|-------------------------------------------|
| `timing`     | Delays entre mensajes, timeouts           |
| `paths`      | Rutas a CSV, mensajes, sesión, log        |
| `types`      | Tipos de contacto y su archivo .txt       |
| `browser`    | Opciones de Puppeteer                     |
| `whatsapp`   | URL y selectores CSS de WhatsApp Web      |

---

## 👥 Formato del CSV

```
nombre,numero,tipo,empresa
María García,5491112345678,cliente,
Juan Pérez,5491198765432,cliente_nuevo,
Salón Los Robles,5491155443322,salon,Los Robles
TechCorp Argentina,5491166778899,empresa,TechCorp Argentina
```

### Tipos válidos

| Tipo            | Mensaje usado                  |
|-----------------|-------------------------------|
| `cliente`       | mensajes/mensaje_cliente.txt   |
| `cliente_nuevo` | mensajes/mensaje_cliente_nuevo.txt |
| `salon`         | mensajes/mensaje_salon.txt     |
| `empresa`       | mensajes/mensaje_empresa.txt   |

### Variables en mensajes

```
Hola {nombre}, te escribimos desde Magic Show 🎩
Nos gustaría trabajar con {empresa} en sus próximos eventos.
```

Cualquier columna del CSV puede usarse como `{nombre_columna}`.

---

## 🎮 Controles en tiempo real

| Tecla    | Acción                    |
|----------|---------------------------|
| `P`      | Pausar / reanudar envíos  |
| `Ctrl+C` | Detener y cerrar limpio   |

---

## 🐛 Guía de debugging rápido

| Síntoma                        | Dónde mirar                         |
|-------------------------------|--------------------------------------|
| Error en CSV                  | `contactReader.js` → `validateRow()` |
| Mensaje no se personaliza     | `messageLoader.js` → `personalize()` |
| WhatsApp no carga / QR roto   | `browserManager.js` → `launch()`    |
| Mensaje no se envía           | `browserManager.js` → `sendMessage()`|
| Delay incorrecto              | `config.js` → `timing`              |
| Ruta a archivo incorrecta     | `config.js` → `paths`               |
| Loop se comporta raro         | `sender.js` → `runSendLoop()`        |
| Falla al arrancar             | `index.js` → ver qué módulo falla   |

---

## 📊 Logs

```
logs/envios.log
```

```
[2025-03-19T14:32:01.000Z] [OK   ] [1/10] ✅ Enviado — María García
[2025-03-19T14:32:31.000Z] [ERROR] [2/10] ❌ ERROR — Número inválido
[2025-03-19T14:33:05.000Z] [OK   ] [3/10] ✅ Enviado — Salón Los Robles
```

---

## ⚠️ Advertencia

El uso de bots no oficiales puede violar los Términos de Servicio de WhatsApp y resultar en el bloqueo del número. Usá el bot con responsabilidad y solo para contactos que consintieron recibir mensajes.
