# 🎩 Magic Show Bot v3.2

## Instalación y uso

```bash
npm install
npm start
```

El servidor arranca en `http://localhost:3000` y abre el navegador solo.

## Flujo completo

1. **Contactos** → cargá tu lista (manual o CSV)
2. **Mensaje** → redactá el texto con `{nombre}`, `{empresa}`, etc. y guardalo
3. **Ejecutar** → presioná el botón ▶️ **Ejecutar Bot** — el resto es automático

## Arquitectura

```
server.js              ← Express, abre el browser automáticamente
src/
  api/routes.js        ← REST endpoints + SSE stream
  bot/botRunner.js     ← EventEmitter, orquesta el loop de envíos
  browser/browserManager.js  ← Puppeteer + captura de QR
leads/
  pages/ejecutar.html  ← UI (sin JS ni CSS inline)
  css/ejecutar.css     ← Estilos separados
  js/ejecutar.js       ← Lógica SSE + controles (separado del HTML)
```

## Controles en tiempo real

| Botón    | Acción                    |
|----------|---------------------------|
| ▶️ Ejecutar | Lanza el bot            |
| ⏸ Pausar   | Pausa entre mensajes    |
| 🛑 Detener | Cierra el bot y Chrome  |

## ⚠️ Advertencia

El uso de bots no oficiales puede violar los TOS de WhatsApp. Usar con responsabilidad.
