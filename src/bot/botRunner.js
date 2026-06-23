'use strict';

const EventEmitter   = require('events');
const browserManager = require('../browser/browserManager');
const { timing }     = require('../config/config');

function randomMs() {
  return Math.floor(Math.random() * (timing.delayMax - timing.delayMin + 1) + timing.delayMin);
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

  getState() {
    return {
      running: this.running,
      paused:  this.paused,
      stats:   { ...this._stats },
    };
  }

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

  async start(contacts) {
    this.running  = true;
    this._stopped = false;
    this._stats   = { sent: 0, errors: 0, total: contacts.length, current: 0 };
    this._emitState();

    try {
      this._log(`📋 ${contacts.length} contactos en cola`);
      this._log('🚀 Iniciando Chrome...');

      // Pasar callback de log al browserManager — sin override de console.log global
      const logCallback = (msg) => this._log(msg, 'info');
      await browserManager.launch(logCallback);

      this._log('🔄 Esperando inicio de sesión en WhatsApp...');
      await browserManager.waitForLoginWithQR(qrData => {
        this.emit('qr', { data: qrData });
      });

      this.emit('qr-clear');
      this._log('✅ Sesión activa — comenzando envíos', 'ok');

      for (let i = 0; i < contacts.length; i++) {
        if (this._stopped) break;

        while (this.paused && !this._stopped) await sleep(500);
        if (this._stopped) break;

        const contact = contacts[i];
        this._stats.current = i + 1;
        this.emit('progress', { ...this._stats });

        const msg = contact.mensaje;
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

        if (i < contacts.length - 1 && !this._stopped) {
          const ms = randomMs();
          this._log(`⏳ Esperando ${(ms / 1000).toFixed(1)}s antes del próximo envío...`);
          await sleep(ms);
        }
      }

      const summary = `🏁 Completado — Enviados: ${this._stats.sent} | Errores: ${this._stats.errors}`;
      this._log(summary, 'done');
      this.emit('done', { ...this._stats });

    } catch (err) {
      this._log(`💥 ${err.message}`, 'error');
      this.emit('done', { ...this._stats, fatalError: err.message });
    } finally {
      try { await browserManager.close(); } catch (_) {}
      this.running = false;
      this._emitState();
    }
  }

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