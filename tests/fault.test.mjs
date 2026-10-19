import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../js/engine.js';
import * as F from '../js/fault.js';

const DB = JSON.parse(fs.readFileSync(new URL('../db/curvedb.json', import.meta.url)));
const N = DB.network;
const dev = (id) => DB.devices.find((d) => d.id === id);
const mk = (id, o, uid, downOf, cab) => { const d = dev(id); const st = { ...E.defaultSettings(d), ...o, uid, downOf, label: id, kV: 0.4 }; E.normalize(d, st); st.cab = cab; return st; };

test('transformer source matches the IEC 60909 hand calculation', () => {
  const r = F.analyse({ items: [], dev, E, N, net: { kVA: 1000, uk: 6, pk: 10.5, mva: 500 }, baseKV: 0.4 });
  // ZT = 0.06·400²/1e6 = 9.6 mΩ; RT = 10.5e3·400²/1e12 = 1.68 mΩ; XT = 9.45 mΩ; KT = 0.95·1.05/(1+0.6·0.0591) = 0.9636
  assert.ok(Math.abs(r.origin.info.RT - 0.00168) < 1e-6);
  assert.ok(Math.abs(r.origin.info.KT - 0.9636) < 5e-4);
  const ZQ = 1.05 * 400 ** 2 / 500e6, XQ = 0.995 * ZQ, RQ = 0.1 * XQ;
  const R = 0.00168 * r.origin.info.KT + RQ, X = r.origin.info.XT * r.origin.info.KT + XQ;
  const ik3 = 1.05 * 400 / Math.sqrt(3) / Math.hypot(R, X);
  assert.ok(Math.abs(r.origin.ik3 - ik3) < 1);
  assert.ok(r.origin.ik3 > 24000 && r.origin.ik3 < 26500);
});

test('cable impedance lowers the fault level and the minimum earth fault uses cmin and hot conductors', () => {
  const items = [
    mk('hager-h3-p160-tm', { In: 100, bcCode: 'H 25 kA' }, 1, null, { on: true, mat: 'Cu', ins: 'PVC', method: 'C', S: 16, Spe: 16, L: 50, n: 1, ph: 3, Ib: 60 }),
    mk('se-ic60n', { curve: 'C', In: 20 }, 2, 1, { on: true, mat: 'Cu', ins: 'PVC', method: 'C', S: 2.5, Spe: 1.5, L: 30, ph: 1, Ib: 16 }),
  ];
  const net = { src: 'supply', ik3: 16, xr: 1e-6, ze: '' };
  const r = F.analyse({ items, dev, E, N, net, baseKV: 0.4 });
  const a = r.byUid.get(1), b = r.byUid.get(2);
  assert.ok(Math.abs(a.ik3 - 16000) < 1);
  // origin Z = 1.05·400/(√3·16 kA) = 15.16 mΩ resistive; 50 m of 16 mm² Cu = 57.5 mΩ, X = 4 mΩ
  const Zs = 1.05 * 400 / (Math.sqrt(3) * 16000);
  assert.ok(Math.abs(b.ik3 - (1.05 * 400 / Math.sqrt(3)) / Math.hypot(Zs + 0.0575, 0.004)) < 1);
  // circuit-end minimum L-PE: cmin 0.95, hot R = R20·(1 + 0.00393·50)
  const k = 1 + 0.00393 * 50, X = 0.00008;
  const loop = F.analyse({ items, dev, E, N, net, baseKV: 0.4 }).byUid.get(2).ik1Min;
  const zE = { r: Zs + (0.0575 + 0.0575) * k + (0.00741 * 30 + 0.0121 * 30) * k, x: 2 * 50 * X + 2 * 30 * X };
  assert.ok(Math.abs(loop - (0.95 * 400 / Math.sqrt(3)) / Math.hypot(zE.r, zE.x)) < 1);
  assert.equal(b.checks.find((c) => c.k === 'break').st, 'ok');
  assert.equal(b.final, true); assert.equal(b.tReq, 0.4);
});

test('breaking capacity fails when Icu is below the prospective current', () => {
  const items = [mk('se-ik60n', { curve: 'C', In: 32 }, 1, null, undefined)];
  const r = F.analyse({ items, dev, E, N, net: { src: 'supply', ik3: 10, xr: 1 }, baseKV: 0.4 });
  assert.equal(r.byUid.get(1).checks.find((c) => c.k === 'break').st, 'bad');
  const ok = F.analyse({ items: [{ ...items[0], icuUser: 15 }], dev, E, N, net: { src: 'supply', ik3: 10, xr: 1 }, baseKV: 0.4 });
  assert.equal(ok.byUid.get(1).checks.find((c) => c.k === 'break').st, 'ok');
});

test('TT earth fault is cleared only by the residual function', () => {
  const cab = { on: true, S: 2.5, Spe: 2.5, L: 20, ph: 1, Ib: 10, ins: 'PVC' };
  const net = { src: 'supply', ik3: 6, xr: 1, earthing: 'TT', raRb: 50 };
  const mcb = F.analyse({ items: [mk('se-ic60n', { curve: 'B', In: 16 }, 1, null, cab)], dev, E, N, net, baseKV: 0.4 }).byUid.get(1);
  const rcbo = F.analyse({ items: [mk('chint-nb1l', { curve: 'B', In: 16 }, 1, null, cab)], dev, E, N, net, baseKV: 0.4 }).byUid.get(1);
  assert.equal(mcb.checks.find((c) => c.k === 'disc').st, 'bad');
  assert.equal(rcbo.checks.find((c) => c.k === 'disc').st, 'ok');
  assert.equal(rcbo.tReq, 0.2);
});

test('ampacity, ambient correction and frame-dependent breaking capacity', () => {
  assert.equal(F.ampacity(N, { ins: 'PVC', mat: 'Cu', method: 'C', S: 2.5, amb: 30, kf: 1, n: 1 }).Iz, 24);
  const hot = F.ampacity(N, { ins: 'PVC', mat: 'Cu', method: 'C', S: 2.5, amb: 40, kf: 1, n: 1 });
  assert.ok(Math.abs(hot.Iz - 24 * Math.sqrt(30 / 40)) < 1e-9);
  const nm1 = dev('chint-nm1-tm');
  assert.equal(F.breakingCapacity(nm1, { In: 400, bcCode: 'H' }).icu, 50);
  assert.equal(F.breakingCapacity(nm1, { In: 1250, bcCode: 'H' }).icu, 65);
  for (const d of DB.devices) if (d.bc) for (const o of d.bc.options) assert.ok(o.icu > 0 || o.icuBy?.length, d.id);
});

test('delayed residual add-on: non-actuating Δt and 30 mA forced instantaneous', () => {
  const d = dev('se-vigipact-nsx');
  const st = { ...E.defaultSettings(d), idn: 300, dt: 0.15 }; E.normalize(d, st);
  const ev = E.evaluateEF(d, st);
  assert.equal(ev.lo(1), 0.15); assert.equal(ev.hi(1), 0.34); assert.equal(ev.hi(0.2), Infinity);
  const s30 = { ...st, idn: 30, dt: 1.2 }; E.normalize(d, s30);
  assert.equal(s30.dt, 0);
});
