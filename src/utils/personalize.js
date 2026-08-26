'use strict';

// Reemplaza {variable} en una plantilla con los datos del contacto.
// Si falta "nombre" (es opcional), se reemplaza por string vacío en vez de
// dejar el placeholder literal en el mensaje enviado.
// Para cualquier otra variable faltante, se deja el placeholder tal cual
// para que sea fácil detectar plantillas mal armadas.
function personalize(template, contact) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = contact[key];
    if (value !== undefined && String(value).trim() !== '') return String(value);
    if (key === 'nombre') return '';
    return match;
  });
}

module.exports = { personalize };
