import { api, session } from '../api.js';
import { h, spinner, toast, confirmModal, fechaHora, kb, meter } from '../ui.js';
import { ESTADO_COLOR } from '../resultado.js';
import { descargarExcel } from '../excel.js';
import { renderShell } from '../app.js';

export async function renderHistorial() {
  const admin = session.user.rol === 'admin';
  const cont = h('div', {}, spinner());
  renderShell('/historial', cont);
  let todos = false, filtro = '', rows = [];

  const buscar = h('input', { placeholder: 'Buscar por título, archivo o usuario…', oninput: (e) => { filtro = e.target.value.toLowerCase(); pintar(); } });
  const chk = h('input', { type: 'checkbox', onchange: async (e) => { todos = e.target.checked; await cargar(); } });
  const lista = h('div', {});

  async function cargar() {
    lista.replaceChildren(spinner());
    try { rows = await api.conversions(todos); } catch (e) { lista.replaceChildren(h('div', { class: 'note warn' }, e.message)); return; }
    pintar();
  }

  function pintar() {
    const f = rows.filter((r) => `${r.titulo || ''} ${r.filename} ${r.user_nombre}`.toLowerCase().includes(filtro));
    if (!f.length) { lista.replaceChildren(h('div', { class: 'card empty' }, rows.length ? 'No hay resultados para esa búsqueda.' : 'Todavía no cargaste ninguna auditoría. Empezá desde «Nueva conversión».')); return; }
    lista.replaceChildren(h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Fecha'), h('th', {}, 'Auditoría'), todos ? h('th', {}, 'Usuario') : '', h('th', {}, 'Cumplimiento'), h('th', {}, 'Estado'), h('th', {}, ''))),
      h('tbody', {}, ...f.map((r) => {
        const estado = r.resumen?.estado;
        return h('tr', {},
          h('td', { style: 'white-space:nowrap' }, fechaHora(r.created_at)),
          h('td', {}, h('a', { href: '#/historial/' + r.id }, h('b', {}, r.titulo || r.filename)), h('div', { class: 'muted', style: 'font-size:12px' }, `${r.filename} · ${kb(r.size)}`)),
          todos ? h('td', {}, r.user_nombre) : '',
          h('td', { style: 'min-width:150px' }, meter(r.resumen?.total)),
          h('td', {}, estado ? h('span', { class: 'badge estado', style: `background:${ESTADO_COLOR[estado] || '#8a8f98'}` }, estado) : '—'),
          h('td', {}, h('div', { class: 'row-actions' },
            h('a', { class: 'btn sm', href: '#/historial/' + r.id }, 'Ver'),
            h('button', { class: 'btn sm', onclick: async () => { try { const c = await api.conversion(r.id); await descargarExcel(c.resultado); } catch (e) { toast(e.message, 'err'); } } }, 'Excel resultados'),
            h('button', { class: 'btn sm', onclick: () => api.downloadOriginal(r.id, r.filename).catch((e) => toast(e.message, 'err')) }, 'Archivo original'),
            h('button', { class: 'btn sm danger', onclick: () => confirmModal('Eliminar del historial', `¿Eliminar «${r.titulo || r.filename}»? Esta acción no se puede deshacer.`,
              async () => { try { await api.deleteConversion(r.id); toast('Eliminada', 'ok'); cargar(); } catch (e) { toast(e.message, 'err'); } }, 'Eliminar', 'danger') }, 'Eliminar'))));
      })))));
  }

  cont.replaceChildren(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Historial'), h('div', { class: 'sub' }, admin ? 'Tus auditorías cargadas y, si querés, las de todos los usuarios.' : 'Todas las auditorías que cargaste. Podés volver a descargar el archivo original o el Excel de resultados.'))),
    h('div', { class: 'toolbar' }, h('div', { class: 'field', style: 'min-width:280px' }, h('label', {}, 'Buscar'), buscar),
      admin ? h('label', { class: 'chk' }, chk, 'Ver todos los usuarios') : ''),
    lista);
  cargar();
}
