/** Excel de salida (ExcelJS): resumen visual con KPIs, colores por estado y gráficos, más detalle. */
import { ESTADOS, ESTADO_COLOR, PESOS } from './resultado.js';
import { saveBlob } from './api.js';

const AZUL = 'FF005090', AZUL2 = 'FF0A63AD', GRIS = 'FF6B7280', LINEA = 'FFD9DEE5', CLARO = 'FFF3F6FA';
const argb = (hex) => 'FF' + hex.replace('#', '').toUpperCase();
const fill = (c) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
const borde = (c = LINEA) => ({ top: { style: 'thin', color: { argb: c } }, bottom: { style: 'thin', color: { argb: c } }, left: { style: 'thin', color: { argb: c } }, right: { style: 'thin', color: { argb: c } } });
const FMT = '0.0"%"';
const colLetter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

/** Dibuja un gráfico de Chart.js fuera de pantalla y lo devuelve como PNG (data URL). */
function chartPNG(config, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const bg = { id: 'bg', beforeDraw(c) { const x = c.ctx; x.save(); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.restore(); } };
  const valores = {
    id: 'valores',
    afterDatasetsDraw(c) {
      if (!config.etiquetas) return;
      const x = c.ctx; x.save(); x.fillStyle = '#1f2430'; x.font = 'bold 12px Arial';
      const meta = c.getDatasetMeta(0);
      meta.data.forEach((bar, i) => {
        const v = c.data.datasets[0].data[i]; if (v == null) return;
        const t = v.toFixed(1) + '%';
        if (c.options.indexAxis === 'y') { x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(t, bar.x + 5, bar.y); }
        else { x.textAlign = 'center'; x.textBaseline = 'bottom'; x.fillText(t, bar.x, bar.y - 4); }
      });
      x.restore();
    },
  };
  const ch = new Chart(canvas, {
    type: config.type, data: config.data, plugins: [bg, valores],
    options: { responsive: false, animation: false, devicePixelRatio: 2, ...config.options },
  });
  const url = ch.toDataURL ? ch.toDataURL('image/png') : canvas.toDataURL('image/png');
  ch.destroy();
  return url;
}

const barOpts = (horizontal, title) => ({
  indexAxis: horizontal ? 'y' : 'x', layout: { padding: { top: 20, right: 40 } },
  plugins: { legend: { display: false }, title: { display: true, text: title, font: { size: 15, weight: 'bold' }, color: '#005090' } },
  scales: { [horizontal ? 'x' : 'y']: { min: 0, max: 100, ticks: { callback: (v) => v + '%' }, grid: { color: '#e5e7eb' } }, [horizontal ? 'y' : 'x']: { grid: { display: false } } },
});

function encabezado(ws, texto, ultimaCol, sub) {
  ws.mergeCells(2, 2, 3, ultimaCol);
  const c = ws.getCell(2, 2);
  c.value = texto; c.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  for (let r = 2; r <= 3; r++) for (let k = 2; k <= ultimaCol; k++) ws.getCell(r, k).fill = fill(AZUL);
  ws.getRow(2).height = 24; ws.getRow(3).height = 18;
  ws.mergeCells(4, 2, 4, ultimaCol);
  const s = ws.getCell(4, 2);
  s.value = sub; s.font = { size: 10, italic: true, color: { argb: GRIS } }; s.alignment = { indent: 1, vertical: 'middle' };
  for (let k = 2; k <= ultimaCol; k++) ws.getCell(4, k).fill = fill(CLARO);
  ws.getRow(4).height = 18;
}

function titulos(row, desde, textos) {
  textos.forEach((t, i) => {
    const c = row.getCell(desde + i);
    c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    c.fill = fill(AZUL); c.border = borde(AZUL);
    c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', wrapText: true };
  });
  row.height = 28;
}

const estadoCell = (c, estado) => {
  c.value = estado; c.fill = fill(argb(ESTADO_COLOR[estado] || '#8a8f98'));
  c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = borde();
};
const pctCell = (c, v) => {
  c.border = borde(); c.alignment = { horizontal: 'center', vertical: 'middle' };
  if (v == null) { c.value = '–'; c.font = { color: { argb: GRIS } }; } else { c.value = Math.round(v * 100) / 100; c.numFmt = FMT; }
};
const escala = { type: 'colorScale', cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 50 }, { type: 'num', value: 100 }], color: [{ argb: 'FFF8696B' }, { argb: 'FFFFEB84' }, { argb: 'FF63BE7B' }] };

export async function generarExcel(res) {
  const wb = new ExcelJS.Workbook();
  wb.creator = res.meta.usuario || 'Conversor de auditorías'; wb.created = new Date();
  const ns = res.normas;
  const fecha = new Date(res.meta.fecha || Date.now()).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });
  const sub = `Archivo: ${res.meta.archivo}   ·   Usuario: ${res.meta.usuario || '—'}   ·   Fecha: ${fecha}`;

  /* ───────────── 1. Resumen ───────────── */
  const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const fixed = [3, 44, 10, 13, 15, 14]; // A..F
  const widths = [...fixed, ...ns.map(() => 14)];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const last = 6 + Math.max(ns.length, 1) + (ns.length ? 0 : 0);
  const ultima = Math.max(last, 9);
  encabezado(ws, 'Resultados de auditoría por elemento', ultima, sub);

  // KPIs
  const r = res.resumen;
  const tile = (c1, c2, label, value, opts = {}) => {
    ws.mergeCells(6, c1, 6, c2); ws.mergeCells(7, c1, 8, c2);
    const l = ws.getCell(6, c1), v = ws.getCell(7, c1);
    l.value = label; l.font = { size: 10, color: { argb: GRIS }, bold: true }; l.alignment = { horizontal: 'center', vertical: 'middle' };
    v.value = value; v.font = { size: opts.size || 24, bold: true, color: { argb: opts.color || AZUL } }; v.alignment = { horizontal: 'center', vertical: 'middle' };
    if (opts.numFmt) v.numFmt = opts.numFmt;
    for (let rr = 6; rr <= 8; rr++) for (let cc = c1; cc <= c2; cc++) {
      const cell = ws.getCell(rr, cc); cell.fill = fill(opts.bg || 'FFFFFFFF');
      cell.border = { top: rr === 6 ? { style: 'medium', color: { argb: opts.top || AZUL2 } } : undefined, left: cc === c1 ? { style: 'thin', color: { argb: LINEA } } : undefined,
        right: cc === c2 ? { style: 'thin', color: { argb: LINEA } } : undefined, bottom: rr === 8 ? { style: 'thin', color: { argb: LINEA } } : undefined };
    }
  };
  ws.getRow(6).height = 20; ws.getRow(7).height = 22; ws.getRow(8).height = 22;
  tile(2, 2, 'CUMPLIMIENTO GENERAL (PONDERADO)', r.total == null ? '–' : Math.round(r.total * 10) / 10, { numFmt: FMT });
  tile(3, 4, 'ESTADO GLOBAL', r.estado, { color: argb(ESTADO_COLOR[r.estado]), size: 20, top: argb(ESTADO_COLOR[r.estado]) });
  tile(5, 6, 'ELEMENTOS EVALUADOS', `${r.elementosEvaluados} de ${r.elementosTotal}`, { size: 20 });
  if (ultima >= 7) tile(7, ultima, 'PUNTOS USADOS / LEÍDOS', `${r.puntosUsados} de ${r.puntosLeidos}`, { size: 20 });

  // Tabla por elemento
  ws.mergeCells(10, 2, 10, ultima);
  const t = ws.getCell(10, 2); t.value = 'Resultado por elemento'; t.font = { size: 14, bold: true, color: { argb: AZUL } };
  for (let k = 2; k <= ultima; k++) ws.getCell(10, k).border = { bottom: { style: 'medium', color: { argb: AZUL2 } } };
  titulos(ws.getRow(11), 2, ['Elemento', 'Peso', '% de logro', 'Estado', 'Subelementos evaluados', ...ns.map((n) => '% ' + n)]);
  res.elementos.forEach((e, i) => {
    const row = ws.getRow(12 + i); row.height = 22;
    const a = row.getCell(2); a.value = `${e.codigo}  ${e.nombre}`; a.font = { bold: true }; a.border = borde(); a.alignment = { vertical: 'middle', indent: 1 };
    if (i % 2) a.fill = fill(CLARO);
    const p = row.getCell(3); p.value = e.peso; p.border = borde(); p.alignment = { horizontal: 'center', vertical: 'middle' }; p.font = { color: { argb: GRIS } };
    pctCell(row.getCell(4), e.valor); if (e.valor != null) row.getCell(4).font = { bold: true, size: 12 };
    estadoCell(row.getCell(5), e.estado);
    const sv = row.getCell(6); sv.value = `${e.seEvaluados} de ${e.seTotal}`; sv.border = borde(); sv.alignment = { horizontal: 'center', vertical: 'middle' };
    ns.forEach((n, k) => pctCell(row.getCell(7 + k), e.porNorma[n] ?? null));
  });
  const n = res.elementos.length, fin = 11 + n;
  const tot = ws.getRow(fin + 1); tot.height = 24;
  const tl = tot.getCell(2); tl.value = 'TOTAL AUDITORÍA (ponderado por peso)'; tl.font = { bold: true, color: { argb: 'FFFFFFFF' } }; tl.fill = fill(AZUL2); tl.alignment = { indent: 1, vertical: 'middle' };
  tot.getCell(3).value = res.elementos.filter((e) => e.valor != null).reduce((a, e) => a + e.peso, 0); tot.getCell(3).fill = fill(AZUL2); tot.getCell(3).font = { color: { argb: 'FFFFFFFF' } }; tot.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
  const tv = tot.getCell(4); pctCell(tv, r.total); tv.fill = fill(AZUL2); tv.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  estadoCell(tot.getCell(5), r.estado); tot.getCell(6).fill = fill(AZUL2);
  ns.forEach((_, k) => { tot.getCell(7 + k).fill = fill(AZUL2); });

  if (n) {
    ws.addConditionalFormatting({ ref: `D12:D${fin}`, rules: [{ type: 'dataBar', cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 100 }], color: { argb: 'FF8DB9E0' }, gradient: false, priority: 1 }] });
    if (ns.length) ws.addConditionalFormatting({ ref: `G12:${colLetter(6 + ns.length)}${fin}`, rules: [{ ...escala, priority: 2 }] });
  }

  // Escala de estados
  const lr = fin + 3;
  ws.getCell(lr, 2).value = 'Escala de estados'; ws.getCell(lr, 2).font = { bold: true, color: { argb: AZUL } };
  ESTADOS.forEach((e, i) => {
    const c = ws.getCell(lr + 1 + i, 2);
    c.value = `${e.estado}   ${i === 0 ? '91% o más' : i === 4 ? 'menos de 41%' : `desde ${e.min}%`}`;
    c.fill = fill(argb(ESTADO_COLOR[e.estado])); c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.alignment = { indent: 1 };
  });

  // Gráficos
  if (r.total != null) {
    const barras = chartPNG({
      type: 'bar', etiquetas: true,
      data: { labels: res.elementos.map((e) => `${e.codigo} ${e.nombre}`.replace(/(.{22}\S*)\s/g, '$1\n').split('\n')), datasets: [{ data: res.elementos.map((e) => (e.valor == null ? null : Math.round(e.valor * 10) / 10)), backgroundColor: res.elementos.map((e) => ESTADO_COLOR[e.estado]) }] },
      options: barOpts(false, '% de logro por elemento'),
    }, 620, 360);
    const pal = ['#0b5fa5', '#0e7c86', '#c98a1b', '#7a5ea8'];
    const ds = [{ label: 'General', data: res.elementos.map((e) => e.valor), borderColor: '#005090', backgroundColor: 'rgba(0,80,144,0.20)', pointBackgroundColor: '#005090', borderWidth: 2.5 }];
    ns.forEach((nn, i) => ds.push({ label: nn, data: res.elementos.map((e) => e.porNorma[nn] ?? null), borderColor: pal[i % 4], backgroundColor: 'transparent', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 2 }));
    const radar = chartPNG({
      type: 'radar', data: { labels: res.elementos.map((e) => e.codigo), datasets: ds },
      options: { plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Perfil de cumplimiento', font: { size: 15, weight: 'bold' }, color: '#005090' } }, scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, backdropColor: 'transparent' } } } },
    }, 460, 360);
    const gr = lr + 7; // fila (1-based) donde empiezan los gráficos
    const idB = wb.addImage({ base64: barras, extension: 'png' });
    const idR = wb.addImage({ base64: radar, extension: 'png' });
    ws.addImage(idB, { tl: { col: 1, row: gr - 1 }, ext: { width: 620, height: 360 } });
    ws.addImage(idR, { tl: { col: 1 + 5.6, row: gr - 1 }, ext: { width: 460, height: 360 } });
  }

  /* ───────────── 2. Subelementos ───────────── */
  const w2 = wb.addWorksheet('Subelementos', { views: [{ showGridLines: false, state: 'frozen', ySplit: 6 }] });
  [3, 9, 8, 52, 13, 15, ...ns.map(() => 13), ...ns.map(() => 11)].forEach((w, i) => { w2.getColumn(i + 1).width = w; });
  const u2 = 6 + ns.length * 2;
  encabezado(w2, 'Resultado por subelemento', Math.max(u2, 7), sub);
  titulos(w2.getRow(6), 2, ['Elemento', 'SE', 'Subelemento', '% total', 'Estado', ...ns.map((x) => '% ' + x), ...ns.map((x) => 'Puntos ' + x)]);
  res.subelementos.forEach((s, i) => {
    const row = w2.getRow(7 + i); row.height = 20;
    const e = row.getCell(2); e.value = s.codigo; e.font = { bold: true, color: { argb: AZUL } }; e.alignment = { horizontal: 'center', vertical: 'middle' }; e.border = borde();
    const se = row.getCell(3); se.value = s.se; se.alignment = { horizontal: 'center', vertical: 'middle' }; se.border = borde();
    const nm = row.getCell(4); nm.value = s.nombre; nm.alignment = { vertical: 'middle', wrapText: true, indent: 1 }; nm.border = borde();
    pctCell(row.getCell(5), s.valor); if (s.valor != null) row.getCell(5).font = { bold: true };
    estadoCell(row.getCell(6), s.estado);
    ns.forEach((x, k) => pctCell(row.getCell(7 + k), s.porNorma[x] ?? null));
    ns.forEach((x, k) => { const c = row.getCell(7 + ns.length + k); c.value = s.puntos[x] || '–'; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = borde(); c.font = { color: { argb: GRIS } }; });
  });
  const f2 = 6 + res.subelementos.length;
  w2.addConditionalFormatting({ ref: `E7:E${f2}`, rules: [{ ...escala, priority: 1 }] });
  if (ns.length) w2.addConditionalFormatting({ ref: `G7:${colLetter(6 + ns.length)}${f2}`, rules: [{ ...escala, priority: 2 }] });
  w2.autoFilter = { from: { row: 6, column: 2 }, to: { row: f2, column: 6 + ns.length * 2 } };
  if (r.total != null) {
    const evs = res.subelementos.filter((s) => s.valor != null);
    const alto = Math.max(300, evs.length * 24 + 70);
    const img = chartPNG({
      type: 'bar', etiquetas: true,
      data: { labels: evs.map((s) => (`SE ${s.se} · ${s.nombre}`.length > 46 ? `SE ${s.se} · ${s.nombre}`.slice(0, 45) + "…" : `SE ${s.se} · ${s.nombre}`)), datasets: [{ data: evs.map((s) => Math.round(s.valor * 10) / 10), backgroundColor: evs.map((s) => ESTADO_COLOR[s.estado]) }] },
      options: barOpts(true, '% de logro por subelemento'),
    }, 700, alto);
    w2.addImage(wb.addImage({ base64: img, extension: 'png' }), { tl: { col: 7 + ns.length * 2, row: 5 }, ext: { width: 700, height: alto } });
  }

  /* ───────────── 3. Detalle de puntos ───────────── */
  const w3 = wb.addWorksheet('Detalle de puntos', { views: [{ showGridLines: false, state: 'frozen', ySplit: 6 }] });
  [3, 8, 13, 11, 13, 20, 64].forEach((w, i) => { w3.getColumn(i + 1).width = w; });
  encabezado(w3, 'Detalle de los puntos del archivo', 7, sub);
  titulos(w3.getRow(6), 2, ['Fila', 'Norma', 'Punto', '% ingresado', 'Subelementos', 'Estado en el cálculo']);
  res.detalle.forEach((d, i) => {
    const row = w3.getRow(7 + i);
    const usado = /^Usado/.test(d.estado), reempl = /^Reemplazado/.test(d.estado), ignor = /^Sin porcentaje/.test(d.estado);
    const color = usado ? 'FF1A7F5A' : reempl ? 'FFC98A1B' : ignor ? GRIS : 'FFC0392B';
    [d.fila, d.norma, d.punto, d.valor == null ? '–' : Math.round(d.valor * 100) / 100, d.subelementos || '–', d.estado].forEach((v, k) => {
      const c = row.getCell(2 + k); c.value = v; c.border = borde(); c.alignment = { horizontal: k === 5 ? 'left' : 'center', vertical: 'middle' };
      if (k === 3 && typeof v === 'number') c.numFmt = FMT;
      if (k === 5) c.font = { color: { argb: color }, bold: !usado };
      if (i % 2) c.fill = fill(CLARO);
    });
    w3.getCell(7 + i, 4).numFmt = '@'; // el punto es texto
  });
  w3.autoFilter = { from: { row: 6, column: 2 }, to: { row: 6 + res.detalle.length, column: 7 } };

  /* ───────────── 4. Metodología ───────────── */
  const w4 = wb.addWorksheet('Metodología', { views: [{ showGridLines: false }] });
  w4.getColumn(1).width = 3; w4.getColumn(2).width = 120;
  encabezado(w4, 'Cómo se calculó', 2, sub);
  const lineas = [
    ['Matriz', 'Cada punto de las normas se asigna a uno o más subelementos según la hoja «Comparativa SGEO FINAL».'],
    ['Subelemento', 'Promedio simple de los porcentajes de los puntos que le aplican, por norma; el % total del subelemento es el promedio entre las normas con datos.'],
    ['Elemento', 'Promedio de sus subelementos que tienen datos. Los subelementos sin datos no cuentan (no se toman como 0 %).'],
    ['Puntos sin porcentaje', 'Se consideran no auditados y se ignoran.'],
    ['Niveles de detalle', 'Si se cargan puntos de detalle (por ejemplo 10.2.1 y 10.2.2), se usan esos y se descarta el punto padre (10.2).'],
    ['Punto en varios subelementos', 'Su porcentaje se asigna por separado a cada subelemento (por ejemplo el 10.2 en los subelementos 23 y 24).'],
    ['Total de auditoría', `Promedio de los elementos evaluados ponderado por su peso (${Object.entries(PESOS).map(([k, v]) => `${k} = ${v}`).join(', ')}).`],
    ['Estados', ESTADOS.map((e, i) => `${e.estado} ${i === 0 ? '≥ 91%' : i === 4 ? '< 41%' : '≥ ' + e.min + '%'}`).join('  ·  ')],
  ];
  lineas.forEach(([k, v], i) => {
    const row = w4.getRow(6 + i); row.height = 34;
    const c = row.getCell(2); c.value = { richText: [{ text: k + ': ', font: { bold: true, color: { argb: AZUL } } }, { text: v }] };
    c.alignment = { wrapText: true, vertical: 'middle', indent: 1 }; c.border = borde(); if (i % 2) c.fill = fill(CLARO);
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function descargarExcel(res) {
  const base = String(res.meta.archivo || 'auditoria').replace(/\.[^.]+$/, '');
  saveBlob(await generarExcel(res), `${base}_por_elemento.xlsx`);
}
