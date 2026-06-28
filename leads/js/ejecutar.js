/**
 * ejecutar.js — Lógica de la página de ejecución del bot
 */

'use strict';

const API_BASE = window.location.hostname === 'localhost' && window.location.port !== '3000'
  ? 'http://localhost:3000'
  : '';

function apiUrl(path) { return API_BASE + path; }

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

  const hasContacts = contacts.length > 0;
  execSetChk('c',
    hasContacts ? 'ok' : 'fail',
    hasContacts ? '✓' : '✕',
    hasContacts
      ? `${contacts.length} contacto${contacts.length !== 1 ? 's' : ''} listos`
      : 'Sin contactos — ir a Contactos'
  );

  // Validar que cada categoría usada por los contactos tenga al menos 1 mensaje
  const tiposUsados  = [...new Set(contacts.map(c => c.tipo))];
  const tiposFaltantes = tiposUsados.filter(t => MessagesStore.getByCategory(t).length === 0);
  const hasMsg = tiposUsados.length > 0 && tiposFaltantes.length === 0;
  const totalMsgs = MessagesStore.countAll();

  execSetChk('m',
    hasMsg ? 'ok' : 'fail',
    hasMsg ? '✓' : '✕',
    hasMsg
      ? `${totalMsgs} mensaje${totalMsgs !== 1 ? 's' : ''} en ${tiposUsados.length} categoría${tiposUsados.length !== 1 ? 's' : ''}`
      : (tiposFaltantes.length
          ? `Faltan mensajes para: ${tiposFaltantes.join(', ')}`
          : 'Sin mensajes — ir a Mensaje')
  );

  document.getElementById('sum-contacts').textContent = contacts.length ? String(contacts.length) : '—';
  document.getElementById('sum-msg').textContent      = totalMsgs ? `${totalMsgs} mensajes ✓` : 'No guardados';

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
    execSetChk('s', 'fail', '✕', 'Servidor no disponible — ejecutá: npm start');
    execSyncButtons();
    setTimeout(execConnectStream, 5_000);
  };

  evtSource.addEventListener('log',      e => { const { msg, level } = JSON.parse(e.data); execAppendLog(msg, level); });
  evtSource.addEventListener('qr',       e => { const { data } = JSON.parse(e.data); execShowQR(data); });
  evtSource.addEventListener('qr-clear', () => execHideQR());
  evtSource.addEventListener('progress', e => execUpdateProgress(JSON.parse(e.data)));

  evtSource.addEventListener('state', e => {
    const state = JSON.parse(e.data);
    botRunning = state.running;
    botPaused  = state.paused;
    execSyncButtons();
    if (state.stats) execUpdateProgress(state.stats);
  });

  evtSource.addEventListener('done', e => execHandleDone(JSON.parse(e.data)));
}

/* ── Bot controls ────────────────────────────────────────────── */
function execBuildContactsWithMessages() {
  const contacts = Store.get('magic_contacts', []);
  const result = [];
  const sinMensaje = [];

  for (const c of contacts) {
    const picked = MessagesStore.pickMessage(c.tipo, c.numero);
    if (!picked) { sinMensaje.push(c); continue; }
    const mensaje = picked.text.replace(/\{(\w+)\}/g, (m, k) =>
      (c[k] !== undefined && c[k] !== '') ? c[k] : m
    );
    result.push({ ...c, mensaje });
  }

  return { contacts: result, sinMensaje };
}

async function botStart() {
  const { contacts, sinMensaje } = execBuildContactsWithMessages();

  if (!contacts.length && !sinMensaje.length) { toast('Cargá contactos primero', 'err'); return; }
  if (sinMensaje.length) {
    toast(`${sinMensaje.length} contacto(s) sin mensaje para su categoría — revisá "Mensaje"`, 'err');
    if (!contacts.length) return;
  }

  // FIX 1: deshabilitar el botón INMEDIATAMENTE antes del fetch
  // para evitar doble/triple click mientras llega la respuesta
  document.getElementById('btn-start').disabled = true;

  execClearLog();
  document.getElementById('progress-section').hidden = false;

  const res  = await fetch(apiUrl('/api/bot/start'), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ contacts }),
  });
  const data = await res.json();

  if (!data.ok) {
    toast(data.msg || 'Error al iniciar', 'err');
    // Si el servidor rechazó, re-habilitar el botón
    execSyncButtons();
  }
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
  const cls   = type === 'ok' ? 'list-success' : type === 'fail' ? 'list-fail' : 'list-pending';
  if (el)    el.className      = `list-group-item d-flex align-items-center gap-3 ${cls}`;
  if (icEl)  icEl.textContent  = icon;
  if (subEl) subEl.textContent = sub;
}

function execSyncButtons() {
  const contacts = Store.get('magic_contacts', []);
  const tiposUsados = [...new Set(contacts.map(c => c.tipo))];
  const hasMsgForAll = tiposUsados.length > 0 && tiposUsados.every(t => MessagesStore.getByCategory(t).length > 0);
  const canStart = serverOk && contacts.length > 0 && hasMsgForAll && !botRunning;

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
  document.getElementById('log-body').innerHTML = '';
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