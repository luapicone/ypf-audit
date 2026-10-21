(function () {
  const $ = id => document.getElementById(id);
  const { calcular, round, NORMAS } = Calc;
  let result = null, fileName = 'auditoria';

  const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const COLS = {
    norma: ['norma', 'estandar', 'iso', 'referencia'],
    punto: ['punto', 'item', 'requisito', 'clausula', 'apartado', 'numeral', 'puntodelanorma'],
    valor: ['porcentaje', 'cumplimiento', 'puntaje', 'resultado', 'logro', 'valor', 'puntuacion', 'nota']
  };

  function setStatus(t, cls) { const s = $('status'); s.textContent = t || ''; s.className = 'msg ' + (cls || ''); }

  function findCols(header) {
    const idx = {};
    const h = header.map(norm);
    for (const k of Object.keys(COLS)) {
      let i = h.findIndex(x => COLS[k].includes(x));
      if (i < 0) i = h.findIndex(x => x && COLS[k].some(c => x.includes(c)));
      if (i >= 0) idx[k] = i;
    }
    return idx;
  }

  function cellText(c) { // texto tal como se ve en Excel; fechas mal interpretadas se restauran como d.m
    if (!c) return '';
    if (c.t === 'd' && c.v instanceof Date) return c.v.getDate() + '.' + (c.v.getMonth() + 1);
    if (c.t === 'n' && c.w) return String(c.w).trim();
    return String(c.v == null ? '' : c.v).trim();
  }

  function parseValor(c) { // devuelve {n, pct} ; n numérico crudo
    if (!c || c.v === '' || c.v == null) return null;
    if (c.t === 'n') return { n: c.v, pct: /%/.test(c.w || c.z || '') };
    const s = String(c.v).trim();
    if (!s || s === '-' ) return null;
    const m = s.replace('%', '').replace(',', '.').match(/^-?\d+(\.\d+)?$/);
    if (!m) return { n: NaN, pct: false };
    return { n: parseFloat(m[0]), pct: s.includes('%') };
  }

  function leer(wb) {
    const filas = [], notas = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws['!ref']) continue;
      const r = XLSX.utils.decode_range(ws['!ref']);
      // buscar encabezado en las primeras 15 filas
      let hdr = -1, cols = null;
      for (let i = r.s.r; i <= Math.min(r.e.r, r.s.r + 14); i++) {
        const h = []; for (let c = r.s.c; c <= r.e.c; c++) h.push(cellText(ws[XLSX.utils.encode_cell({ r: i, c })]));
        const f = findCols(h);
        if (f.norma != null && f.punto != null && f.valor != null) { hdr = i; cols = f; break; }
      }
      if (hdr < 0) { notas.push(`Hoja "${name}": no se encontraron las columnas Norma, Punto y Porcentaje; se omitió.`); continue; }
      for (let i = hdr + 1; i <= r.e.r; i++) {
        const g = k => ws[XLSX.utils.encode_cell({ r: i, c: r.s.c + cols[k] })];
        const norma = cellText(g('norma')), punto = cellText(g('punto'));
        const v = parseValor(g('valor'));
        if (!norma && !punto && !v) continue;
        filas.push({ norma, punto, raw: v, fila: i + 1, hoja: name });
      }
    }
    // escala: si hay % explícito o todos los valores ≤ 1, se interpreta como fracción
    const nums = filas.filter(f => f.raw && !Number.isNaN(f.raw.n)).map(f => f.raw.n);
    const todosFraccion = nums.length > 0 && nums.every(n => n <= 1) && nums.some(n => n > 0 && n < 1);
    if (todosFraccion) notas.push('Los porcentajes vienen entre 0 y 1; se interpretaron como 0 %–100 %.');
    for (const f of filas) {
      if (!f.raw) f.valor = null;
      else if (Number.isNaN(f.raw.n)) f.valor = NaN;
      else f.valor = (f.raw.pct || todosFraccion) && f.raw.n <= 1 ? f.raw.n * 100 : f.raw.n;
    }
    return { filas, notas };
  }

  const fmt = v => v == null ? '–' : round(v, 1).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render(view) {
    const r = result; let h = '';
    if (view === 'el') {
      h = '<table><thead><tr><th>Elemento</th><th>Avance</th><th class="n">% logro</th><th class="n">Subelementos evaluados</th></tr></thead><tbody>' +
        r.elementos.map(e => `<tr><td>${esc(e.elemento)}</td><td><div class="bar"><i style="width:${e.valor == null ? 0 : e.valor}%"></i></div></td><td class="n"><strong>${fmt(e.valor)}</strong></td><td class="n">${e.seEvaluados} de ${e.seTotal}</td></tr>`).join('') + '</tbody></table>';
    } else if (view === 'se') {
      const ns = NORMAS.filter(n => r.subelementos.some(s => s.porNorma[n] != null));
      h = '<table><thead><tr><th>SE</th><th>Subelemento</th><th class="n">% total</th>' + ns.map(n => `<th class="n">${n}</th>`).join('') + '</tr></thead><tbody>' +
        r.subelementos.map(s => `<tr><td>${s.se}</td><td>${esc(s.nombre)}<div class="muted" style="font-size:12px">${esc(s.elemento.split(':')[0])}</div></td><td class="n"><strong>${fmt(s.valor)}</strong></td>${ns.map(n => `<td class="n">${fmt(s.porNorma[n])}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
    } else {
      h = '<table><thead><tr><th>Fila</th><th>Norma</th><th>Punto</th><th class="n">%</th><th>Subelementos</th><th>Estado</th></tr></thead><tbody>' +
        r.detalle.map(d => { const bad = !/^Usado/.test(d.estado); return `<tr><td>${d.fila}</td><td>${esc(d.norma || d.normaOriginal)}</td><td>${esc(d.punto)}</td><td class="n">${d.valor == null || Number.isNaN(d.valor) ? '–' : round(d.valor, 1)}</td><td>${esc(d.subelementos)}</td><td class="${bad ? 'muted' : ''}">${esc(d.estado)}</td></tr>`; }).join('') + '</tbody></table>';
    }
    $('view').innerHTML = h;
  }

  function procesar(buf, name) {
    try {
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const { filas, notas } = leer(wb);
      if (!filas.length) { setStatus(notas.join(' ') || 'No se encontraron datos en el archivo.', 'bad'); $('out').classList.add('hidden'); return; }
      result = calcular(filas, MAPPING);
      const usados = result.detalle.filter(d => /^Usado/.test(d.estado)).length;
      const problemas = result.detalle.filter(d => /no está|no reconocida|fuera de/.test(d.estado)).length;
      let t = `${filas.length} filas leídas, ${usados} usadas en el cálculo.`;
      if (problemas) t += ` ${problemas} con problemas (ver "Detalle de filas").`;
      if (notas.length) t += ' ' + notas.join(' ');
      setStatus(t, problemas ? 'warn' : 'ok');
      fileName = name.replace(/\.[^.]+$/, '');
      $('out').classList.remove('hidden');
      document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'el'));
      render('el');
    } catch (e) { console.error(e); setStatus('No se pudo leer el archivo: ' + e.message, 'bad'); }
  }

  function descargar() {
    const wb = XLSX.utils.book_new();
    const ns = NORMAS.filter(n => result.subelementos.some(s => s.porNorma[n] != null));
    const num = v => v == null ? '' : round(v, 2);
    const a = [['Elemento', '% logro', 'Subelementos evaluados', 'Subelementos totales', ...ns.map(n => '% ' + n)]];
    for (const e of result.elementos) a.push([e.elemento, num(e.valor), e.seEvaluados, e.seTotal, ...ns.map(n => num(e.porNorma[n]))]);
    const b = [['Elemento', 'SE', 'Subelemento', '% total', ...ns.map(n => '% ' + n), ...ns.map(n => 'Puntos ' + n)]];
    for (const s of result.subelementos) b.push([s.elemento, s.se, s.nombre, num(s.valor), ...ns.map(n => num(s.porNorma[n])), ...ns.map(n => s.puntos[n] || '')]);
    const c = [['Fila', 'Norma', 'Punto', '% ingresado', 'Subelementos', 'Estado']];
    for (const d of result.detalle) c.push([d.fila, d.norma || d.normaOriginal, d.punto, d.valor == null || Number.isNaN(d.valor) ? '' : round(d.valor, 2), d.subelementos, d.estado]);
    [['Por elemento', a, [44, 10, 12, 12]], ['Por subelemento', b, [44, 5, 50, 10]], ['Detalle', c, [6, 12, 10, 12, 16, 60]]].forEach(([n, d, w]) => {
      const ws = XLSX.utils.aoa_to_sheet(d); ws['!cols'] = w.map(x => ({ wch: x })); XLSX.utils.book_append_sheet(wb, ws, n);
    });
    XLSX.writeFile(wb, fileName + '_por_elemento.xlsx');
  }

  function plantilla() {
    const rows = [['Norma', 'Punto', 'Porcentaje'], ['ISO 9001', '4.3', 100], ['ISO 9001', '5.2', 30], ['ISO 9001', '10.2.1', 50], ['ISO 9001', '10.2.2', 70], ['ISO 14001', '10.2', 20], ['ISO 45001', '5.1', '']];
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 12 }];
    // el punto va como texto para que Excel no lo convierta en fecha
    for (let i = 1; i < rows.length; i++) { const c = ws['B' + (i + 1)]; c.t = 's'; c.z = '@'; }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');
    XLSX.writeFile(wb, 'plantilla_auditoria.xlsx');
  }

  function cargar(file) {
    if (!file) return;
    $('fname').textContent = file.name;
    const fr = new FileReader();
    fr.onload = () => procesar(new Uint8Array(fr.result), file.name);
    fr.readAsArrayBuffer(file);
  }

  const drop = $('drop');
  drop.addEventListener('click', () => $('file').click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => cargar(e.dataTransfer.files[0]));
  $('file').addEventListener('change', e => cargar(e.target.files[0]));
  $('dl').addEventListener('click', descargar);
  $('tpl').addEventListener('click', plantilla);
  $('tabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#tabs button').forEach(x => x.setAttribute('aria-pressed', x === b));
    render(b.dataset.v);
  });

  if (typeof window !== 'undefined') window.__app = { leer, procesar };
})();
