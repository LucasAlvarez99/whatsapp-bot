'use strict';

const EventEmitter   = require('events');
const browserManager = require('../browser/browserManager');

const DELAY_MIN = 28_000;
const DELAY_MAX = 35_000;

function randomMs() {
  return Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1) + DELAY_MIN);
}

function personalize(template, contact) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = contact[key];
    return v !== undefined && String(v).trim() !== '' ? String(v) : `{${key}}`;
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

class BotRunner extends EventEmitter {
  constructor() {
    super();
    this.running  = false;
    this.paused   = false;
    this._stopped = false;
    this._stats   = { sent: 0, errors: 0, total: 0, current: 0 };
  }

  // ── Public state snapshot ───────────────────────────────────
  getState() {
    return {
      running: this.running,
      paused:  this.paused,
      stats:   { ...this._stats },
    };
  }

  // ── Internal helpers ────────────────────────────────────────
  _log(msg, level = 'info') {
    this.emit('log', {
      msg,
      level,
      ts: new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }),
    });
  }

  _emitState() {
    this.emit('state', this.getState());
  }

  // ── Main run ────────────────────────────────────────────────
  async start(contacts, messageTemplate) {
    this.running  = true;
    this._stopped = false;
    this._stats   = { sent: 0, errors: 0, total: contacts.length, current: 0 };
    this._emitState();

    try {
      this._log(`📋 ${contacts.length} contactos en cola`);

      // Browser launch
      this._log('🚀 Iniciando Chrome...');

      // Redirigir console.log del proceso al log SSE mientras el bot corre
      const _origLog = console.log;
      console.log = (...args) => {
        const msg = args.join(' ');
        _origLog(msg);
        if (msg.includes('[BrowserManager]')) {
          this._log(msg.replace(/\[BrowserManager\] \S+ — /, ''), 'info');
        }
      };

      await browserManager.launch();

      // Wait for WhatsApp session (with QR emission)
      this._log('🔄 Esperando inicio de sesión en WhatsApp...');
      await browserManager.waitForLoginWithQR(qrData => {
        this.emit('qr', { data: qrData });
      });

      this.emit('qr-clear');
      this._log('✅ Sesión activa — comenzando envíos', 'ok');

      // Send loop
      for (let i = 0; i < contacts.length; i++) {
        if (this._stopped) break;

        // Pause gate
        while (this.paused && !this._stopped) await sleep(500);
        if (this._stopped) break;

        const contact = contacts[i];
        this._stats.current = i + 1;
        this.emit('progress', { ...this._stats });

        const msg = personalize(messageTemplate, contact);
        this._log(`📤 [${i + 1}/${contacts.length}] ${contact.nombre} (${contact.numero})`);

        try {
          await browserManager.sendMessage(contact.numero, msg);
          this._stats.sent++;
          this._log(`✅ Enviado — ${contact.nombre}`, 'ok');
        } catch (err) {
          this._stats.errors++;
          this._log(`❌ Error — ${contact.nombre}: ${err.message}`, 'error');
        }

        this.emit('progress', { ...this._stats });

        // Inter-message delay
        if (i < contacts.length - 1 && !this._stopped) {
          const ms = randomMs();
          this._log(`⏳ Esperando ${(ms / 1000).toFixed(1)} s antes del próximo envío...`);
          await sleep(ms);
        }
      }

      const summary =
        `🏁 Completado — Enviados: ${this._stats.sent} | Errores: ${this._stats.errors}`;
      this._log(summary, 'done');
      this.emit('done', { ...this._stats });

    } catch (err) {
      this._log(`💥 ${err.message}`, 'error');
      this.emit('done', { ...this._stats, fatalError: err.message });
    } finally {
      try { await browserManager.close(); } catch (_) {}
      // Restaurar console.log original
      if (typeof _origLog !== 'undefined') console.log = _origLog;
      this.running = false;
      this._emitState();
    }
  }

  // ── Controls ────────────────────────────────────────────────
  togglePause() {
    this.paused = !this.paused;
    this._log(this.paused ? '⏸ Envíos pausados' : '▶️ Envíos reanudados', 'ctrl');
    this._emitState();
  }

  async stop() {
    this._stopped = true;
    this.paused   = false;
    this._log('🛑 Deteniendo el bot...', 'warn');
    try { await browserManager.close(); } catch (_) {}
    this.running = false;
    this._emitState();
  }
}

module.exports = BotRunner;
