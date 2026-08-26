/**
 * mensaje.js — Editor de mensajes por categoría (Prioridad 2)
 * Depende de: store.js, messages-store.js, ui.js
 */

let msgContacts    = [];
let msgActiveCat   = CATEGORIES[0].id;
let msgEditingId   = null; // id del mensaje en edición (null = creando uno nuevo)
let msgSelStart    = 0;
let msgSelEnd      = 0;

function msgInit() {
  msgContacts = Store.get('magic_contacts', []);
  msgBuildTabs();
  msgRenderList();
  msgBuildSelector();

  const ta = document.getElementById('msg-textarea');
  if (ta) {
    ta.addEventListener('mouseup', function() { msgSelStart = this.selectionStart; msgSelEnd = this.selectionEnd; });
    ta.addEventListener('keyup',   function() { msgSelStart = this.selectionStart; msgSelEnd = this.selectionEnd; });
    ta.addEventListener('input',   msgOnChange);
  }
  msgOnChange();
}

/* ── Tabs de categoría ──────────────────────────────────────────── */
function msgBuildTabs() {
  const wrap = document.getElementById('cat-tabs');
  if (!wrap) return;
  wrap.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const count = MessagesStore.getByCategory(cat.id).length;
    const li = document.createElement('li');
    li.className = 'nav-item';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-link' + (cat.id === msgActiveCat ? ' active' : '');
    btn.textContent = cat.label + ' (' + count + ')';
    btn.onclick = () => msgSelectCategory(cat.id);
    li.appendChild(btn);
    wrap.appendChild(li);
  });
}

function msgSelectCategory(catId) {
  msgActiveCat = catId;
  msgCancelEdit();
  msgBuildTabs();
  msgRenderList();
}

/* ── Lista de mensajes de la categoría activa ──────────────────── */
function msgRenderList() {
  const list = document.getElementById('msg-list');
  if (!list) return;
  const items = MessagesStore.getByCategory(msgActiveCat);

  if (!items.length) {
    list.innerHTML = '<div class="msg-empty">No hay mensajes en esta categoría todavía. Agregá el primero abajo ⬇</div>';
    return;
  }

  list.innerHTML = items.map((m, i) => `
    <div class="msg-item">
      <div class="msg-item__header">
        <span class="msg-item__badge">Mensaje ${i + 1}</span>
        <div class="msg-item__actions">
          <button class="msg-item__action" onclick="msgStartEdit(${JSON.stringify(m.id)})" title="Editar">✏️</button>
          <button class="msg-item__action msg-item__action--danger" onclick="msgDelete(${JSON.stringify(m.id)})" title="Eliminar">🗑</button>
        </div>
      </div>
      <div class="msg-item__text">${esc(m.text)}</div>
    </div>
  `).join('');
}

/* ── Crear / editar ─────────────────────────────────────────────── */
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

function msgStartEdit(id) {
  const items = MessagesStore.getByCategory(msgActiveCat);
  const item  = items.find(m => m.id === id);
  if (!item) return;
  msgEditingId = id;
  document.getElementById('msg-textarea').value = item.text;
  document.getElementById('editor-mode-label').textContent = '✏️ Editando mensaje';
  document.getElementById('btn-save-msg').textContent = '💾 Guardar cambios';
  document.getElementById('btn-cancel-edit').hidden = false;
  msgOnChange();
  document.getElementById('msg-textarea').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function msgCancelEdit() {
  msgEditingId = null;
  const ta = document.getElementById('msg-textarea');
  if (ta) ta.value = '';
  document.getElementById('editor-mode-label').textContent = '➕ Nuevo mensaje';
  document.getElementById('btn-save-msg').textContent = '💾 Agregar mensaje';
  document.getElementById('btn-cancel-edit').hidden = true;
  msgOnChange();
}

function msgSave() {
  const ta  = document.getElementById('msg-textarea');
  if (!ta) return;
  const text = ta.value.trim();
  if (!text) { toast('El mensaje está vacío', 'err'); return; }

  if (msgEditingId !== null) {
    MessagesStore.update(msgActiveCat, msgEditingId, text);
    toast('Mensaje actualizado ✓', 'ok');
  } else {
    MessagesStore.add(msgActiveCat, text);
    toast('Mensaje agregado ✓', 'ok');
  }
  msgCancelEdit();
  msgBuildTabs();
  msgRenderList();
}

function msgDelete(id) {
  if (!confirm('¿Eliminar este mensaje?')) return;
  MessagesStore.remove(msgActiveCat, id);
  if (msgEditingId === id) msgCancelEdit();
  msgBuildTabs();
  msgRenderList();
  toast('Mensaje eliminado', 'info');
}

function msgLoadExample() {
  const ta = document.getElementById('msg-textarea');
  if (!ta) return;
  ta.value = 'Hola {nombre}! 👋\n\nSomos un grupo de magia profesional y nos encantaría ser parte de los próximos eventos de {empresa} 🎩✨\n\nOfrecemos shows únicos adaptados a cada ocasión: cumpleaños, casamientos, corporativos y más.\n\n¿Tenés algo planeado próximamente?';
  msgOnChange();
  toast('Ejemplo cargado', 'info');
}

/* ── Preview ────────────────────────────────────────────────────── */
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