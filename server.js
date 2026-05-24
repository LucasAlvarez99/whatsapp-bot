'use strict';

const express  = require('express');
const path     = require('path');
const routes   = require('./src/api/routes');

const app     = express();
const PORT    = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── CORS ──────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'leads')));
app.use('/api', routes);

// Catch-all → sirve la SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'leads', 'magic-leads-app.html'));
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   🎩 Magic Show Bot — ${IS_PROD ? 'PRODUCCIÓN' : 'LOCAL'}`);
  console.log(`   URL: ${url}`);
  console.log('   Ctrl+C para detener');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Solo abrir el browser automáticamente en local
  if (!IS_PROD) {
    const { exec } = require('child_process');
    const opener =
      process.platform === 'darwin' ? `open "${url}"` :
      process.platform === 'win32'  ? `start "" "${url}"` :
                                      `xdg-open "${url}" 2>/dev/null || true`;
    exec(opener);
  }
});
