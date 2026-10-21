import { api, session } from '../api.js';
import { h, toast } from '../ui.js';
import { renderShell } from '../app.js';

export function renderCuenta() {
  const u = session.user;
  const a = h('input', { type: 'password', autocomplete: 'current-password' }), n = h('input', { type: 'password', autocomplete: 'new-password' });
  const form = h('form', { class: 'card pad', style: 'max-width:420px', onsubmit: async (e) => {
    e.preventDefault();
    try { await api.changePassword(a.value, n.value); toast('Contraseña actualizada', 'ok'); a.value = n.value = ''; } catch (ex) { toast(ex.message, 'err'); }
  } },
    h('div', { class: 'field' }, h('label', {}, 'Contraseña actual'), a),
    h('div', { class: 'field' }, h('label', {}, 'Nueva contraseña'), n, h('div', { class: 'hint' }, 'Mínimo 6 caracteres.')),
    h('button', { class: 'btn primary', type: 'submit' }, 'Cambiar contraseña'));
  renderShell('/cuenta', h('div', {},
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Mi cuenta'), h('div', { class: 'sub' }, `${u.nombre} · usuario ${u.username}`))), form));
}
