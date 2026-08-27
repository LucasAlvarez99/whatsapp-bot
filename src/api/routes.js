'use strict';

const express      = require('express');
const BotRunner     = require('../bot/botRunner');
const progressStore = require('../bot/progressStore');

const router     = express.Router();
const sseClients = new Set();

let currentRunner = null;
let _botStarting  = false;  // lock para evitar arranques múltiples simultáneos

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) {}
  }
}

function attachRunner(runner) {
  runner.on('log',      d  => broadcast('log', d));
  runner.on('qr',       d  => broadcast('qr', d));
  runner.on('qr-clear', () => broadcast('qr-clear', {}));
  runner.on('progress', d  => broadcast('progress', d));
  runner.on('state',    d  => broadcast('state', d));
  runner.on('done',     d  => broadcast('done', d));
}

// ── SSE stream ────────────────────────────────────────────────
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseClients.add(res);

  const state = currentRunner
    ? currentRunner.getState()
    : { running: false, paused: false, stats: { sent: 0, errors: 0, total: 0, current: 0 } };
  res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);

  const ping = setInterval(() => {
    try { res.write(':ping\n\n'); } catch (_) {}
  }, 20_000);

  req.on('close', () => {
    sseClients.delete(res);
    clearInterval(ping);
  });
});

// ── Start ─────────────────────────────────────────────────────
router.post('/bot/start', (req, res) => {
  if (_botStarting || currentRunner?.running) {
    return res.json({ ok: false, msg: 'El bot ya está corriendo' });
  }

  const { contacts } = req.body;

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.json({ ok: false, msg: 'No hay contactos válidos' });
  }
  if (!contacts.every(c => typeof c.mensaje === 'string' && c.mensaje.trim())) {
    return res.json({ ok: false, msg: 'Hay contactos sin mensaje asignado para su categoría' });
  }

  _botStarting  = true;
  currentRunner = new BotRunner();
  attachRunner(currentRunner);

  res.json({ ok: true });

  currentRunner.start(contacts)
    .catch(err => {
      console.error('[BotRunner] error fatal:', err.message);
      broadcast('done', { fatalError: err.message, sent: 0, errors: 0 });
    })
    .finally(() => {
      _botStarting = false;
    });
});

// ── Pause / resume ────────────────────────────────────────────
router.post('/bot/pause', (req, res) => {
  if (!currentRunner?.running) {
    return res.json({ ok: false, msg: 'No hay bot corriendo' });
  }
  currentRunner.togglePause();
  res.json({ ok: true, paused: currentRunner.paused });
});

// ── Stop ──────────────────────────────────────────────────────
router.post('/bot/stop', async (req, res) => {
  if (!currentRunner) {
    return res.json({ ok: false, msg: 'No hay bot corriendo' });
  }
  try {
    await currentRunner.stop();
    _botStarting = false;
    res.json({ ok: true });
  } catch (err) {
    console.error('[BotRunner] error al detener:', err.message);
    _botStarting = false;
    res.json({ ok: false, msg: 'Error al detener el bot' });
  }
});

// ── Status ────────────────────────────────────────────────────
router.get('/bot/status', (req, res) => {
  res.json(
    currentRunner
      ? currentRunner.getState()
      : { running: false, paused: false }
  );
});

// ── Progreso guardado (campaña interrumpida) ─────────────────────
// Permite consultar si hay un envío a medio terminar (por un corte de luz,
// un crash, o el "Detener" manual) y descartarlo si el usuario prefiere
// arrancar de cero en vez de retomarlo.
router.get('/bot/progress', (req, res) => {
  const saved = progressStore.load();
  res.json({ pending: !!saved, progress: saved || null });
});

router.delete('/bot/progress', (req, res) => {
  progressStore.clear();
  res.json({ ok: true });
});

module.exports = router;