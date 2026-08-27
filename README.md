# Magic Show Bot v3.3

## Instalación y uso

```bash
npm install
npm start
```

El servidor arranca en `http://localhost:3000` y abre el navegador solo.

## Arquitectura

```
server.js                    - Express, abre el browser automáticamente en local
src/
  api/routes.js               - REST endpoints + SSE stream (/api/stream)
  bot/botRunner.js             - EventEmitter, orquesta el loop de envíos
  bot/progressStore.js         - Checkpoint en disco para retomar una campaña interrumpida
  browser/browserManager.js    - Conexión a WhatsApp vía Baileys (WebSocket, sin Chromium)
  contacts/contactReader.js    - Lectura/validación de contactos (CLI, contactos.csv)
  messages/messageLoader.js    - Carga de plantillas de mensaje (CLI)
  utils/personalize.js         - Reemplazo de {variables} en plantillas (fuente única)
  utils/logger.js              - Logger a consola + archivo (uso local/CLI)
leads/
  pages/                       - contactos.html, mensaje.html, ejecutar.html, tutorial.html
  magic-leads-app.html         - home / dashboard
  js/                          - un archivo JS por página + store.js (localStorage)
  css/
    main.css                   - bundle de estilos compartidos (importa base/layout/components)
    base/                      - variables (paleta/tokens) + reset
    layout/                    - header y navegación, comunes a las 5 páginas
    components/                - botones, cards, badges, tabla, toasts, forms, log, notices
    vendor/bootstrap-theme.css - mapeo de variables de Bootstrap a la paleta azul/naranja
    pages/                     - CSS propio de cada página (lo que antes estaba inline)
```

Todas las páginas cargan Bootstrap 5 + Bootstrap Icons vía CDN, con `vendor/bootstrap-theme.css`
remapeando la paleta (azul de marca + naranja para las acciones principales) y `css/main.css`
con los componentes propios (cards, botones, badges, tabla, toasts, log). Cada página suma su
propio CSS en `css/pages/<pagina>.css`.

## Flujo completo

1. **Contactos** - cargá tu lista (manual o CSV). El **número es el único dato obligatorio**;
   el nombre es opcional (si falta, se muestra el número en su lugar y se omite del mensaje).
2. **Mensaje** - redactá el texto con `{nombre}`, `{empresa}`, etc. y guardalo
3. **Ejecutar** - presioná **Ejecutar Bot** - el resto es automático

## Controles en tiempo real

| Botón    | Acción                                              |
|----------|------------------------------------------------------|
| Ejecutar | Lanza el bot                                         |
| Pausar   | Pausa entre mensajes                                  |
| Detener  | Corta el envío (el progreso queda guardado, ver abajo) |

## Frecuencia de envío

Por defecto espera entre **5 y 15 minutos** (aleatorio) entre cada mensaje, para reducir el
riesgo de bloqueo. Se ajusta en `src/config/config.js` (`timing.delayMin` / `timing.delayMax`,
en milisegundos).

## Progreso persistente (retomar una campaña interrumpida)

Cada vez que se envía un mensaje, el bot guarda un checkpoint en `data/campaign-progress.json`
con cuántos contactos ya se procesaron. Si el proceso se corta a mitad de una tanda (se cae el
servidor, un redeploy, un crash) y se vuelve a ejecutar **con la misma lista de contactos y el
mismo mensaje**, retoma desde donde quedó en vez de volver a mandarle a todos desde cero.

Esto protege contra reinicios del proceso, pero **no alcanza por sí solo** para que la campaña
siga corriendo si apagás tu computadora: mientras el bot corra en `localhost`, apagar la PC
mata el proceso igual. Para que la campaña sobreviva a eso hace falta correrlo en un host que
quede prendido todo el tiempo (ver la sección de despliegue) — el checkpoint es el
complemento que evita repetir envíos si ese host se reinicia a mitad de una tanda.

Si el host de despliegue usa filesystem efímero (se borra en cada redeploy), el checkpoint
también se pierde ahí — para que sobreviva a un reinicio del servidor hace falta un disco
persistente en el proveedor de hosting (por ejemplo, un disco persistente de Render).

## Sobre el despliegue

Este proyecto **no es compatible con hosting serverless (Vercel, Netlify Functions, etc.)**.
El bot mantiene una conexión WebSocket persistente con WhatsApp (Baileys), guarda las
credenciales de sesión en disco (`session/`) y corre un loop de envíos que puede durar
horas — todo eso requiere un **proceso Node persistente** (Render, Railway, Fly.io, un VPS,
o el mismo `Dockerfile` de este repo), no funciones que se apagan entre requests.

Si en algún momento se separa el frontend estático (`leads/`) del backend (`server.js` +
`src/`), el frontend sí podría vivir en Vercel/GitHub Pages, apuntando al backend
desplegado aparte — el mismo esquema que ya usás en WizardCo (frontend en GitHub Pages,
backend en Render).

## Advertencia

El uso de bots no oficiales puede violar los TOS de WhatsApp. Usar con responsabilidad.
