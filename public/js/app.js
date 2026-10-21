import { api, session } from './api.js';
import { h, mount, spinner, ypfLogo } from './ui.js';
import { renderLogin } from './views/login.js';
import { renderConvertir } from './views/convertir.js';
import { renderHistorial } from './views/historial.js';
import { renderDetalle } from './views/detalle.js';
import { renderUsuarios } from './views/usuarios.js';
import { renderCuenta } from './views/cuenta.js';

function shell(active, content) {
  const u = session.user;
  const link = (hash, label) => h('a', { class: 'nav-link' + (active === hash ? ' active' : ''), href: '#' + hash }, label);
  const nav = [link('/', 'Nueva conversión'), link('/historial', 'Historial')];
  if (u.rol === 'admin') nav.push(link('/usuarios', 'Usuarios'));
  nav.push(link('/cuenta', 'Mi cuenta'));
  return h('div', { class: 'app-shell' },
    h('aside', { class: 'sidebar' },
      h('div', { class: 'logo' }, ypfLogo('box'), h('span', { class: 'brandline' }, 'SGEO', h('small', {}, 'Conversor de auditorías'))),
      ...nav, h('div', { class: 'spacer' }),
      h('div', { class: 'user-box' }, h('b', {}, u.nombre), u.rol === 'admin' ? 'Administrador' : 'Usuario',
        h('button', { class: 'btn-logout', onclick: () => { session.clear(); location.hash = '#/login'; } }, 'Cerrar sesión'))),
    h('main', { class: 'main' }, content));
}
export function renderShell(active, node) { mount(shell(active, node)); }

const routes = [
  { re: /^\/$/, fn: () => renderConvertir() },
  { re: /^\/historial$/, fn: () => renderHistorial() },
  { re: /^\/historial\/(\d+)$/, fn: (m) => renderDetalle(Number(m[1])) },
  { re: /^\/usuarios$/, fn: () => renderUsuarios(), admin: true },
  { re: /^\/cuenta$/, fn: () => renderCuenta() },
];

async function router() {
  const raw = location.hash.replace(/^#/, '') || '/';
  if (raw === '/login') { renderLogin(); return; }
  if (!session.token) { location.hash = '#/login'; return; }
  mount(h('div', { class: 'app-shell' }, h('div', {}), h('main', { class: 'main' }, spinner())));
  try { session.set(session.token, (await api.me()).user); } catch { session.clear(); location.hash = '#/login'; return; }
  for (const r of routes) {
    const m = raw.split('?')[0].match(r.re);
    if (m) { if (r.admin && session.user.rol !== 'admin') break; r.fn(m); return; }
  }
  location.hash = '#/';
}
window.addEventListener('hashchange', router);
window.addEventListener('load', router);
