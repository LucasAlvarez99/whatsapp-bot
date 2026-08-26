# 🎩 Magic Show Bot v3.3

## Instalación y uso

```bash
npm install
npm start
```

El servidor arranca en `http://localhost:3000` y abre el navegador solo.

## Arquitectura

```
server.js                    ← Express, abre el browser automáticamente en local
src/
  api/routes.js               ← REST endpoints + SSE stream (/api/stream)
  bot/botRunner.js             ← EventEmitter, orquesta el loop de envíos
  browser/browserManager.js    ← Conexión a WhatsApp vía Baileys (WebSocket, sin Chromium)
  contacts/contactReader.js    ← Lectura/validación de contactos (CLI, contactos.csv)
  messages/messageLoader.js    ← Carga de plantillas de mensaje (CLI)
  utils/personalize.js         ← Reemplazo de {variables} en plantillas (fuente única)
  utils/logger.js              ← Logger a consola + archivo (uso local/CLI)
leads/
  pages/                       ← contactos.html, mensaje.html, ejecutar.html, tutorial.html
  magic-leads-app.html         ← home / dashboard
  js/                          ← un archivo JS por página + store.js (localStorage)
  css/
    main.css                   ← bundle de estilos compartidos (importa base/layout/components)
    base/                      ← variables (paleta/tokens) + reset
    layout/                    ← header y navegación, comunes a las 5 páginas
    components/                ← botones, cards, badges, tabla, toasts, forms, log, notices
    vendor/bootstrap-theme.css ← mapeo de variables de Bootstrap a la paleta dorada
    pages/                     ← CSS propio de cada página (lo que antes estaba inline)
```

Cada página HTML carga: Bootstrap (CDN, salvo el dashboard) → `vendor/bootstrap-theme.css`
→ `css/main.css` (compartido) → `css/pages/<pagina>.css` (propio de esa página). Antes,
las 5 páginas cargaban un único `styles.css` de 541 líneas completo, más un bloque
`<style>` inline sin extraer por página — se modularizó siguiendo el mismo criterio que
WizardCo (base / layout / components / pages), eliminando además ~150 líneas de CSS que
no se usaban en ninguna página (código muerto de una versión anterior de la UI).

## Flujo completo

1. **Contactos** → cargá tu lista (manual o CSV). El **número es el único dato obligatorio**;
   el nombre es opcional (si falta, se muestra el número en su lugar y se omite del mensaje).
2. **Mensaje** → redactá el texto con `{nombre}`, `{empresa}`, etc. y guardalo
3. **Ejecutar** → presioná el botón ▶️ **Ejecutar Bot** — el resto es automático

## Controles en tiempo real

| Botón      | Acción                    |
|------------|---------------------------|
| ▶️ Ejecutar | Lanza el bot              |
| ⏸ Pausar   | Pausa entre mensajes      |
| 🛑 Detener  | Cierra el bot y la sesión |

## ⚠️ Sobre el despliegue

Este proyecto **no es compatible con hosting serverless (Vercel, Netlify Functions, etc.)**.
El bot mantiene una conexión WebSocket persistente con WhatsApp (Baileys), guarda las
credenciales de sesión en disco (`session/`) y corre un loop de envíos que puede durar
horas — todo eso requiere un **proceso Node persistente** (Render, Railway, Fly.io, un VPS,
o el mismo `Dockerfile` de este repo), no funciones que se apagan entre requests.

Si en algún momento se separa el frontend estático (`leads/`) del backend (`server.js` +
`src/`), el frontend sí podría vivir en Vercel/GitHub Pages, apuntando al backend
desplegado aparte — el mismo esquema que ya usás en WizardCo (frontend en GitHub Pages,
backend en Render).

## ⚠️ Advertencia

El uso de bots no oficiales puede violar los TOS de WhatsApp. Usar con responsabilidad.
