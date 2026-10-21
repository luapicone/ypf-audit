// Motor de cálculo: puntos de auditoría -> % por subelemento -> % por elemento
(function (root) {
  const NORMAS = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'CCPS', 'ISO 39001', 'ISO 50001'];

  function normNorma(s) {
    const t = String(s == null ? '' : s).toUpperCase();
    for (const n of ['14001', '45001', '9001', '39001', '50001']) if (t.includes(n)) return 'ISO ' + n;
    if (t.includes('CCPS')) return 'CCPS';
    return null;
  }

  function normPunto(s) {
    return String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/[.,;]+$/, '').replace(/,/g, '.');
  }

  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

  function buildIndex(mapping) {
    const idx = new Map();
    for (const [se, norma, punto] of mapping.pares) {
      const k = norma + '|' + punto;
      if (!idx.has(k)) idx.set(k, new Set());
      idx.get(k).add(se);
    }
    return idx;
  }

  // filas: [{norma, punto, valor (0-100|null), fila}]
  function calcular(filas, mapping) {
    const idx = buildIndex(mapping);
    const detalle = [];
    const grupos = new Map(); // norma|se -> Map(punto -> [valores])

    for (const f of filas) {
      const norma = normNorma(f.norma);
      const punto = normPunto(f.punto);
      const d = { fila: f.fila, normaOriginal: f.norma, norma, punto, valor: f.valor, subelementos: '', estado: '' };
      detalle.push(d);
      if (!norma) { d.estado = 'Norma no reconocida'; continue; }
      if (!punto) { d.estado = 'Punto vacío'; continue; }
      if (f.valor == null || Number.isNaN(f.valor)) { d.estado = 'Sin porcentaje (no auditado, se ignora)'; continue; }
      if (f.valor < 0 || f.valor > 100) { d.estado = 'Porcentaje fuera de 0-100'; continue; }

      let ses = idx.get(norma + '|' + punto), via = punto;
      if (!ses) { // buscar el punto padre (5.2.1 -> 5.2)
        let p = punto;
        while (!ses && p.includes('.')) { p = p.slice(0, p.lastIndexOf('.')); ses = idx.get(norma + '|' + p); }
        if (ses) via = p;
      }
      if (!ses) { d.estado = 'Punto no está en la matriz'; continue; }
      d.subelementos = [...ses].sort((a, b) => a - b).join(', ');
      d.estado = via === punto ? 'Usado' : `Usado (asignado al punto ${via})`;
      d.via = via;
      for (const se of ses) {
        const k = norma + '|' + se;
        if (!grupos.has(k)) grupos.set(k, new Map());
        const m = grupos.get(k);
        if (!m.has(via)) m.set(via, []);
        m.get(via).push({ valor: f.valor, d });
      }
    }

    // Jerarquía: si hay puntos de detalle (10.2.1) se descarta el padre (10.2)
    const seNorma = new Map(); // se -> {norma: valor}
    const nPuntos = new Map(); // se|norma -> n
    for (const [k, m] of grupos) {
      const [norma, se] = k.split('|');
      const puntos = [...m.keys()];
      const usados = [];
      for (const p of puntos) {
        const tieneHijo = puntos.some(q => q !== p && q.startsWith(p + '.'));
        if (tieneHijo) {
          for (const x of m.get(p)) if (x.d.estado.startsWith('Usado') && !x.d.estado.includes('reemplazado'))
            x.d.estado = 'Reemplazado por detalle (' + puntos.filter(q => q.startsWith(p + '.')).join(', ') + ')';
        } else usados.push(p);
      }
      if (!usados.length) continue;
      // un punto repetido en varias filas se promedia primero
      const vals = usados.map(p => mean(m.get(p).map(x => x.valor)));
      const v = mean(vals);
      if (!seNorma.has(+se)) seNorma.set(+se, {});
      seNorma.get(+se)[norma] = v;
      nPuntos.set(se + '|' + norma, usados.length);
    }

    // Estados de detalle: un punto que se reemplazó en un SE pero se usó en otro -> se deja el estado "Usado"
    for (const d of detalle) if (d.estado.startsWith('Reemplazado') && d.via) {
      // revisar si el punto aportó a algún SE
      const usado = [...grupos].some(([k, m]) => {
        const [n, se] = k.split('|');
        if (n !== d.norma || !m.has(d.via)) return false;
        return !([...m.keys()].some(q => q !== d.via && q.startsWith(d.via + '.')));
      });
      if (usado) d.estado = 'Usado' + (d.via !== d.punto ? ` (asignado al punto ${d.via})` : '') + ' (en otros SE reemplazado por detalle)';
    }

    const subelementos = mapping.subelementos.map(s => {
      const porNorma = seNorma.get(s.se) || {};
      const vals = Object.values(porNorma);
      return {
        ...s, porNorma,
        puntos: Object.fromEntries(NORMAS.map(n => [n, nPuntos.get(s.se + '|' + n) || 0])),
        valor: vals.length ? mean(vals) : null
      };
    });

    const elementos = [];
    for (const s of subelementos) {
      let e = elementos.find(x => x.elemento === s.elemento);
      if (!e) elementos.push(e = { elemento: s.elemento, subs: [] });
      e.subs.push(s);
    }
    for (const e of elementos) {
      const v = e.subs.filter(s => s.valor != null).map(s => s.valor);
      e.valor = v.length ? mean(v) : null;
      e.seEvaluados = v.length; e.seTotal = e.subs.length;
      e.porNorma = {};
      for (const n of NORMAS) {
        const w = e.subs.map(s => s.porNorma[n]).filter(x => x != null);
        if (w.length) e.porNorma[n] = mean(w);
      }
    }
    return { elementos, subelementos, detalle };
  }

  const api = { calcular, normNorma, normPunto, round, NORMAS };
  if (typeof module !== 'undefined') module.exports = api; else root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
