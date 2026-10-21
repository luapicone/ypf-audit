import { api, session } from '../api.js';
import { h, mount, ypfLogo } from '../ui.js';

export function renderLogin() {
  const err = h('div', { class: 'err', style: 'display:none' });
  const form = h('form', { class: 'login-card', onsubmit: onSubmit },
    h('h1', {}, 'Conversor de Auditorías'),
    h('p', { class: 'sub' }, 'Ingresá con tu usuario para cargar y consultar tus auditorías'),
    err,
    h('div', { class: 'field' }, h('label', {}, 'Usuario'),
      h('input', { name: 'username', autocomplete: 'username', required: true, autofocus: true })),
    h('div', { class: 'field' }, h('label', {}, 'Contraseña'),
      h('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: true })),
    h('button', { class: 'btn primary', type: 'submit', style: 'width:100%;justify-content:center' }, 'Ingresar'));

  async function onSubmit(e) {
    e.preventDefault();
    err.style.display = 'none';
    const f = new FormData(e.target);
    try {
      const { token, user } = await api.login(f.get('username'), f.get('password'));
      session.set(token, user);
      location.hash = '#/';
    } catch (ex) { err.textContent = ex.message; err.style.display = 'block'; }
  }

  mount(h('div', { class: 'login-wrap' }, h('div', { class: 'login-inner' },
    h('div', { class: 'login-brand' }, ypfLogo('plain'),
      h('span', { class: 'brandtxt' }, 'Excelencia Operacional', h('b', {}, 'SGEO · Conversor de Auditorías'))),
    form)));
}
