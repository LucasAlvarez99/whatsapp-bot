/**
 * mensaje.js — Lógica del editor de mensajes
 * Depende de: store.js, ui.js
 */

let msgContacts = [];
let msgSelStart = 0;
let msgSelEnd   = 0;

function msgInit() {
  msgContacts = Store.get('magic_contacts', []);
  const saved = Store.get('magic_message', '');
  const ta    = document.getElementById('msg-textarea');
  if (ta && saved) ta.value = saved;
  msgOnChange();
  msgBuildSelector();

  if (ta) {
    ta.addEventListener('mouseup', function() { msgSelStart = this.selectionStart; msgSelEnd = this.selectionEnd; });
    ta.addEventListener('keyup',   function() { msgSelStart = this.selectionStart; msgSelEnd = this.selectionEnd; });
  }
}

function msgOnChange() {
  const ta  = document.getElementById('msg-textarea');
  const cnt = document.getElementById('char-count');
  if (ta && cnt) cnt.textContent = ta.value.length + ' caracteres';
  msgUpdatePreview();
}

function msgInsertVar(variable) {
  const el = document.getElementById('msg-textarea');
  if (!el) return;
  const s  = msgSelStart || el.selectionStart;
  const e  = msgSelEnd   || el.selectionEnd;
  el.value = el.value.substring(0, s) + variable + el.value.substring(e);
  const pos = s + variable.length;
  el.setSelectionRange(pos, pos);
  el.focus();
  msgSelStart = msgSelEnd = pos;
  msgOnChange();
}

function msgSave() {
  const ta  = document.getElementById('msg-textarea');
  if (!ta) return;
  const msg = ta.value.trim();
  if (!msg) { toast('El mensaje está vacío', 'err'); return; }
  Store.set('magic_message', msg);
  const badge = document.getElementById('saved-badge');
  if (badge) { badge.classList.add('show'); setTimeout(() => badge.classList.remove('show'), 2500); }
  toast('Mensaje guardado ✓', 'ok');
}

function msgClear() {
  if (!confirm('¿Limpiar el mensaje?')) return;
  const ta = document.getElementById('msg-textarea');
  if (ta) ta.value = '';
  Store.del('magic_message');
  msgOnChange();
  toast('Mensaje limpiado', 'info');
}

function msgLoadExample() {
  const ta = document.getElementById('msg-textarea');
  if (!ta) return;
  ta.value = 'Hola {nombre}! 👋\n\nSomos un grupo de magia profesional y nos encantaría ser parte de los próximos eventos de {empresa} 🎩✨\n\nOfrecemos shows únicos adaptados a cada ocasión: cumpleaños, casamientos, corporativos y más.\n\n¿Tenés algo planeado próximamente?';
  msgOnChange();
  toast('Ejemplo cargado', 'info');
}

function msgBuildSelector() {
  const sel = document.getElementById('preview-select');
  if (!sel) return;
  sel.innerHTML = '';
  if (!msgContacts.length) {
    sel.innerHTML = '<option value="">— Cargá contactos primero —</option>';
    return;
  }
  const def = document.createElement('option');
  def.value = ''; def.textContent = '— Seleccioná un contacto —';
  sel.appendChild(def);
  msgContacts.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = c.nombre + ' (' + c.tipo + ')';
    sel.appendChild(opt);
  });
  sel.value = '0';
  msgUpdatePreview();
}

function msgUpdatePreview() {
  const ta  = document.getElementById('msg-textarea');
  const sel = document.getElementById('preview-select');
  if (!ta || !sel) return;

  const msg = ta.value || 'Escribí un mensaje para ver la vista previa...';
  const idx = sel.value;
  const c   = idx !== '' && msgContacts[parseInt(idx)] ? msgContacts[parseInt(idx)] : null;

  let rendered = msg;
  if (c) {
    rendered = rendered.replace(/\{(\w+)\}/g, (m, k) =>
      (c[k] !== undefined && c[k] !== '') ? c[k] : m
    );
    const initials = (c.nombre ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const av = document.getElementById('prev-avatar');
    const nm = document.getElementById('prev-name');
    const nu = document.getElementById('prev-num');
    if (av) av.textContent = initials;
    if (nm) nm.textContent = c.nombre;
    if (nu) nu.textContent = c.numero;
  } else {
    const av = document.getElementById('prev-avatar');
    const nm = document.getElementById('prev-name');
    const nu = document.getElementById('prev-num');
    if (av) av.textContent = '?';
    if (nm) nm.textContent = 'Contacto';
    if (nu) nu.textContent = '—';
  }

  const now     = new Date();
  const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const bubble  = document.getElementById('prev-bubble');
  if (bubble) {
    bubble.innerHTML = esc(rendered).replace(/\n/g, '<br>') +
      '<div class="preview-time">' + timeStr + ' ✓✓</div>';
  }
}