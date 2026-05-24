/**
 * ejecutar.js — Lógica de la página de ejecución del bot
 * Se comunica con el servidor vía SSE (Server-Sent Events) y
 * controla el bot mediante llamadas fetch a la API REST.
 */

'use strict';

/* ── API base URL ────────────────────────────────────────────────
 * El servidor Express siempre corre en el puerto 3000.
 * Si el usuario abre el HTML desde otro origen (ej: VS Code
 * Live Server en puerto 5500), apuntamos explícitamente a
 * localhost:3000 para que la API funcione igual.
 * ─────────────────────────────────────────────────────────────── */
const SERVER_PORT = 3000;
const API_BASE = window.location.port === String(SERVER_PORT)
  ? ''                                        // mismo origen → URLs relativas
  : `http://localhost:${SERVER_PORT}`;        // origen distinto → URL absoluta

function apiUrl(path) {
  return API_BASE + path;
}

/* ── State ──────────────────────────────────────────────────── */
let evtSource  = null;
let serverOk   = false;
let botRunning = false;
let botPaused  = false;

/* ── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  execBuildChecklist();
  execConnectStream();
  execBindButtons();
});

function execBindButtons() {
  document.getElementById('btn-start').addEventListener('click', botStart);
  document.getElementById('btn-pause').addEventListener('click', botPause);
  document.getElementById('btn-stop').addEventListener('click', botStop);
  document.getElementById('btn-clear-log').addEventListener('click', execClearLog);
}

/* ── Readiness check ─────────────────────────────────────────── */
function execBuildChecklist() {
  const contacts = Store.get('magic_contacts', []);
  const message  = Store.get('magic_message',  '');

  const hasContacts = contacts.length > 0;
  execSetChk('c',
    hasContacts ? 'ok' : 'fail',
    hasContacts ? '✓' : '✕',
    hasContacts
      ? `${contacts.length} contacto${contacts.length !== 1 ? 's' : ''} listos`
      : 'Sin contactos — ir a Contactos'
  );

  const hasMsg = message.trim().length > 0;
  execSetChk('m',
    hasMsg ? 'ok' : 'fail',
    hasMsg ? '✓' : '✕',
    hasMsg ? `${message.length} caracteres` : 'Sin mensaje — ir a Mensaje'
  );

  // Summary sidebar
  document.getElementById('sum-contacts').textContent =
    contacts.length ? String(contacts.length) : '—';

  document.getElementById('sum-msg').textContent =
    message ? `${message.length} chars ✓` : 'No guardado';

  if (contacts.length > 0) {
    const mins = Math.round(contacts.length * 31.5 / 60);
    document.getElementById('sum-time').textContent = `~${mins} min`;
  }
}

/* ── SSE connection ──────────────────────────────────────────── */
function execConnectStream() {
  if (evtSource) evtSource.close();

  evtSource = new EventSource(apiUrl('/api/stream'));

  evtSource.onopen = () => {
    serverOk = true;
    execSetChk('s', 'ok', '✓', 'Servidor conectado');
    execSyncButtons();
  };

  evtSource.onerror = () => {
    serverOk = false;
    execSetChk('s', 'fail', '✕',
      `Servidor no disponible en puerto ${SERVER_PORT} — ejecutá: npm start`);
    execSyncButtons();
    setTimeout(execConnectStream, 5_000);
  };

  evtSource.addEventListener('log', e => {
    const { msg, level } = JSON.parse(e.data);
    execAppendLog(msg, level);
  });

  evtSource.addEventListener('qr', e => {
    const { data } = JSON.parse(e.data);
    execShowQR(data);
  });

  evtSource.addEventListener('qr-clear', () => {
    execHideQR();
  });

  evtSource.addEventListener('progress', e => {
    execUpdateProgress(JSON.parse(e.data));
  });

  evtSource.addEventListener('state', e => {
    const state = JSON.parse(e.data);
    botRunning = state.running;
    botPaused  = state.paused;
    execSyncButtons();
    if (state.stats) execUpdateProgress(state.stats);
  });

  evtSource.addEventListener('done', e => {
    const data = JSON.parse(e.data);
    execHandleDone(data);
  });
}

/* ── Bot controls ────────────────────────────────────────────── */
async function botStart() {
  const contacts = Store.get('magic_contacts', []);
  const message  = Store.get('magic_message', '');

  if (!contacts.length) { toast('Cargá contactos primero', 'err'); return; }
  if (!message.trim())  { toast('Guardá el mensaje primero', 'err'); return; }

  execClearLog();
  document.getElementById('progress-section').hidden = false;

  const res  = await fetch(apiUrl('/api/bot/start'), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ contacts, message }),
  });
  const data = await res.json();

  if (!data.ok) toast(data.msg || 'Error al iniciar', 'err');
}

async function botPause() {
  const res  = await fetch(apiUrl('/api/bot/pause'), { method: 'POST' });
  const data = await res.json();
  if (!data.ok) toast(data.msg, 'err');
}

async function botStop() {
  if (!confirm('¿Querés detener el bot?')) return;
  const res  = await fetch(apiUrl('/api/bot/stop'), { method: 'POST' });
  const data = await res.json();
  if (data.ok) toast('Bot detenido', 'info');
}

/* ── UI helpers ──────────────────────────────────────────────── */
function execSetChk(id, type, icon, sub) {
  const el    = document.getElementById(`chk-${id}`);
  const icEl  = document.getElementById(`chk-${id}-icon`);
  const subEl = document.getElementById(`chk-${id}-sub`);

  if (el)    el.className      = `chk-item ${type}`;
  if (icEl)  icEl.textContent  = icon;
  if (subEl) subEl.textContent = sub;
}

function execSyncButtons() {
  const contacts = Store.get('magic_contacts', []);
  const message  = Store.get('magic_message', '');
  const canStart = serverOk && contacts.length > 0 && message.trim().length > 0 && !botRunning;

  document.getElementById('btn-start').disabled = !canStart;
  document.getElementById('btn-pause').disabled = !botRunning;
  document.getElementById('btn-stop').disabled  = !botRunning;

  const pauseBtn = document.getElementById('btn-pause');
  if (botPaused) {
    pauseBtn.innerHTML = '<span>▶️</span> Reanudar';
    pauseBtn.classList.add('is-resumed');
  } else {
    pauseBtn.innerHTML = '<span>⏸</span> Pausar';
    pauseBtn.classList.remove('is-resumed');
  }
}

function execAppendLog(msg, level = 'info') {
  const body = document.getElementById('log-body');

  const placeholder = body.querySelector('.log-placeholder');
  if (placeholder) placeholder.remove();

  const line = document.createElement('span');
  line.className   = `log-line log-${level}`;
  line.textContent = msg;

  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

function execClearLog() {
  const body = document.getElementById('log-body');
  body.innerHTML = '';
}

function execShowQR(dataUrl) {
  const section = document.getElementById('qr-section');
  const img     = document.getElementById('qr-img');
  img.src = dataUrl;
  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function execHideQR() {
  document.getElementById('qr-section').hidden = true;
}

function execUpdateProgress(stats) {
  const { sent = 0, errors = 0, total = 0, current = 0 } = stats;
  const pending = total - current;
  const pct     = total > 0 ? Math.round((current / total) * 100) : 0;

  document.getElementById('progress-counter').textContent = `${current} / ${total}`;
  document.getElementById('progress-fill').style.width    = `${pct}%`;
  document.getElementById('stat-sent').textContent        = String(sent);
  document.getElementById('stat-errors').textContent      = String(errors);
  document.getElementById('stat-pending').textContent     = String(pending);
}

function execHandleDone(stats) {
  const { sent = 0, errors = 0, fatalError } = stats;

  if (fatalError) {
    toast(`Error fatal: ${fatalError}`, 'err');
  } else if (errors > 0) {
    toast(`Completado — ${sent} enviados, ${errors} errores`, 'info');
  } else {
    toast(`¡Completado! ${sent} mensaje${sent !== 1 ? 's' : ''} enviado${sent !== 1 ? 's' : ''}`, 'ok');
  }

  botRunning = false;
  botPaused  = false;
  execSyncButtons();
}
