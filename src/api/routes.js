'use strict';

const express   = require('express');
const BotRunner = require('../bot/botRunner');

const router     = express.Router();
const sseClients = new Set();

let currentRunner = null;

// ── Broadcast to all SSE clients ─────────────────────────────
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
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseClients.add(res);

  // Send current state immediately so the client syncs on connect
  const state = currentRunner
    ? currentRunner.getState()
    : { running: false, paused: false, stats: { sent: 0, errors: 0, total: 0, current: 0 } };
  res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);

  // Keepalive every 20 s to prevent connection timeout
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
  if (currentRunner?.running) {
    return res.json({ ok: false, msg: 'El bot ya está corriendo' });
  }

  const { contacts, message } = req.body;

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.json({ ok: false, msg: 'No hay contactos válidos' });
  }
  if (!message?.trim()) {
    return res.json({ ok: false, msg: 'No hay mensaje guardado' });
  }

  currentRunner = new BotRunner();
  attachRunner(currentRunner);

  res.json({ ok: true });

  // Fire and forget — progress comes through SSE
  currentRunner.start(contacts, message).catch(err => {
    console.error('[BotRunner] error fatal:', err.message);
    broadcast('done', { fatalError: err.message, sent: 0, errors: 0 });
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
  await currentRunner.stop();
  res.json({ ok: true });
});

// ── Status (polling fallback) ─────────────────────────────────
router.get('/bot/status', (req, res) => {
  res.json(
    currentRunner
      ? currentRunner.getState()
      : { running: false, paused: false }
  );
});

module.exports = router;
