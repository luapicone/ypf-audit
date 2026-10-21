import { api } from '../api.js';
import { h, toast, spinner, kb } from '../ui.js';
import { calcular } from '../calc.js';
import { leerAuditoria, plantillaBlob } from '../lector.js';
import { construirResultado, renderResultado } from '../resultado.js';
import { descargarExcel } from '../excel.js';
import { saveBlob, session } from '../api.js';
import { renderShell } from '../app.js';

let MAPPING = null;
async function mapping() { if (!MAPPING) MAPPING = await (await fetch('/data/mapping.json')).json(); return MAPPING; }

function toBase64(buf) {
  let s = ''; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function renderConvertir() {
  const file = h('input', { type: 'file', accept: '.xlsx,.xls,.csv', hidden: true });
  const titulo = h('input', { placeholder: 'Ej.: Auditoría Refinería Norte 2026 (opcional)' });
  const out = h('div', { style: 'margin-top:22px' });
  const drop = h('div', { class: 'dropzone', tabindex: 0, role: 'button', onclick: () => file.click() },
    h('div', { class: 'big' }, 'Arrastrá el Excel de la auditoría acá'),
    h('div', { class: 'small' }, 'o hacé clic para elegirlo · .xlsx, .xls o .csv · hasta 3 MB'));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => procesar(e.dataTransfer.files[0]));
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter') file.click(); });
  file.addEventListener('change', () => procesar(file.files[0]));

  async function procesar(f) {
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { toast('El archivo supera los 3 MB', 'err'); return; }
    out.replaceChildren(spinner());
    try {
      const buf = await f.arrayBuffer();
      const { filas, notas } = leerAuditoria(buf);
      if (!filas.length) { out.replaceChildren(h('div', { class: 'note warn' }, notas.join(' ') || 'No se encontraron filas con Norma, Punto y Porcentaje en el archivo.')); return; }
      const res = construirResultado(calcular(filas, await mapping()), {
        archivo: f.name, usuario: session.user.nombre, fecha: new Date().toISOString(), notas,
      });
      let guardado = null, aviso;
      try {
        guardado = await api.saveConversion({ titulo: titulo.value, filename: f.name, fileBase64: toBase64(buf), resultado: res });
        aviso = h('div', { class: 'note' }, 'Guardado en tu historial. Podés volver a descargar el archivo original y el Excel de resultados cuando quieras. ',
          h('a', { href: '#/historial/' + guardado.id }, 'Ver en el historial'));
      } catch (ex) { aviso = h('div', { class: 'note warn' }, 'El resultado se calculó pero no se pudo guardar en el historial: ' + ex.message); }
      const bt = h('button', { class: 'btn primary', onclick: async () => { bt.disabled = true; try { await descargarExcel(res); } catch (e) { console.error(e); toast('No se pudo generar el Excel: ' + e.message, 'err'); } bt.disabled = false; } }, 'Descargar Excel de resultados');
      out.replaceChildren(
        h('div', { class: 'page-head', style: 'margin-bottom:12px' },
          h('div', {}, h('h1', {}, 'Resultado'), h('div', { class: 'sub' }, `${f.name} · ${kb(f.size)}`)),
          h('div', { class: 'btn-row' }, bt)),
        aviso, notas.length ? h('div', { class: 'note warn', style: 'margin-top:8px' }, notas.join(' ')) : '',
        h('div', { style: 'margin-top:16px' }, renderResultado(res)));
      if (guardado) toast('Auditoría guardada en el historial', 'ok');
    } catch (ex) { console.error(ex); out.replaceChildren(h('div', { class: 'note warn' }, 'No se pudo leer el archivo: ' + ex.message)); }
  }

  renderShell('/', h('div', {},
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Nueva conversión'),
      h('div', { class: 'sub' }, 'Subí el Excel de una auditoría (porcentaje por punto de la norma) y obtené el porcentaje por elemento.')),
      h('button', { class: 'btn', onclick: () => saveBlob(plantillaBlob(), 'plantilla_auditoria.xlsx') }, 'Descargar plantilla de entrada')),
    h('div', { class: 'card pad' },
      h('div', { class: 'field' }, h('label', {}, 'Título o empresa'), titulo,
        h('div', { class: 'hint' }, 'Sirve para encontrar esta auditoría después en el historial.')),
      drop, file,
      h('div', { class: 'hint muted', style: 'margin-top:10px' }, 'Formato: una fila por punto con las columnas Norma (ISO 9001, ISO 14001, ISO 45001…), Punto (por ejemplo 5.2 o 10.2.1) y Porcentaje (0 a 100). Sin porcentaje = no auditado.')),
    out));
}
