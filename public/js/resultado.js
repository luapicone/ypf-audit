/** Resultado de una auditoría: construcción, estados y vista en pantalla. */
import { h, pct100 } from './ui.js';
import { NORMAS, round } from './calc.js';

// Pesos de cada elemento en el total de la auditoría (columna L de la matriz "Comparativa SGEO FINAL").
export const PESOS = { E1: 15, E2: 15, E3: 15, E4: 35, E5: 20 };
export const ESTADOS = [
  { min: 91, estado: 'Mantener' }, { min: 81, estado: 'Optimizar' }, { min: 61, estado: 'Mejorar' },
  { min: 41, estado: 'Implementar' }, { min: 0, estado: 'Crítico' },
];
export const ESTADO_COLOR = {
  Mantener: '#1a7f5a', Optimizar: '#3b82a0', Mejorar: '#c98a1b', Implementar: '#d9722b', 'Crítico': '#c0392b', 'Sin datos': '#8a8f98',
};
export const estadoDe = (v) => (v == null ? 'Sin datos' : ESTADOS.find((e) => v >= e.min - 1e-9).estado);
export const codigo = (elemento) => String(elemento).split(':')[0].trim();
export const corto = (elemento) => String(elemento).replace(/^E\d+:\s*/, '');

/** Convierte la salida del motor en el objeto que se guarda en el historial. */
export function construirResultado(out, meta) {
  const elementos = out.elementos.map((e) => ({
    elemento: e.elemento, codigo: codigo(e.elemento), nombre: corto(e.elemento), peso: PESOS[codigo(e.elemento)] || 0,
    valor: e.valor, estado: estadoDe(e.valor), seEvaluados: e.seEvaluados, seTotal: e.seTotal, porNorma: e.porNorma,
  }));
  const evaluados = elementos.filter((e) => e.valor != null);
  const pesoTot = evaluados.reduce((a, e) => a + e.peso, 0);
  const total = pesoTot ? evaluados.reduce((a, e) => a + e.peso * e.valor, 0) / pesoTot : null;
  const subelementos = out.subelementos.map((s) => ({
    se: s.se, elemento: s.elemento, codigo: codigo(s.elemento), nombre: s.nombre, valor: s.valor, estado: estadoDe(s.valor), porNorma: s.porNorma, puntos: s.puntos,
  }));
  const detalle = out.detalle.map((d) => ({
    fila: d.fila, norma: d.norma || d.normaOriginal || '', punto: d.punto, valor: d.valor == null || Number.isNaN(d.valor) ? null : d.valor,
    subelementos: d.subelementos, estado: d.estado,
  }));
  const usados = detalle.filter((d) => /^Usado/.test(d.estado)).length;
  const normas = NORMAS.filter((n) => subelementos.some((s) => s.porNorma[n] != null));
  return {
    meta,
    normas,
    resumen: {
      total, estado: estadoDe(total), elementosEvaluados: evaluados.length, elementosTotal: elementos.length,
      subelementosEvaluados: subelementos.filter((s) => s.valor != null).length, subelementosTotal: subelementos.length,
      puntosLeidos: detalle.length, puntosUsados: usados,
      elementos: elementos.map((e) => ({ codigo: e.codigo, nombre: e.nombre, valor: e.valor, estado: e.estado })),
    },
    elementos, subelementos, detalle,
  };
}

/* ───────── Vista en pantalla ───────── */
const fmt = (v) => (v == null ? '—' : round(v, 1).toFixed(1) + '%');
const estadoPill = (e) => h('span', { class: 'badge estado', style: `background:${ESTADO_COLOR[e] || '#8a8f98'}` }, e);

export function barChart(canvas, labels, values, colors, horizontal = false) {
  return new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 4 }] },
    options: {
      indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + fmt(c.parsed[horizontal ? 'x' : 'y']) } } },
      scales: { [horizontal ? 'x' : 'y']: { min: 0, max: 100, ticks: { callback: (v) => v + '%' } } },
    },
  });
}

export function renderResultado(res, { onExcel } = {}) {
  const r = res.resumen;
  const sinDatos = r.total == null;
  const kpis = h('div', { class: 'grid cols-4', style: 'margin-bottom:16px' },
    h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Cumplimiento general'), h('div', { class: 'v' }, fmt(r.total)),
      h('div', { class: 'd' }, 'Promedio ponderado por peso de elemento')),
    h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Estado global'),
      h('span', { class: 'kpi-estado', style: `background:${ESTADO_COLOR[r.estado]}` }, r.estado)),
    h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Elementos evaluados'), h('div', { class: 'v' }, `${r.elementosEvaluados} de ${r.elementosTotal}`),
      h('div', { class: 'd' }, `${r.subelementosEvaluados} de ${r.subelementosTotal} subelementos`)),
    h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Puntos usados'), h('div', { class: 'v' }, `${r.puntosUsados} de ${r.puntosLeidos}`),
      h('div', { class: 'd' }, res.normas.length ? res.normas.join(' · ') : 'Sin normas reconocidas')));

  const out = h('div', {}, kpis);
  if (sinDatos) {
    out.append(h('div', { class: 'note warn' }, 'No se pudo calcular ningún elemento: ningún punto del archivo coincide con la matriz o no tienen porcentaje. Revisá la solapa "Detalle de filas".'));
  } else {
    const c1 = h('canvas'), c2 = h('canvas');
    out.append(h('div', { class: 'two-col', style: 'margin-bottom:16px' },
      h('div', { class: 'card pad' }, h('div', { class: 'card-title' }, '% de logro por elemento'), h('div', { class: 'chart-box' }, c1)),
      h('div', { class: 'card pad' }, h('div', { class: 'card-title' }, 'Perfil por elemento'), h('div', { class: 'chart-box' }, c2))));
    queueMicrotask(() => {
      barChart(c1, res.elementos.map((e) => `${e.codigo} ${e.nombre}`.slice(0, 28)), res.elementos.map((e) => (e.valor == null ? null : round(e.valor, 1))),
        res.elementos.map((e) => ESTADO_COLOR[e.estado]));
      const pal = ['#0b5fa5', '#0e7c86', '#c98a1b', '#7a5ea8'];
      const ds = [{ label: 'General', data: res.elementos.map((e) => e.valor), borderColor: '#005090', backgroundColor: 'rgba(0,80,144,.18)', pointBackgroundColor: '#005090' }];
      res.normas.forEach((n, i) => ds.push({ label: n, data: res.elementos.map((e) => e.porNorma[n] ?? null), borderColor: pal[i % pal.length], backgroundColor: 'transparent', borderDash: [4, 3], pointRadius: 2 }));
      new Chart(c2, { type: 'radar', data: { labels: res.elementos.map((e) => e.codigo), datasets: ds },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100, ticks: { stepSize: 25 } } }, plugins: { legend: { position: 'bottom' } } } });
    });
  }

  // Tablas con solapas
  const body = h('div', {});
  const tabs = h('div', { class: 'tabs' });
  const vistas = {
    el: () => tablaElementos(res), se: () => tablaSubelementos(res), det: () => tablaDetalle(res),
  };
  const names = { el: 'Por elemento', se: 'Por subelemento', det: 'Detalle de filas' };
  const show = (k) => {
    [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    body.replaceChildren(vistas[k]());
  };
  for (const k of Object.keys(names)) tabs.append(h('button', { 'data-k': k, onclick: () => show(k) }, names[k]));
  out.append(tabs, body, h('div', { class: 'estado-legend' }, ...ESTADOS.map((e, i) =>
    h('span', { style: `background:${ESTADO_COLOR[e.estado]}` }, `${e.estado} ${i === 0 ? '≥ 91%' : i === 4 ? '< 41%' : `≥ ${e.min}%`}`))));
  show('el');
  return out;
}

function tablaElementos(res) {
  const ns = res.normas;
  return h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Elemento'), h('th', { class: 'num' }, 'Peso'), h('th', {}, '% de logro'), h('th', {}, 'Estado'),
      h('th', { class: 'num' }, 'SE evaluados'), ...ns.map((n) => h('th', { class: 'num' }, n)))),
    h('tbody', {}, ...res.elementos.map((e) => h('tr', {},
      h('td', {}, h('b', {}, e.codigo), ' ', e.nombre), h('td', { class: 'num' }, e.peso),
      h('td', { style: 'min-width:170px' }, h('div', { class: 'meter' }, h('div', { class: 'bar' }, h('i', { style: `width:${e.valor || 0}%;background:${ESTADO_COLOR[e.estado]}` })), h('span', { class: 'pct' }, fmt(e.valor)))),
      h('td', {}, estadoPill(e.estado)), h('td', { class: 'num' }, `${e.seEvaluados}/${e.seTotal}`),
      ...ns.map((n) => h('td', { class: 'num' }, fmt(e.porNorma[n]))))))));
}

function tablaSubelementos(res) {
  const ns = res.normas;
  return h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'SE'), h('th', {}, 'Subelemento'), h('th', {}, 'Elemento'), h('th', { class: 'num' }, '% total'), h('th', {}, 'Estado'), ...ns.map((n) => h('th', { class: 'num' }, n)))),
    h('tbody', {}, ...res.subelementos.map((s) => h('tr', {},
      h('td', {}, s.se), h('td', {}, s.nombre), h('td', {}, h('span', { class: 'pill-norma' }, s.codigo)),
      h('td', { class: 'num' }, h('b', {}, fmt(s.valor))), h('td', {}, estadoPill(s.estado)), ...ns.map((n) => h('td', { class: 'num' }, fmt(s.porNorma[n]))))))));
}

function tablaDetalle(res) {
  return h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Fila'), h('th', {}, 'Norma'), h('th', {}, 'Punto'), h('th', { class: 'num' }, '%'), h('th', {}, 'Subelementos'), h('th', {}, 'Estado'))),
    h('tbody', {}, ...res.detalle.map((d) => h('tr', {},
      h('td', {}, d.fila), h('td', {}, d.norma), h('td', {}, d.punto), h('td', { class: 'num' }, d.valor == null ? '—' : round(d.valor, 1)),
      h('td', {}, d.subelementos), h('td', { class: /^Usado/.test(d.estado) ? '' : 'muted' }, d.estado))))));
}
