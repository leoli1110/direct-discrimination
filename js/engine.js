// Curve engine: turns a database entry + user settings into time-current bands.
// All currents are amperes at the device's own voltage; scaling to the study base
// voltage is applied by the caller through `kScale`.

export const INF = Infinity;

export function thermalCurve(c, x) {
  if (!c) return INF;
  const r = Math.pow(x / c.x0, c.a) - 1;
  return r <= 0 ? INF : c.K / r;
}

const num = (v, d = 0) => (v === undefined || v === null || Number.isNaN(+v) ? d : +v);
const pick = (obj, key) => (obj ? obj[key] ?? obj[String(key)] : undefined);
const round = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;
const nearest = (list, v) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), list[0]);

// ---------------------------------------------------------------- controls
// Each control: {key, label, kind:'select'|'range'|'fixed'|'toggle'|'number', values?, min?, max?, step?, unit?, value?}
export function ratingsFor(dev, st) {
  if (dev.model === 'mcb' && dev.ratingsByCurve && st.curve && dev.ratingsByCurve[st.curve]) return dev.ratingsByCurve[st.curve];
  return dev.ratings || [];
}

function tmIiSpec(dev, In) {
  const ii = dev.ii || {};
  const k = String(In);
  if (ii.stepsXIn && pick(ii.stepsXIn, k)) return { kind: 'select', values: pick(ii.stepsXIn, k).map((m) => m * In), fmt: (a) => `${round(a / In, 2)}×In  (${Math.round(a)} A)` };
  if (ii.stepsA && pick(ii.stepsA, k)) return { kind: 'select', values: pick(ii.stepsA, k), fmt: (a) => `${a} A  (${round(a / In, 2)}×In)` };
  if (ii.adjXIn && pick(ii.adjXIn, k)) { const [a, b] = pick(ii.adjXIn, k); return { kind: 'range', min: a * In, max: b * In, step: In * 0.5 }; }
  if (ii.rangeA && pick(ii.rangeA, k)) { const [a, b] = pick(ii.rangeA, k); return { kind: 'range', min: a, max: b, step: Math.max(1, Math.round((b - a) / 20)) }; }
  if (ii.fixedA && pick(ii.fixedA, k)) return { kind: 'fixed', value: pick(ii.fixedA, k) };
  if (ii.adjXInAll) { const [a, b] = ii.adjXInAll; return { kind: 'range', min: a * In, max: b * In, step: In * 0.5 }; }
  if (ii.xIn) return { kind: 'fixed', value: ii.xIn * In };
  return { kind: 'fixed', value: 10 * In };
}

function etuIrSpec(dev, In) {
  const ir = dev.L.ir;
  if (ir.io) {
    const io = pick(ir.io, In) || pick(ir.io, Object.keys(ir.io).pop());
    return { io: [...new Set(io)], fine: ir.fine || null, fineA: ir.fineA || null };
  }
  if (ir.steps) return { kind: 'select', values: ir.steps.map((m) => m * In), fmt: (a) => `${round(a / In, 3)}×In  (${round(a, 1)} A)` };
  const step = ir.step ? ir.step * In : In / 100;
  return { kind: 'range', min: ir.min * In, max: ir.max * In, step };
}

function etuIiSpec(dev, In) {
  const I = dev.I || {};
  const k = String(In);
  if (I.fixedA && pick(I.fixedA, k)) return { kind: 'fixed', value: pick(I.fixedA, k) };
  if (I.fixedXIn && pick(I.fixedXIn, k)) return { kind: 'fixed', value: pick(I.fixedXIn, k) * In };
  if (I.fixedAByFrame) return { kind: 'fixed', value: In <= 630 ? I.fixedAByFrame['630'] : I.fixedAByFrame['1600'] };
  if (I.xInSteps) return { kind: 'select', values: I.xInSteps.map((m) => m * In), fmt: (a) => `${round(a / In, 2)}×In  (${Math.round(a)} A)` };
  if (I.xInMax && pick(I.xInMax, k)) return { kind: 'range', min: (I.xInMin || 1.5) * In, max: pick(I.xInMax, k) * In, step: (I.step || 0.5) * In };
  if (I.xInRange && pick(I.xInRange, k)) { const [a, b] = pick(I.xInRange, k); return { kind: 'range', min: a * In, max: b * In, step: 0.5 * In }; }
  if (I.xInMaxAll) return { kind: 'range', min: (I.xInMin || 1.5) * In, max: I.xInMaxAll * In, step: 0.5 * In };
  return null;
}

function valuesSpec(spec, unit) {
  if (!spec) return null;
  if (spec.fixed !== undefined) return { kind: 'fixed', value: spec.fixed, unit };
  if (spec.steps) return { kind: 'select', values: spec.steps, unit };
  return { kind: 'range', min: spec.min, max: spec.max, step: spec.step || (spec.max - spec.min) / 100, unit };
}

export function defaultSettings(dev) {
  const st = { deviceId: dev.id, kV: 0.4, visible: true, label: '' };
  if (dev.model === 'mcb') {
    st.curve = Object.keys(dev.curves).includes('C') ? 'C' : Object.keys(dev.curves)[0];
    const r = ratingsFor(dev, st); st.In = r.includes(32) ? 32 : r[Math.floor(r.length / 2)];
  } else if (dev.model === 'tm' || dev.model === 'etu') {
    const r = dev.ratings; st.In = r.includes(160) ? 160 : r[Math.floor(r.length / 2)];
  } else if (dev.model === 'idmt') {
    st.curve = Object.keys(dev.curves)[0]; st.ctPri = 400; st.ctSec = 1; st.kV = 11;
    const plug = dev.plug && !('continuous' in dev.plug) ? Object.values(dev.plug)[0] : null;
    st.plugRange = dev.plug && !('continuous' in dev.plug) ? Object.keys(dev.plug)[0] : null;
    st.plug = plug ? 100 : 100; st.tms = dev.tms.label === 'TD' ? 2 : 0.3;
    st.hs = !!(dev.highset && dev.highset.enabled); st.hsX = dev.highset ? dev.highset.default : 10; st.hsT = dev.highset ? dev.highset.time : 0.05;
  }
  normalize(dev, st);
  return st;
}

// Keep settings inside the device's legal values whenever rating/curve changes.
export function normalize(dev, st) {
  const clampR = (v, s) => Math.min(s.max, Math.max(s.min, num(v, s.max)));
  if (dev.model === 'mcb') {
    if (!dev.curves[st.curve]) st.curve = Object.keys(dev.curves)[0];
    const r = ratingsFor(dev, st); if (!r.includes(+st.In)) st.In = nearest(r, +st.In || r[0]);
  }
  if (dev.model === 'tm') {
    if (!dev.ratings.includes(+st.In)) st.In = nearest(dev.ratings, +st.In);
    const ir = dev.ir;
    if (ir.steps) st.irX = ir.steps.includes(+st.irX) ? +st.irX : ir.max; else st.irX = clampR(st.irX ?? ir.max, ir);
    const s = tmIiSpec(dev, st.In);
    if (s.kind === 'fixed') st.Ii = s.value; else if (s.kind === 'select') st.Ii = s.values.includes(+st.Ii) ? +st.Ii : s.values[s.values.length - 1]; else st.Ii = clampR(st.Ii, s);
  }
  if (dev.model === 'etu') {
    if (!dev.ratings.includes(+st.In)) st.In = nearest(dev.ratings, +st.In);
    const In = st.In, irs = etuIrSpec(dev, In);
    if (irs.io) {
      if (!irs.io.includes(+st.io)) st.io = irs.io[irs.io.length - 1];
      if (irs.fine) st.fine = Math.min(irs.fine[1], Math.max(irs.fine[0], num(st.fine, 1)));
      if (irs.fineA) { const lo = Math.min(...irs.io); st.Ir = Math.min(st.io, Math.max(lo, Math.round(num(st.Ir, st.io)))); }
      st.Ir = irs.fine ? round(st.io * st.fine, 2) : irs.fineA ? st.Ir : st.io;
    } else if (irs.kind === 'select') st.Ir = irs.values.some((v) => Math.abs(v - st.Ir) < 1e-6) ? +st.Ir : irs.values[irs.values.length - 1];
    else st.Ir = clampR(st.Ir, irs);
    const tr = valuesSpec(dev.L.tr);
    if (tr.kind === 'fixed') st.tr = tr.value; else if (tr.kind === 'select') st.tr = tr.values.includes(+st.tr) ? +st.tr : tr.values[Math.min(1, tr.values.length - 1)]; else st.tr = clampR(st.tr ?? Math.min(tr.max, 6), tr);
    if (dev.S) {
      const S = dev.S, isd = S.isd;
      if (isd.xIr || isd.steps) { const v = isd.xIr || isd.steps; st.isd = v.includes(+st.isd) ? +st.isd : v[Math.floor(v.length / 2)]; }
      else st.isd = clampR(st.isd ?? Math.min(isd.max, 6), isd);
      const tsd = valuesSpec(S.tsd);
      if (tsd.kind === 'fixed') st.tsd = tsd.value; else if (tsd.kind === 'select') st.tsd = tsd.values.includes(+st.tsd) ? +st.tsd : tsd.values[Math.min(1, tsd.values.length - 1)]; else st.tsd = clampR(st.tsd ?? tsd.min, tsd);
      st.i2t = S.i2t ? !!st.i2t : false;
    }
    const iis = etuIiSpec(dev, In);
    if (iis) { if (iis.kind === 'fixed') st.Ii = iis.value; else if (iis.kind === 'select') st.Ii = iis.values.includes(+st.Ii) ? +st.Ii : iis.values[iis.values.length - 1]; else st.Ii = clampR(st.Ii, iis); }
    else st.Ii = null;
  }
  if (dev.model === 'idmt') {
    if (!dev.curves[st.curve]) st.curve = Object.keys(dev.curves)[0];
    if (dev.plug && !('continuous' in dev.plug)) {
      if (!dev.plug[st.plugRange]) st.plugRange = Object.keys(dev.plug)[0];
      const p = dev.plug[st.plugRange]; if (!p.includes(+st.plug)) st.plug = nearest(p, +st.plug);
    } else st.plug = Math.min(2000, Math.max(5, num(st.plug, 100)));
    st.tms = Math.min(dev.tms.max, Math.max(dev.tms.min, num(st.tms, dev.tms.min)));
    st.ctPri = Math.max(1, num(st.ctPri, 400)); if (!dev.ctSec.includes(+st.ctSec)) st.ctSec = dev.ctSec[0];
  }
  st.kV = Math.max(0.01, num(st.kV, 0.4));
  return st;
}

export function controlsFor(dev, st) {
  const c = [];
  const fmtA = (a) => `${round(a, 1)} A`;
  if (dev.model === 'mcb') {
    c.push({ key: 'curve', label: 'Curve', kind: 'select', values: Object.keys(dev.curves), fmt: (v) => `${v}  (${dev.curves[v].lo}–${dev.curves[v].hi}×In)` });
    c.push({ key: 'In', label: 'Rating In', kind: 'select', values: ratingsFor(dev, st), fmt: (v) => `${v} A` });
  } else if (dev.model === 'tm') {
    c.push({ key: 'In', label: 'Rating In', kind: 'select', values: dev.ratings, fmt: (v) => `${v} A` });
    const ir = dev.ir;
    if (ir.steps) c.push({ key: 'irX', label: 'Ir', kind: 'select', values: ir.steps, fmt: (v) => `${v}×In  (${round(v * st.In, 1)} A)` });
    else c.push({ key: 'irX', label: 'Ir (×In)', kind: 'range', min: ir.min, max: ir.max, step: 0.01, fmt: (v) => `${round(v, 2)}×In = ${round(v * st.In, 1)} A` });
    const s = tmIiSpec(dev, st.In);
    c.push({ key: 'Ii', label: 'Ii (magnetic)', ...s, fmt: s.fmt || ((a) => `${Math.round(a)} A  (${round(a / st.In, 2)}×In)`) });
  } else if (dev.model === 'etu') {
    const In = st.In;
    c.push({ key: 'In', label: 'Rating In', kind: 'select', values: dev.ratings, fmt: (v) => `${v} A` });
    const irs = etuIrSpec(dev, In);
    if (irs.io) {
      c.push({ key: 'io', label: 'Io (dial)', kind: 'select', values: irs.io, fmt: fmtA });
      if (irs.fine) c.push({ key: 'fine', label: 'Ir = Io ×', kind: 'range', min: irs.fine[0], max: irs.fine[1], step: 0.01, fmt: (v) => `${round(v, 2)} → Ir ${round(st.io * v, 1)} A` });
      if (irs.fineA) c.push({ key: 'Ir', label: 'Ir (keypad)', kind: 'range', min: Math.min(...irs.io), max: st.io, step: 1, fmt: fmtA });
    } else c.push({ key: 'Ir', label: 'Ir', ...irs, fmt: irs.fmt || ((a) => `${round(a, 1)} A  (${round(a / In, 2)}×In)`) });
    const tr = valuesSpec(dev.L.tr, 's');
    c.push({ key: 'tr', label: `tr @${dev.L.ref}×Ir`, ...tr, fmt: (v) => `${round(v, 2)} s` });
    if (dev.S) {
      const isd = dev.S.isd, unit = isd.unit || 'xIr';
      const base = unit === 'xIn' ? In : st.Ir;
      if (isd.xIr || isd.steps) c.push({ key: 'isd', label: `Isd (${unit === 'xIn' ? '×In' : '×Ir'})`, kind: 'select', values: isd.xIr || isd.steps, fmt: (v) => `${v}  (${Math.round(v * base)} A)` });
      else c.push({ key: 'isd', label: `Isd (${unit === 'xIn' ? '×In' : '×Ir'})`, kind: 'range', min: isd.min, max: isd.max, step: isd.step || 0.1, fmt: (v) => `${round(v, 2)} = ${Math.round(v * base)} A` });
      const tsd = valuesSpec(dev.S.tsd, 's');
      c.push({ key: 'tsd', label: 'tsd', ...tsd, fmt: (v) => `${round(v, 3)} s` });
      if (dev.S.i2t) c.push({ key: 'i2t', label: 'I²t ON (S)', kind: 'toggle' });
    }
    const iis = etuIiSpec(dev, In);
    if (iis) c.push({ key: 'Ii', label: 'Ii (instantaneous)', ...iis, fmt: iis.fmt || ((a) => `${Math.round(a)} A  (${round(a / In, 2)}×In)`) });
  } else if (dev.model === 'idmt') {
    c.push({ key: 'curve', label: 'Characteristic', kind: 'select', values: Object.keys(dev.curves) });
    c.push({ key: 'ctPri', label: 'CT primary', kind: 'number', min: 1, step: 1, unit: 'A' });
    c.push({ key: 'ctSec', label: 'CT secondary', kind: 'select', values: dev.ctSec, fmt: (v) => `${v} A` });
    if (dev.plug && !('continuous' in dev.plug)) {
      c.push({ key: 'plugRange', label: 'Setting range', kind: 'select', values: Object.keys(dev.plug) });
      c.push({ key: 'plug', label: 'Plug setting', kind: 'select', values: dev.plug[st.plugRange], fmt: (v) => `${v} %  (Is ${round(v / 100 * st.ctPri, 1)} A pri)` });
    } else c.push({ key: 'plug', label: 'Is (% of CT)', kind: 'number', min: 5, max: 2000, step: 1, unit: '%' });
    const tl = dev.tms.label || 'TMS';
    c.push({ key: 'tms', label: tl, kind: 'range', min: dev.tms.min, max: dev.tms.max, step: dev.tms.step, fmt: (v) => round(v, 3) });
    if (dev.highset) {
      c.push({ key: 'hs', label: 'High-set (instantaneous)', kind: 'toggle' });
      if (st.hs) { c.push({ key: 'hsX', label: 'High-set ×Is', kind: 'number', min: 1, max: 40, step: 0.5 }); c.push({ key: 'hsT', label: 'High-set time', kind: 'number', min: 0.01, max: 2, step: 0.01, unit: 's' }); }
    }
  }
  c.push({ key: 'kV', label: 'Device voltage', kind: 'number', min: 0.01, step: 0.01, unit: 'kV' });
  return c;
}

// ---------------------------------------------------------------- evaluation
// Returns {lo(I), hi(I), breaks[], pickup, summary}. lo = earliest operating time (lower edge),
// hi = latest clearing time (upper edge). INF means no operation at that current.
export function evaluate(dev, st) {
  if (dev.model === 'mcb') return evalMcb(dev, st);
  if (dev.model === 'tm') return evalTm(dev, st);
  if (dev.model === 'etu') return evalEtu(dev, st);
  if (dev.model === 'idmt') return evalIdmt(dev, st);
  throw new Error('unknown model ' + dev.model);
}

function evalMcb(dev, st) {
  const In = +st.In, cv = dev.curves[st.curve];
  const tb = (dev.thermalByCurve && dev.thermalByCurve[st.curve]) || dev.thermal;
  const band = In > 32 ? tb.gt32 : tb.le32;
  const m1 = cv.lo * In, m2 = cv.hi * In;
  const lo = (I) => Math.max(cv.clearMin / 2, I >= m1 ? Math.min(cv.clearMin, thermalCurve(band.lo, I / In)) : thermalCurve(band.lo, I / In));
  const hi = (I) => Math.max(cv.clearMin, I >= m2 ? Math.min(cv.tripMax, thermalCurve(band.hi, I / In)) : thermalCurve(band.hi, I / In));
  return {
    lo, hi, breaks: [m1, m2, band.lo.x0 * In, band.hi.x0 * In], pickup: band.lo.x0 * In,
    summary: `${dev.manufacturer === 'Generic (standard)' ? '' : dev.manufacturer + ' '}${dev.series} ${st.curve}${In}`,
    settingsText: `Curve ${st.curve}, In ${In} A; magnetic ${cv.lo}–${cv.hi}×In (${round(m1)}–${round(m2)} A)`,
  };
}

function evalTm(dev, st) {
  const In = +st.In, Ir = st.irX * In, Ii = +st.Ii, tol = dev.ii.tol ?? 0.2;
  const band = In > 63 ? dev.thermal.gt63 : dev.thermal.le63;
  const it = dev.instTimes || { clearMin: 0.01, tripMax: 0.05 };
  const a = Ii * (1 - tol), b = Ii * (1 + tol);
  const lo = (I) => Math.max(it.clearMin / 2, I >= a ? Math.min(it.clearMin, thermalCurve(band.lo, I / Ir)) : thermalCurve(band.lo, I / Ir));
  const hi = (I) => Math.max(it.clearMin, I >= b ? Math.min(it.tripMax, thermalCurve(band.hi, I / Ir)) : thermalCurve(band.hi, I / Ir));
  return {
    lo, hi, breaks: [a, b, band.lo.x0 * Ir, band.hi.x0 * Ir], pickup: band.lo.x0 * Ir,
    summary: `${dev.manufacturer} ${dev.series} ${In} A`,
    settingsText: `In ${In} A, Ir ${round(Ir, 1)} A (${round(st.irX, 2)}×In), Ii ${Math.round(Ii)} A ±${Math.round(tol * 100)} %`,
  };
}

function lTime(L, x, tr) {
  if (L.form === 'thermal-image') { const r = x * x - L.c; return r <= 0 ? INF : (tr * (L.ref * L.ref - L.c)) / r; }
  return (tr * L.ref * L.ref) / (x * x);
}

function evalEtu(dev, st) {
  const In = +st.In, Ir = +st.Ir, tr = +st.tr, L = dev.L;
  const pick = L.pickup || [1.05, 1.3];
  const tTol = L.tTol || [0, 0];
  const breaks = [pick[0] * Ir, pick[1] * Ir];
  const parts = [];
  // L
  parts.push({ lo: (I) => (I >= pick[0] * Ir ? lTime(L, I / Ir, tr) * (1 + tTol[0]) : INF), hi: (I) => (I >= pick[1] * Ir ? lTime(L, I / Ir, tr) * (1 + tTol[1]) : INF) });
  let sTxt = '';
  if (dev.S) {
    const S = dev.S, unit = S.isd.unit || 'xIr';
    const Isd = st.isd * (unit === 'xIn' ? In : Ir), tol = S.tol ?? 0;
    const sa = Isd * (1 - tol), sb = Isd * (1 + tol);
    let tlo, thi;
    const bySet = S.tsd.bandBySetting && S.tsd.bandBySetting[String(+st.tsd)];
    if (bySet) [tlo, thi] = bySet;
    else if (S.tsd.band) [tlo, thi] = S.tsd.band[0];
    else { const tt = S.tTol ?? 0; tlo = st.tsd * (1 - tt); thi = st.tsd * (1 + tt); if (st.tsd === 0) { tlo = 0.01; thi = 0.05; } }
    const ref = (S.i2tRef || 10) * ((S.i2tRefUnit || 'xIr') === 'xIn' ? In : Ir);
    const shape = (I) => (st.i2t && I < ref ? (ref / I) ** 2 : 1);
    parts.push({ lo: (I) => (I >= sa ? tlo * shape(I) : INF), hi: (I) => (I >= sb ? thi * shape(I) : INF) });
    breaks.push(sa, sb, ref);
    sTxt = `; Isd ${Math.round(Isd)} A${tol ? ` ±${Math.round(tol * 100)} %` : ''}, tsd ${st.tsd} s${st.i2t ? ' I²t ON' : ''}`;
  }
  let iTxt = '';
  if (st.Ii && dev.I) {
    const tol = dev.I.tol ?? 0, Ii = +st.Ii, [ilo, ihi] = dev.I.band || [0.01, 0.05];
    const ia = Ii * (1 - tol), ib = Ii * (1 + tol);
    parts.push({ lo: (I) => (I >= ia ? ilo : INF), hi: (I) => (I >= ib ? ihi : INF) });
    breaks.push(ia, ib);
    iTxt = `; Ii ${Math.round(Ii)} A${tol ? ` ±${Math.round(tol * 100)} %` : ''}`;
  }
  // the long-time I²t law must not extrapolate below the electronic floor (fastest element's band)
  const floorLo = dev.I && st.Ii ? (dev.I.band || [0.01])[0] : 0.01;
  const floorHi = dev.I && st.Ii ? (dev.I.band || [0.01, 0.05])[1] : 0.05;
  const lo = (I) => Math.max(floorLo, Math.min(...parts.map((p) => p.lo(I))));
  const hi = (I) => Math.max(floorHi, Math.min(...parts.map((p) => p.hi(I))));
  return {
    lo, hi, breaks, pickup: pick[0] * Ir,
    summary: `${dev.manufacturer} ${dev.series.replace(/ComPacT NSX |SENTRON /, '')} ${In} A`,
    settingsText: `In ${In} A, Ir ${round(Ir, 1)} A, tr ${tr} s${sTxt}${iTxt}`,
  };
}

export function idmtTime(cv, M, tms, mMax) {
  const m = Math.min(M, mMax || 20);
  const r = Math.pow(m, cv.alpha) - 1;
  if (r <= 0) return INF;
  return tms * (cv.scale ?? 1) * (cv.k / r + (cv.L || 0));
}

function evalIdmt(dev, st) {
  const cv = dev.curves[st.curve];
  const Is = (st.plug / 100) * st.ctPri; // primary amps
  const tol = dev.tol ?? 0;
  const start = (dev.start || 1.1) * Is;
  const nom = (I) => {
    if (I < start) return INF;
    let t = idmtTime(cv, I / Is, st.tms, dev.mMax);
    if (st.hs && I >= st.hsX * Is) t = Math.min(t, +st.hsT);
    return t;
  };
  const lo = (I) => nom(I) * (1 - tol);
  const hi = (I) => nom(I) * (1 + tol);
  const breaks = [start];
  if (st.hs) breaks.push(st.hsX * Is);
  return {
    lo, hi, nom, breaks, pickup: start, isRelay: true,
    summary: `${dev.series.split(' — ')[0].split(' / ')[0]} ${st.curve.split(' ')[0]} ${round(Is, 1)} A`,
    settingsText: `CT ${st.ctPri}/${st.ctSec} A, Is ${st.plug} % = ${round(Is, 1)} A pri, ${dev.tms.label || 'TMS'} ${round(st.tms, 3)}, ${st.curve}${st.hs ? `; high-set ${st.hsX}×Is (${Math.round(st.hsX * Is)} A) ${st.hsT} s` : ''}`,
  };
}

// ---------------------------------------------------------------- sampling & analysis
export function sample(ev, k, Imin, Imax, n = 420) {
  const xs = [];
  const l0 = Math.log10(Imin), l1 = Math.log10(Imax);
  for (let i = 0; i <= n; i++) xs.push(10 ** (l0 + ((l1 - l0) * i) / n));
  for (const b of ev.breaks) { const B = b * k; if (B > Imin && B < Imax) xs.push(B * 0.99999, B * 1.00001); }
  xs.sort((a, b) => a - b);
  return xs.map((I) => ({ I, lo: ev.lo(I / k), hi: ev.hi(I / k), nom: ev.nom ? ev.nom(I / k) : null }));
}

// Smallest current (study amps) at which downstream's latest clearing time reaches the
// upstream's earliest operating time — i.e. the time-current selectivity limit.
export function selectivity(up, kUp, dn, kDn, Imin, Imax) {
  const n = 1200, l0 = Math.log10(Imin), l1 = Math.log10(Imax);
  for (let i = 0; i <= n; i++) {
    const I = 10 ** (l0 + ((l1 - l0) * i) / n);
    const tu = up.lo(I / kUp), td = dn.hi(I / kDn);
    if (Number.isFinite(tu) && Number.isFinite(td) && td >= tu) return I;
  }
  return null;
}
