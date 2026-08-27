/**
 * contacts.js — Lógica completa de gestión de contactos
 * Carga, agrega, elimina, importa CSV, exporta CSV/Excel, persiste.
 * Depende de: store.js, ui.js
 */

const VALID_TYPES    = ['cliente', 'cliente_nuevo', 'salon', 'empresa'];
const KEY_ALL        = 'magic_contacts_all';   // todos (para la tabla)
const KEY_VALID      = 'magic_contacts';        // solo válidos (para el bot)

let contacts   = [];
let editingId  = null;   // id del contacto que se está editando en la tabla (null = ninguno)

// ── Init ─────────────────────────────────────────────────────
function contactsInit() {
  const stored = Store.get(KEY_ALL, Store.get(KEY_VALID, []));
  contacts = stored.map(c => ({
    ...c,
    id:     c.id     ?? (Date.now() + Math.random()),
    _valid: c._valid ?? true,
    _error: c._error ?? null,
  }));
  contactsRender();
}

// ── Persist ──────────────────────────────────────────────────
function contactsPersist() {
  Store.set(KEY_ALL,   contacts);
  Store.set(KEY_VALID, contacts.filter(c => c._valid !== false));
}

// ── Validate one contact ─────────────────────────────────────
// El nombre es opcional: un contacto se puede crear solo con el número.
function contactValidate(nombre, numero, tipo) {
  const digits = (numero ?? '').replace(/\D/g, '');
  if (digits.length < 10)        return 'Número inválido — mínimo 10 dígitos con código de país';
  if (!VALID_TYPES.includes(tipo)) return 'Tipo inválido: ' + tipo;
  return null;
}

// Nombre para mostrar cuando el contacto no tiene nombre cargado.
function contactDisplayName(nombre, numero) {
  return nombre?.trim() ? nombre.trim() : numero;
}

// ── Add (form) ───────────────────────────────────────────────
function contactAdd() {
  const nombre  = document.getElementById('f-nombre').value.trim();
  const numero  = document.getElementById('f-numero').value.trim();
  const tipo    = document.getElementById('f-tipo').value;
  const empresa = document.getElementById('f-empresa').value.trim();

  const err = contactValidate(nombre, numero, tipo);
  if (err) { toast(err, 'err'); return; }

  contacts.push({ id: Date.now(), nombre, numero, tipo, empresa, _valid: true, _error: null });
  contactsPersist();
  contactsRender();
  contactClearForm();
  toast(contactDisplayName(nombre, numero) + ' agregado', 'ok');
}

function contactClearForm() {
  ['f-nombre', 'f-numero', 'f-empresa'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-tipo').value = 'cliente';
  document.getElementById('f-nombre').focus();
}

// ── Delete ───────────────────────────────────────────────────
function contactDelete(id) {
  const c = contacts.find(x => x.id === id);
  contacts = contacts.filter(x => x.id !== id);
  contactsPersist();
  contactsRender();
  if (c) toast(contactDisplayName(c.nombre, c.numero) + ' eliminado', 'info');
}

// ── Edit (inline en la tabla) ───────────────────────────────────
function contactStartEdit(id) {
  editingId = id;
  contactsRenderTable();
  // Foco automático en el campo número, que suele ser lo que hay que corregir.
  const input = document.getElementById('e-numero-' + id);
  if (input) { input.focus(); input.select(); }
}

function contactCancelEdit() {
  editingId = null;
  contactsRenderTable();
}

function contactSaveEdit(id) {
  const nombre  = document.getElementById('e-nombre-'  + id).value.trim();
  const numero  = document.getElementById('e-numero-'  + id).value.trim();
  const tipo    = document.getElementById('e-tipo-'    + id).value;
  const empresa = document.getElementById('e-empresa-' + id).value.trim();

  const err     = contactValidate(nombre, numero, tipo);
  const idx     = contacts.findIndex(c => c.id === id);
  if (idx === -1) return;

  contacts[idx] = {
    ...contacts[idx],
    nombre, numero, tipo, empresa,
    _valid: err === null,
    _error: err,
  };

  editingId = null;
  contactsPersist();
  contactsRender();
  toast(
    err ? 'Guardado con error: ' + err : contactDisplayName(nombre, numero) + ' actualizado',
    err ? 'err' : 'ok'
  );
}

function contactEditKeydown(e, id) {
  if (e.key === 'Enter')  contactSaveEdit(id);
  if (e.key === 'Escape') contactCancelEdit();
}

// ── Clear all ────────────────────────────────────────────────
function contactClearAll() {
  if (!contacts.length) return;
  if (!confirm('¿Eliminar los ' + contacts.length + ' contactos?')) return;
  contacts = [];
  contactsPersist();
  contactsRender();
  toast('Lista limpiada', 'info');
}

// ── CSV import ───────────────────────────────────────────────
function contactOnFileSelect(e) {
  const f = e.target.files[0];
  if (f) contactReadFile(f);
  e.target.value = '';
}

function contactDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag');
}

function contactDragLeave() {
  document.getElementById('upload-zone').classList.remove('drag');
}

function contactDrop(e) {
  e.preventDefault();
  contactDragLeave();
  const f = e.dataTransfer.files[0];
  if (f) contactReadFile(f);
}

function contactReadFile(file) {
  const reader = new FileReader();
  reader.onload  = e => contactImportCSV(e.target.result);
  reader.onerror = () => contactShowError('No se pudo leer el archivo');
  reader.readAsText(file, 'UTF-8');
}

function contactImportCSV(raw) {
  contactHideError();
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (lines.length < 2) {
    contactShowError('El archivo está vacío o solo tiene encabezado');
    return;
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  for (const col of ['numero', 'tipo']) {   // "nombre" es opcional en el CSV
    if (!headers.includes(col)) {
      contactShowError('Columna requerida ausente: "' + col + '"');
      return;
    }
  }

  let added = 0, withErrors = 0;
  const now = Date.now();

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim());
    const row  = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });

    const tipo    = (row.tipo ?? '').trim().toLowerCase();
    const err     = contactValidate(row.nombre, row.numero, tipo);
    const isValid = err === null;

    contacts.push({
      id:      now + i,
      nombre:  row.nombre  ?? '',
      numero:  row.numero  ?? '',
      tipo,
      empresa: row.empresa ?? '',
      _valid:  isValid,
      _error:  isValid ? null : err,
    });
    isValid ? added++ : withErrors++;
  }

  contactsPersist();
  contactsRender();
  toast(
    added + ' importados' + (withErrors ? ' · ' + withErrors + ' con errores' : ''),
    added > 0 ? 'ok' : 'err'
  );
}

function contactShowError(msg) {
  const el = document.getElementById('upload-error');
  el.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i> ' + esc(msg);
  el.style.display = 'block';
  toast(msg, 'err');
}

function contactHideError() {
  const el = document.getElementById('upload-error');
  if (el) el.style.display = 'none';
}

// ── Exports ──────────────────────────────────────────────────
function contactExportCSV() {
  const valid = contacts.filter(c => c._valid !== false);
  if (!valid.length) { toast('Sin contactos válidos', 'err'); return; }

  const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const lines = [
    'nombre,numero,tipo,empresa',
    ...valid.map(c => [q(c.nombre), q(c.numero), q(c.tipo), q(c.empresa)].join(','))
  ];
  contactTriggerDownload(lines.join('\n'), 'magic_contactos.csv', 'text/csv;charset=utf-8;');
  toast('CSV descargado (' + valid.length + ' contactos)', 'ok');
}

function contactExportExcel() {
  const valid = contacts.filter(c => c._valid !== false);
  if (!valid.length) { toast('Sin contactos válidos', 'err'); return; }

  const rows = valid.map(c =>
    '<tr><td>' + esc(c.nombre) + '</td>' +
    '<td style="mso-number-format:\'@\'">' + esc(c.numero) + '</td>' +
    '<td>' + esc(c.tipo) + '</td>' +
    '<td>' + esc(c.empresa ?? '') + '</td></tr>'
  ).join('');

  const html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<head><meta charset="UTF-8">' +
    '<style>th{background:#2563EB;color:#fff;font-weight:bold;padding:6px 10px}' +
    'td{padding:5px 10px;border:1px solid #ddd}</style></head>' +
    '<body><table>' +
    '<thead><tr><th>nombre</th><th>numero</th><th>tipo</th><th>empresa</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></body></html>';

  contactTriggerDownload(html, 'magic_contactos.xls', 'application/vnd.ms-excel;charset=utf-8;');
  toast('Excel descargado (' + valid.length + ' contactos)', 'ok');
}

function contactTriggerDownload(content, filename, mimeType) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Sample data ──────────────────────────────────────────────
function contactLoadSample() {
  const t = Date.now();
  contacts = contacts.concat([
    { id: t+1, nombre: 'María García',        numero: '5491167867229', tipo: 'cliente',       empresa: '',                   _valid: true, _error: null },
    { id: t+2, nombre: 'Juan Pérez',           numero: '5491167867230', tipo: 'cliente_nuevo',  empresa: '',                   _valid: true, _error: null },
    { id: t+3, nombre: 'Salón El Gran Evento', numero: '5491167867231', tipo: 'salon',          empresa: 'El Gran Evento',     _valid: true, _error: null },
    { id: t+4, nombre: 'TechCorp Argentina',   numero: '5491167867232', tipo: 'empresa',        empresa: 'TechCorp Argentina', _valid: true, _error: null },
    { id: t+5, nombre: 'Laura Rodríguez',      numero: '5491167867233', tipo: 'cliente',        empresa: '',                   _valid: true, _error: null },
  ]);
  contactsPersist();
  contactsRender();
  toast('5 contactos de ejemplo cargados', 'ok');
}

// ── Render ───────────────────────────────────────────────────
function contactsRender() {
  contactsRenderStats();
  contactsRenderTable();
  updateStatusPill();
}

function contactsRenderStats() {
  const valid   = contacts.filter(c => c._valid !== false);
  const invalid = contacts.filter(c => c._valid === false);

  document.getElementById('st-total').textContent   = contacts.length;
  document.getElementById('st-valid').textContent   = valid.length;
  document.getElementById('st-invalid').textContent = invalid.length;

  const counts = { cliente: 0, cliente_nuevo: 0, salon: 0, empresa: 0 };
  valid.forEach(c => { if (counts[c.tipo] !== undefined) counts[c.tipo]++; });
  Object.keys(counts).forEach(tipo => {
    const el = document.getElementById('tc-' + tipo);
    if (el) el.textContent = counts[tipo];
  });
}

function contactsRenderTable() {
  const tbody = document.getElementById('contacts-tbody');
  const wrap  = document.getElementById('table-wrap');
  const empty = document.getElementById('empty-state');
  const title = document.getElementById('table-title');

  if (!contacts.length) {
    wrap.style.display  = 'none';
    empty.style.display = 'block';
    title.textContent   = 'Lista de contactos';
    return;
  }

  wrap.style.display  = 'block';
  empty.style.display = 'none';
  title.textContent   = 'Lista de contactos (' + contacts.length + ')';

  tbody.innerHTML = contacts.map((c, i) => {
    if (c.id === editingId) return contactEditRowHTML(c, i);

    const isErr   = c._valid === false;
    const badge   = isErr ? 'badge-error' : 'badge-' + c.tipo;
    const stColor = isErr ? 'var(--danger)' : 'var(--success)';
    const stText  = isErr ? '<i class="bi bi-exclamation-triangle-fill"></i> ' + esc(c._error) : '<i class="bi bi-check-circle-fill"></i> OK';
    const nombreCell = c.nombre?.trim()
      ? esc(c.nombre)
      : '<span class="muted">Sin nombre</span>';
    return '<tr' + (isErr ? ' style="opacity:.6"' : '') + '>' +
      '<td class="mono muted">' + (i + 1) + '</td>' +
      '<td class="bold">' + nombreCell + '</td>' +
      '<td class="mono muted small">' + esc(c.numero) + '</td>' +
      '<td><span class="badge ' + badge + '">' + esc(c.tipo ?? '—') + '</span></td>' +
      '<td class="small muted">' + esc(c.empresa || '—') + '</td>' +
      '<td class="small" style="color:' + stColor + '">' + stText + '</td>' +
      '<td class="row-actions">' +
        '<button class="row-edit" onclick="contactStartEdit(' + c.id + ')" title="Editar"><i class="bi bi-pencil-fill"></i></button>' +
        '<button class="row-del" onclick="contactDelete(' + c.id + ')" title="Eliminar"><i class="bi bi-x-lg"></i></button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

// Fila en modo edición: mismos campos que el form de "Agregar contacto",
// pero inline en la tabla — pensado para corregir rápido un número mal
// anotado sin tener que borrar el contacto y cargarlo de nuevo.
function contactEditRowHTML(c, i) {
  const typeOption = t => '<option value="' + t + '"' + (c.tipo === t ? ' selected' : '') + '>' + t + '</option>';
  return '<tr class="row-editing">' +
    '<td class="mono muted">' + (i + 1) + '</td>' +
    '<td><input id="e-nombre-'  + c.id + '" class="edit-input" type="text" value="' + esc(c.nombre)  + '" placeholder="Nombre (opcional)" onkeydown="contactEditKeydown(event,' + c.id + ')"></td>' +
    '<td><input id="e-numero-'  + c.id + '" class="edit-input mono" type="text" value="' + esc(c.numero) + '" placeholder="Número" onkeydown="contactEditKeydown(event,' + c.id + ')"></td>' +
    '<td><select id="e-tipo-'   + c.id + '" class="edit-input">' +
      typeOption('cliente') + typeOption('cliente_nuevo') + typeOption('salon') + typeOption('empresa') +
    '</select></td>' +
    '<td><input id="e-empresa-' + c.id + '" class="edit-input" type="text" value="' + esc(c.empresa) + '" placeholder="Empresa" onkeydown="contactEditKeydown(event,' + c.id + ')"></td>' +
    '<td class="small muted">Editando…</td>' +
    '<td class="row-actions">' +
      '<button class="row-save" onclick="contactSaveEdit(' + c.id + ')" title="Guardar"><i class="bi bi-check-lg"></i></button>' +
      '<button class="row-cancel" onclick="contactCancelEdit()" title="Cancelar"><i class="bi bi-x-lg"></i></button>' +
    '</td>' +
    '</tr>';
}