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

const offFmt = (base, unit) => (a) => (a === 0 ? 'OFF' : `${round(a / base, 2)}×${unit}  (${Math.round(a)} A)`);
function etuIiSpec(dev, In, Ir) {
  const I = dev.I || {};
  const k = String(In);
  if (I.xIrSteps) { const b = Ir || In; return { kind: 'select', values: I.xIrSteps.map((m) => round(m * b, 3)), fmt: offFmt(b, 'Ir') }; }
  if (I.fixedA && pick(I.fixedA, k)) return { kind: 'fixed', value: pick(I.fixedA, k) };
  if (I.fixedXIn && pick(I.fixedXIn, k)) return { kind: 'fixed', value: pick(I.fixedXIn, k) * In };
  if (I.fixedAByFrame) return { kind: 'fixed', value: In <= 630 ? I.fixedAByFrame['630'] : I.fixedAByFrame['1600'] };
  if (I.xInSteps) return { kind: 'select', values: I.xInSteps.map((m) => m * In), fmt: offFmt(In, 'In') };
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
  if (dev.model === 'custom') { st.kI = 1; st.kT = 1; st.base = dev.base || 100; st.kV = dev.kV ?? 0.4; }
  if (dev.model === 'rcd') { const r = dev.ratings; st.In = r.includes(40) ? 40 : r[Math.floor(r.length / 2)]; }
  if (dev.model === 'idmt') st.fn = 'phase';
  if (dev.rcd) { st.idn = dev.rcd.idn.includes(30) ? 30 : dev.rcd.idn[0]; st.rcdType = dev.rcd.types.includes('A') ? 'A' : dev.rcd.types[0]; st.rcdClass = dev.rcd.classes[0]; }
  if (dev.G) { const v = gIgValues(dev); st.ig = v.includes(0.5) ? 0.5 : v.filter((x) => x > 0)[Math.floor(v.filter((x) => x > 0).length / 2)]; const tv = gTgValues(dev); st.tg = tv.includes(0.2) ? 0.2 : tv[Math.floor(tv.length / 2)]; st.gi2t = !!dev.G.i2tFixed; }
  normalize(dev, st);
  return st;
}

// Keep settings inside the device's legal values whenever rating/curve changes.
export function normalize(dev, st) {
  const clampR = (v, s) => Math.min(s.max, Math.max(s.min, num(v, s.max)));
  if (dev.model === 'custom') { st.kI = Math.min(100, Math.max(0.01, num(st.kI, 1))); st.kT = Math.min(100, Math.max(0.01, num(st.kT, 1))); st.base = Math.max(0.001, num(st.base, dev.base || 100)); return st; }
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
      if (isd.xIr || isd.steps) { const v = isd.xIr || isd.steps; st.isd = v.includes(+st.isd) ? +st.isd : (S.defaultOff && st.isd === undefined && v.includes(0) ? 0 : v[Math.floor(v.length / 2)]); }
      else st.isd = clampR(st.isd ?? Math.min(isd.max, 6), isd);
      const tsd = valuesSpec(S.tsd);
      if (tsd.kind === 'fixed') st.tsd = tsd.value; else if (tsd.kind === 'select') st.tsd = tsd.values.includes(+st.tsd) ? +st.tsd : tsd.values[Math.min(1, tsd.values.length - 1)]; else st.tsd = clampR(st.tsd ?? tsd.min, tsd);
      st.i2t = S.i2tFixed ? true : S.i2t ? !!st.i2t : false;
    }
    const iis = etuIiSpec(dev, In, st.Ir);
    if (iis) { if (iis.kind === 'fixed') st.Ii = iis.value; else if (iis.kind === 'select') st.Ii = iis.values.some((v) => Math.abs(v - st.Ii) < 1e-6) ? iis.values.find((v) => Math.abs(v - st.Ii) < 1e-6) : (st.IiX !== undefined && iis.values[st.IiX] !== undefined ? iis.values[st.IiX] : iis.values[iis.values.length - 1]); else st.Ii = clampR(st.Ii, iis); }
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
  if (dev.model === 'rcd') { if (!dev.ratings.includes(+st.In)) st.In = nearest(dev.ratings, +st.In || 40); }
  if (dev.model === 'idmt' && st.fn !== 'earth') st.fn = 'phase';
  if (dev.rcd) {
    if (!dev.rcd.idn.includes(+st.idn)) st.idn = nearest(dev.rcd.idn, +st.idn || 30);
    if (!dev.rcd.types.includes(st.rcdType)) st.rcdType = dev.rcd.types[0];
    if (!dev.rcd.classes.includes(st.rcdClass)) st.rcdClass = dev.rcd.classes[0];
  }
  if (dev.G) {
    const v = gIgValues(dev); st.ig = v.some((x) => Math.abs(x - +st.ig) < 1e-9) ? +st.ig : nearest(v, num(st.ig, 0.5));
    const tv = gTgValues(dev); st.tg = nearest(tv, num(st.tg, tv[0]));
    st.gi2t = dev.G.i2tFixed ? true : (dev.G.i2t ? !!st.gi2t : false);
  }
  st.kV = Math.max(0.01, num(st.kV, 0.4));
  return st;
}

export function controlsFor(dev, st) {
  const c = [];
  const fmtA = (a) => `${round(a, 1)} A`;
  if (dev.model === 'custom') {
    if (dev.unit === 'x') c.push({ key: 'base', label: 'Base current', kind: 'number', unit: 'A', min: 0.001, step: 'any' });
    c.push({ key: 'kI', label: 'Current multiplier', kind: 'number', min: 0.01, max: 100, step: 'any' });
    c.push({ key: 'kT', label: 'Time multiplier', kind: 'number', min: 0.01, max: 100, step: 'any' });
    return c;
  }
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
      if (isd.xIr || isd.steps) c.push({ key: 'isd', label: `Isd (${unit === 'xIn' ? '×In' : '×Ir'})`, kind: 'select', values: isd.xIr || isd.steps, fmt: (v) => (+v === 0 ? 'OFF' : `${v}  (${Math.round(v * base)} A)`) });
      else c.push({ key: 'isd', label: `Isd (${unit === 'xIn' ? '×In' : '×Ir'})`, kind: 'range', min: isd.min, max: isd.max, step: isd.step || 0.1, fmt: (v) => `${round(v, 2)} = ${Math.round(v * base)} A` });
      const tsd = valuesSpec(dev.S.tsd, 's');
      c.push({ key: 'tsd', label: 'tsd', ...tsd, fmt: (v) => `${round(v, 3)} s` });
      if (dev.S.i2t && !dev.S.i2tFixed) c.push({ key: 'i2t', label: 'I²t ON (S)', kind: 'toggle' });
    }
    const iis = etuIiSpec(dev, In, st.Ir);
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
  if (dev.model === 'rcd') c.push({ key: 'In', label: 'Rating In', kind: 'select', values: dev.ratings, fmt: (v) => `${v} A` });
  if (dev.model === 'idmt') c.push({ key: 'fn', label: 'Protection function', kind: 'select', values: ['phase', 'earth'], fmt: (v) => (v === 'earth' ? 'Earth fault' : 'Phase overcurrent') });
  if (dev.rcd) {
    c.push({ key: 'idn', label: 'IΔn (residual)', kind: 'select', values: dev.rcd.idn, fmt: (v) => (v >= 1000 ? `${v / 1000} A` : `${v} mA`) });
    if (dev.rcd.types.length > 1) c.push({ key: 'rcdType', label: 'Residual type', kind: 'select', values: dev.rcd.types, fmt: (v) => `Type ${v}` });
    if (dev.rcd.classes.length > 1) c.push({ key: 'rcdClass', label: 'Time class', kind: 'select', values: dev.rcd.classes, fmt: (v) => RCD_CLASS_NAME[v] });
  }
  if (dev.G) {
    const In = +st.In;
    c.push({ key: 'ig', label: 'Ig (earth fault)', kind: 'select', values: gIgValues(dev), fmt: (v) => (+v === 0 ? 'OFF' : `${round(v, 3)}×In  (${round(gIgA(dev, v, In), 1)} A)`) });
    if (+st.ig > 0) {
      c.push({ key: 'tg', label: 'tg', kind: 'select', values: gTgValues(dev), fmt: (v) => `${round(v, 3)} s` });
      if (dev.G.i2t && !dev.G.i2tFixed) c.push({ key: 'gi2t', label: 'I²t ON (G)', kind: 'toggle' });
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
  if (dev.model === 'custom') return evalCustom(dev, st);
  if (dev.model === 'rcd') return { none: true, lo: () => INF, hi: () => INF, breaks: [], pickup: INF, summary: dev.series, settingsText: `In ${st.In} A (no overcurrent release)` };
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
  if (dev.S && +st.isd > 0) {
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

// ------------------------------------------------------------ user-defined curves (points list)
// dev.points: [{ I, t, t2? }] — I in A (unit 'A') or multiples of a base current (unit 'x').
// Log-log interpolation between points; equal currents give a vertical step. Below the first
// point the device does not operate; above the last point the last time is held (extend) or
// the curve ends.
export function parsePoints(text) {
  const out = [];
  for (let raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/(#|\/\/).*$/, '').trim();
    if (!line) continue;
    const parts = /[;\t]/.test(line) ? line.split(/[;\t]+/).map((x) => x.trim().replace(',', '.')) : line.split(/[\s,]+/);
    const nums = parts.map((x) => Number(x)).filter((x) => Number.isFinite(x));
    if (nums.length < 2 || parts.filter((x) => x !== '').length > nums.length + 1) continue; // header / text line
    const [I, t, t2] = nums;
    if (I > 0 && t > 0) out.push(t2 > 0 ? { I, t, t2 } : { I, t });
  }
  return out;
}
export function formatPoints(dev) {
  const band = dev.mode === 'band';
  const head = [`# TCC Studio custom curve: ${dev.series}`, `# unit: ${dev.unit === 'x' ? `multiples of ${dev.base} A` : 'A'}, voltage ${dev.kV ?? 0.4} kV`,
    `# current${dev.unit === 'x' ? '_x' : '_A'}\t${band ? 't_min_s\tt_max_s' : 'time_s'}`];
  return head.concat(sortPts(dev.points).map((p) => [p.I, p.t].concat(band ? [p.t2 ?? p.t] : []).join('\t'))).join('\n') + '\n';
}
export function sortPts(pts) { return pts.slice().sort((a, b) => a.I - b.I || b.t - a.t); }
export function checkPoints(dev) {
  const msgs = []; const p = sortPts(dev.points || []);
  if (p.length < 2) msgs.push({ level: 'error', text: 'A curve needs at least 2 points.' });
  for (let i = 1; i < p.length; i++) if (p[i].t > p[i - 1].t * 1.0001) { msgs.push({ level: 'warn', text: `Time rises with current between ${p[i - 1].I} and ${p[i].I} — check the point order.` }); break; }
  if (dev.mode === 'band' && p.some((q) => (q.t2 ?? q.t) < q.t)) msgs.push({ level: 'error', text: 'Maximum time is below minimum time on at least one row.' });
  return msgs;
}
function interpFn(pts, key, extend) {
  const P = pts.map((p) => ({ I: p.I, t: key === 't2' ? (p.t2 ?? p.t) : p.t }));
  const L = P.map((p) => ({ x: Math.log10(p.I), y: Math.log10(p.t) }));
  return (I) => {
    if (!(I > 0) || P.length < 2 || I < P[0].I) return INF;
    const last = P[P.length - 1];
    if (I > last.I) return extend ? last.t : INF;
    const x = Math.log10(I);
    let best = INF;
    for (let i = 0; i < P.length - 1; i++) {
      const a = L[i], b = L[i + 1];
      if (x < a.x || x > b.x) continue;
      if (b.x === a.x) { best = Math.min(best, 10 ** Math.min(a.y, b.y)); continue; }
      best = Math.min(best, 10 ** (a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y)));
    }
    if (best === INF) for (const p of P) if (Math.abs(p.I - I) / I < 1e-9) best = Math.min(best, p.t);
    return best;
  };
}
function evalCustom(dev, st) {
  const base = dev.unit === 'x' ? +st.base || dev.base || 1 : 1;
  const kI = +st.kI || 1, kT = +st.kT || 1;
  const pts = sortPts(dev.points || []).map((p) => ({ I: p.I * base * kI, t: p.t * kT, t2: (p.t2 ?? p.t) * kT }));
  const ext = dev.extend !== false;
  const fMin = interpFn(pts, 't', ext), fMax = dev.mode === 'band' ? interpFn(pts, 't2', ext) : fMin;
  const breaks = pts.map((p) => p.I);
  return {
    lo: fMin, hi: fMax, nom: null, breaks, pickup: pts.length ? pts[0].I : 1, isRelay: dev.category === 'RELAY',
    summary: dev.series,
    settingsText: `${pts.length} points${dev.mode === 'band' ? ' (min/max band)' : ''}, ${pts.length ? `${round(pts[0].I, 1)}–${round(pts[pts.length - 1].I, 1)} A` : '—'}`
      + `${dev.unit === 'x' ? `, base ${round(base, 2)} A` : ''}${kI !== 1 ? `, current ×${kI}` : ''}${kT !== 1 ? `, time ×${kT}` : ''}${ext ? '' : ', ends at last point'}`,
  };
}

// ------------------------------------------------------------ earth fault: residual-current devices and G functions
export const RCD_CLASS_NAME = { general: 'General (instantaneous)', S: 'S (selective)', G: 'G (10 ms delayed)' };
// IEC 61008-1 / 61009-1 tripping-time table for sinusoidal residual current (multiples of IΔn).
const RCD_TABLE = {
  general: { max: [0.3, 0.15, 0.04], min: [0.01, 0.01, 0.01] },
  G: { max: [0.3, 0.15, 0.04], min: [0.01, 0.01, 0.01] },
  S: { max: [0.5, 0.2, 0.15], min: [0.13, 0.06, 0.05] },
};
function gIgValues(dev) {
  const g = dev.G.ig;
  if (g.steps) return g.steps.slice();
  const v = []; for (let x = g.min; x <= g.max + 1e-9; x += g.step) v.push(round(x, 4));
  return g.off ? [0, ...v] : v;
}
function gTgValues(dev) {
  const t = dev.G.tg;
  if (t.steps) return t.steps.slice();
  const v = []; for (let x = t.min; x <= t.max + 1e-9; x += t.step) v.push(round(x, 4));
  return v;
}
function gIgA(dev, x, In) { const a = x * In; return dev.G.ig.maxA ? Math.min(a, dev.G.ig.maxA) : a; }
function evalRcd(dev, st) {
  const idn = +st.idn / 1000, cls = st.rcdClass || 'general', T = RCD_TABLE[cls] || RCD_TABLE.general;
  const cap = dev.rcd.tmaxIdn || INF;
  const tmax = [Math.min(T.max[0], cap), Math.min(T.max[1], cap), T.max[2]];
  const hi = (I) => (I < idn ? INF : I < 2 * idn ? tmax[0] : I < 5 * idn ? tmax[1] : tmax[2]);
  const lo = (I) => (I < 0.5 * idn ? INF : I < 2 * idn ? T.min[0] : I < 5 * idn ? T.min[1] : T.min[2]);
  return {
    lo, hi, nom: null, breaks: [0.5 * idn, idn, 2 * idn, 5 * idn], pickup: 0.5 * idn, isRelay: false,
    summary: `${dev.series} ${st.idn} mA`,
    settingsText: `IΔn ${st.idn >= 1000 ? st.idn / 1000 + ' A' : st.idn + ' mA'} type ${st.rcdType}, ${RCD_CLASS_NAME[cls]}; no trip < ${round(0.5 * idn * 1000, 1)} mA; ≤ ${tmax[0]} / ${tmax[1]} / ${tmax[2]} s at 1 / 2 / 5·IΔn`,
  };
}
function evalG(dev, st) {
  const g = dev.G, In = +st.In, Ig = gIgA(dev, +st.ig, In), tol = g.tol ?? 0.1, tg = +st.tg;
  const band = g.tgBands && g.tgBands[String(tg)];
  const tLo = band ? band[0] : tg * (1 - (g.tTol ?? 0.15)), tHi = band ? band[1] : tg * (1 + (g.tTol ?? 0.15));
  const i2t = !!st.gi2t;
  const ref = !i2t ? 0 : g.i2tRefUnit === 'xIn' ? (g.i2tRef || 1) * In : (g.i2tRef || 2) * Ig;
  const shape = (I) => (i2t && I < ref ? (ref / I) ** 2 : 1);
  const lo = (I) => (I < Ig * (1 - tol) ? INF : tLo * shape(I * (1 + tol)));
  const hi = (I) => (I < Ig * (1 + tol) ? INF : tHi * shape(I));
  return {
    lo, hi, nom: (I) => (I < Ig ? INF : tg * shape(I)), breaks: [Ig * (1 - tol), Ig * (1 + tol)].concat(ref ? [ref] : []), pickup: Ig * (1 - tol), isRelay: false,
    summary: `${dev.series} G`,
    settingsText: `G: Ig ${round(Ig, 1)} A (${round(+st.ig, 3)}×In) ±${Math.round(tol * 100)} %, tg ${tg} s${i2t ? `, I²t (ref ${round(ref, 1)} A)` : ', definite time'}`,
  };
}
// Earth-fault characteristic of a study item, or null when the device has none.
export function evaluateEF(dev, st) {
  if (dev.rcd) return evalRcd(dev, st);
  if (dev.G) return +st.ig > 0 ? evalG(dev, st) : null;
  if (dev.model === 'idmt' && st.fn === 'earth') return evaluate(dev, st);
  if (dev.model === 'custom' && dev.category === 'EARTH') return evaluate(dev, st);
  return null;
}
// Whether the item's phase curve belongs on the phase-fault chart.
export function inPhaseView(dev, st) {
  if (dev.model === 'rcd') return false;
  if (dev.model === 'idmt' && st.fn === 'earth') return false;
  if (dev.model === 'custom' && dev.category === 'EARTH') return false;
  return true;
}
export function hasEF(dev) { return !!(dev.rcd || dev.G || dev.model === 'idmt' || (dev.model === 'custom' && dev.category === 'EARTH')); }
