/** Lee el Excel de entrada de una auditoría (Norma · Punto · Porcentaje) con SheetJS. */
const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const COLS = {
  norma: ['norma', 'estandar', 'iso', 'referencia'],
  punto: ['punto', 'item', 'requisito', 'clausula', 'apartado', 'numeral', 'puntodelanorma'],
  valor: ['porcentaje', 'cumplimiento', 'puntaje', 'resultado', 'logro', 'valor', 'puntuacion', 'nota'],
};

function findCols(header) {
  const idx = {};
  const h = header.map(norm);
  for (const k of Object.keys(COLS)) {
    let i = h.findIndex((x) => COLS[k].includes(x));
    if (i < 0) i = h.findIndex((x) => x && COLS[k].some((c) => x.includes(c)));
    if (i >= 0) idx[k] = i;
  }
  return idx;
}

// Texto tal como se ve en Excel; un punto que Excel convirtió en fecha (10.2 → 10-feb) se restaura como d.m
function cellText(c) {
  if (!c) return '';
  if (c.t === 'd' && c.v instanceof Date) return c.v.getDate() + '.' + (c.v.getMonth() + 1);
  if (c.t === 'n' && c.w) return String(c.w).trim();
  return String(c.v == null ? '' : c.v).trim();
}

function parseValor(c) {
  if (!c || c.v === '' || c.v == null) return null;
  if (c.t === 'n') return { n: c.v, pct: /%/.test(c.w || c.z || '') };
  const s = String(c.v).trim();
  if (!s || s === '-') return null;
  const m = s.replace('%', '').replace(',', '.').match(/^-?\d+(\.\d+)?$/);
  if (!m) return { n: NaN, pct: false };
  return { n: parseFloat(m[0]), pct: s.includes('%') };
}

/** @returns {{filas:{norma,punto,valor,fila}[], notas:string[]}} */
export function leerAuditoria(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const filas = [], notas = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws['!ref']) continue;
    const r = XLSX.utils.decode_range(ws['!ref']);
    let hdr = -1, cols = null;
    for (let i = r.s.r; i <= Math.min(r.e.r, r.s.r + 14); i++) {
      const h = [];
      for (let c = r.s.c; c <= r.e.c; c++) h.push(cellText(ws[XLSX.utils.encode_cell({ r: i, c })]));
      const f = findCols(h);
      if (f.norma != null && f.punto != null && f.valor != null) { hdr = i; cols = f; break; }
    }
    if (hdr < 0) { notas.push(`Hoja "${name}": no se encontraron las columnas Norma, Punto y Porcentaje; se omitió.`); continue; }
    for (let i = hdr + 1; i <= r.e.r; i++) {
      const g = (k) => ws[XLSX.utils.encode_cell({ r: i, c: r.s.c + cols[k] })];
      const norma = cellText(g('norma')), punto = cellText(g('punto'));
      const v = parseValor(g('valor'));
      if (!norma && !punto && !v) continue;
      filas.push({ norma, punto, raw: v, fila: i + 1 });
    }
  }
  const nums = filas.filter((f) => f.raw && !Number.isNaN(f.raw.n)).map((f) => f.raw.n);
  const fraccion = nums.length > 0 && nums.every((n) => n <= 1) && nums.some((n) => n > 0 && n < 1);
  if (fraccion) notas.push('Los porcentajes vienen entre 0 y 1; se interpretaron como 0 %–100 %.');
  for (const f of filas) {
    if (!f.raw) f.valor = null;
    else if (Number.isNaN(f.raw.n)) f.valor = NaN;
    else f.valor = (f.raw.pct || fraccion) && f.raw.n <= 1 ? f.raw.n * 100 : f.raw.n;
    delete f.raw;
  }
  return { filas, notas };
}

/** Plantilla de entrada descargable (los puntos van como texto para que Excel no los convierta en fechas). */
export function plantillaBlob() {
  const rows = [['Norma', 'Punto', 'Porcentaje'], ['ISO 9001', '4.3', 100], ['ISO 9001', '5.2', 30], ['ISO 9001', '10.2.1', 50], ['ISO 9001', '10.2.2', 70], ['ISO 14001', '10.2', 20], ['ISO 45001', '5.1', '']];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 12 }];
  for (let i = 1; i < rows.length; i++) { const c = ws['B' + (i + 1)]; c.t = 's'; c.z = '@'; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');
  return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
}
