import { api } from '../api.js';
import { h, spinner, toast, fechaHora, kb } from '../ui.js';
import { renderResultado } from '../resultado.js';
import { descargarExcel } from '../excel.js';
import { renderShell } from '../app.js';

export async function renderDetalle(id) {
  const cont = h('div', {}, spinner());
  renderShell('/historial', cont);
  let c;
  try { c = await api.conversion(id); } catch (e) { cont.replaceChildren(h('div', { class: 'note warn' }, e.message), h('p', {}, h('a', { href: '#/historial' }, '← Volver al historial'))); return; }
  const res = c.resultado;
  const titulo = h('input', { value: c.titulo || '', placeholder: 'Sin título' });
  cont.replaceChildren(
    h('div', { class: 'breadcrumb' }, h('a', { href: '#/historial' }, 'Historial'), ' / ', c.titulo || c.filename),
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, c.titulo || c.filename),
        h('div', { class: 'sub' }, `${c.filename} · ${kb(c.size)} · cargado por ${c.user_nombre} el ${fechaHora(c.created_at)}`)),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => api.downloadOriginal(c.id, c.filename).catch((e) => toast(e.message, 'err')) }, 'Archivo original'),
        h('button', { class: 'btn primary', onclick: async (ev) => { ev.target.disabled = true; try { await descargarExcel(res); } catch (e) { console.error(e); toast('No se pudo generar el Excel: ' + e.message, 'err'); } ev.target.disabled = false; } }, 'Descargar Excel de resultados'))),
    h('div', { class: 'card pad', style: 'margin-bottom:16px' }, h('div', { class: 'toolbar', style: 'margin:0' },
      h('div', { class: 'field', style: 'min-width:300px' }, h('label', {}, 'Título'), titulo),
      h('button', { class: 'btn', onclick: async () => { try { await api.renameConversion(c.id, titulo.value); toast('Título guardado', 'ok'); } catch (e) { toast(e.message, 'err'); } } }, 'Guardar título'))),
    res.meta?.notas?.length ? h('div', { class: 'note warn', style: 'margin-bottom:12px' }, res.meta.notas.join(' ')) : '',
    renderResultado(res));
}
