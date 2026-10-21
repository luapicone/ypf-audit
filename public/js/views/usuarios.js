import { api, session } from '../api.js';
import { h, spinner, toast, modal, confirmModal, fechaHora } from '../ui.js';
import { renderShell } from '../app.js';

export async function renderUsuarios() {
  const cont = h('div', {}, spinner());
  renderShell('/usuarios', cont);
  const lista = h('div', {});

  async function cargar() {
    let us; try { us = await api.users(); } catch (e) { lista.replaceChildren(h('div', { class: 'note warn' }, e.message)); return; }
    lista.replaceChildren(h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Nombre'), h('th', {}, 'Usuario'), h('th', {}, 'Perfil'), h('th', { class: 'num' }, 'Archivos'), h('th', {}, 'Alta'), h('th', {}, ''))),
      h('tbody', {}, ...us.map((u) => h('tr', {},
        h('td', {}, h('b', {}, u.nombre)), h('td', {}, u.username),
        h('td', {}, h('span', { class: 'badge soft' }, u.rol === 'admin' ? 'Administrador' : 'Usuario')),
        h('td', { class: 'num' }, u.archivos), h('td', {}, fechaHora(u.created_at)),
        h('td', {}, h('div', { class: 'row-actions' },
          h('button', { class: 'btn sm', onclick: () => resetear(u) }, 'Cambiar contraseña'),
          u.id === session.user.id ? '' : h('button', { class: 'btn sm danger', onclick: () => confirmModal('Eliminar usuario', `¿Eliminar a «${u.nombre}» y todo su historial? No se puede deshacer.`,
            async () => { try { await api.deleteUser(u.id); toast('Usuario eliminado', 'ok'); cargar(); } catch (e) { toast(e.message, 'err'); } }, 'Eliminar', 'danger') }, 'Eliminar')))))))));
  }

  function resetear(u) {
    const p = h('input', { type: 'text', placeholder: 'Nueva contraseña (mínimo 6)' });
    modal({ title: `Cambiar contraseña de ${u.nombre}`, body: h('div', { class: 'field' }, p),
      actions: [{ label: 'Cancelar', fn: (c) => c() }, { label: 'Guardar', class: 'primary', fn: async (c) => {
        try { await api.resetPassword(u.id, p.value); toast('Contraseña actualizada', 'ok'); c(); } catch (e) { toast(e.message, 'err'); } } }] });
  }

  function nuevo() {
    const f = { nombre: h('input'), username: h('input', { autocomplete: 'off' }), password: h('input', { type: 'text', placeholder: 'Mínimo 6 caracteres' }),
      rol: h('select', {}, h('option', { value: 'usuario' }, 'Usuario'), h('option', { value: 'admin' }, 'Administrador')) };
    const campo = (l, el) => h('div', { class: 'field' }, h('label', {}, l), el);
    modal({ title: 'Nuevo usuario', body: h('div', {}, campo('Nombre y apellido', f.nombre), campo('Usuario', f.username), campo('Contraseña inicial', f.password), campo('Perfil', f.rol)),
      actions: [{ label: 'Cancelar', fn: (c) => c() }, { label: 'Crear usuario', class: 'primary', fn: async (c) => {
        try { await api.createUser({ nombre: f.nombre.value, username: f.username.value, password: f.password.value, rol: f.rol.value }); toast('Usuario creado', 'ok'); c(); cargar(); }
        catch (e) { toast(e.message, 'err'); } } }] });
  }

  cont.replaceChildren(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Usuarios'), h('div', { class: 'sub' }, 'Cada persona entra con su usuario y ve solo su historial. Los administradores pueden ver todo.')),
      h('button', { class: 'btn primary', onclick: nuevo }, 'Nuevo usuario')), lista);
  cargar();
}
