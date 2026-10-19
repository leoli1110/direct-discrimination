// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../js/engine.js';

const DB = JSON.parse(fs.readFileSync(new URL('../db/curvedb.json', import.meta.url)));

test('every device references known sources and has a supported model', () => {
  for (const d of DB.devices) {
    assert.ok(['mcb', 'tm', 'etu', 'idmt', 'rcd'].includes(d.model), `${d.id}: model ${d.model}`);
    assert.ok(d.sources.length > 0, `${d.id}: no sources`);
    for (const s of d.sources) assert.ok(DB.sources[s], `${d.id}: unknown source ${s}`);
  }
  const ids = DB.devices.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate device ids');
});

test('every selectable setting gives a valid, ordered band', () => {
  let n = 0;
  for (const dev of DB.devices) {
    const ctrls = E.controlsFor(dev, E.defaultSettings(dev));
    const variants = [{}];
    for (const c of ctrls) if (c.kind === 'select') for (const v of c.values) variants.push({ [c.key]: v });
    if (dev.G) variants.push({ gi2t: true });
    for (const v of variants) {
      const st = { ...E.defaultSettings(dev), ...v };
      E.normalize(dev, st);
      for (const ev of [E.evaluate(dev, st), E.evaluateEF(dev, st)]) {
        if (!ev || ev.none) continue;
        const pts = E.sample(ev, 1, 0.001, 2e5, 140);
        for (const p of pts) {
          assert.ok(!Number.isNaN(p.lo) && !Number.isNaN(p.hi), `${dev.id} ${JSON.stringify(v)}: NaN at ${p.I}`);
          assert.ok(p.hi >= p.lo - 1e-9, `${dev.id} ${JSON.stringify(v)}: hi < lo at ${p.I}`);
        }
        assert.ok(pts.some((p) => Number.isFinite(p.hi)), `${dev.id}: never trips`);
        n++;
      }
    }
  }
  assert.ok(n > 1000);
});

test('IEC 60898-1 fit stays inside the ABB S200 published windows', () => {
  const d = DB.devices.find((x) => x.id === 'abb-s200');
  const st = { ...E.defaultSettings(d), curve: 'C', In: 16 }; E.normalize(d, st);
  const ev = E.evaluate(d, st);
  assert.ok(ev.hi(16 * 3) <= 45);
  assert.ok(ev.hi(16 * 5) <= 15);
});

test('Tmax T band passes through the catalogue worked example at 2·I1', () => {
  const d = DB.devices.find((x) => x.id === 'abb-t4-tm');
  const st = { ...E.defaultSettings(d), In: 250, irX: 1 }; E.normalize(d, st);
  const ev = E.evaluate(d, st);
  assert.ok(Math.abs(ev.lo(500) - 105.3) < 0.5, `lo ${ev.lo(500)}`);
  assert.ok(Math.abs(ev.hi(500) - 357.8) < 1, `hi ${ev.hi(500)}`);
});

test('CDG11 standard inverse gives about 2.97 s at 10x, TMS 1', () => {
  const d = DB.devices.find((x) => x.id === 'cdg11-3s');
  const st = { ...E.defaultSettings(d), ctPri: 100, ctSec: 1, plug: 100, tms: 1 }; E.normalize(d, st);
  const ev = E.evaluate(d, st);
  assert.ok(Math.abs(ev.nom(1000) - 2.97) < 0.05, `t=${ev.nom(1000)}`);
});

test('custom curves: parse, interpolate log-log, vertical steps, band and extension', () => {
  const pts = E.parsePoints('# header\ncurrent;time;tmax\n200;1000;3000\n400;30,5;90\n1000;0,8;2\n1000\t0.02\t0.05\n5000 0.01 0.02');
  assert.equal(pts.length, 5);
  assert.deepEqual(pts[1], { I: 400, t: 30.5, t2: 90 });
  const d = { id: 'u', model: 'custom', category: 'FUSE', mode: 'band', unit: 'A', extend: true, points: pts };
  const st = E.defaultSettings(d); const ev = E.evaluate(d, st);
  assert.equal(ev.lo(150), Infinity);
  assert.ok(Math.abs(ev.lo(200) - 1000) < 1e-6);
  assert.ok(Math.abs(ev.lo(1000) - 0.02) < 1e-9, 'vertical step takes the lower time');
  assert.ok(ev.hi(300) > ev.lo(300));
  assert.equal(ev.lo(8000), 0.01);
  const ended = E.evaluate({ ...d, extend: false }, st);
  assert.equal(ended.lo(8000), Infinity);
  // multiples of a base current, plus current/time multipliers
  const dx = { ...d, unit: 'x', base: 100 };
  const sx = { ...E.defaultSettings(dx), base: 50, kI: 2, kT: 0.5 }; E.normalize(dx, sx);
  const ex = E.evaluate(dx, sx);
  assert.ok(Math.abs(ex.lo(200 * 50 * 2) - 500) < 1e-6);
  assert.deepEqual(E.parsePoints(E.formatPoints({ ...d, series: 'x' })), E.sortPts(pts));
  assert.equal(E.checkPoints({ ...d, points: pts.slice(0, 1) })[0].level, 'error');
});

test('RCD residual band follows the IEC 61008/61009 table', () => {
  const d = DB.devices.find((x) => x.id === 'iec61008-rccb');
  const st = { ...E.defaultSettings(d), idn: 30, rcdClass: 'general' }; E.normalize(d, st);
  const ev = E.evaluateEF(d, st);
  assert.equal(ev.lo(0.014), Infinity, 'no trip below 0.5·IΔn');
  assert.equal(ev.hi(0.03), 0.3); assert.equal(ev.hi(0.06), 0.15); assert.equal(ev.hi(0.15), 0.04);
  const s2 = { ...st, rcdClass: 'S', idn: 300 }; E.normalize(d, s2);
  const es = E.evaluateEF(d, s2);
  assert.equal(es.lo(0.3), 0.13); assert.equal(es.hi(0.3), 0.5); assert.equal(es.hi(1.5), 0.15);
  assert.ok(E.evaluate(d, st).none, 'an RCCB has no phase curve');
});

test('RCBO keeps its MCB curve and adds the residual band; NB1L caps IΔn time at 0.1 s', () => {
  const d = DB.devices.find((x) => x.id === 'chint-nb1l');
  const st = E.defaultSettings(d);
  assert.ok(Number.isFinite(E.evaluate(d, st).hi(10 * st.In)));
  assert.equal(E.evaluateEF(d, st).hi(0.03), 0.1);
});

test('G function: OFF, definite time and I²t', () => {
  const d = DB.devices.find((x) => x.id === 'se-ml52');
  const st = { ...E.defaultSettings(d), In: 160, ig: 0.5, tg: 0.2 }; E.normalize(d, st);
  const ev = E.evaluateEF(d, st);
  assert.equal(ev.hi(80 * 1.05), Infinity);
  assert.equal(ev.hi(200), 0.2); assert.equal(ev.lo(200), 0.14);
  assert.equal(E.evaluateEF(d, { ...st, ig: 0 }), null);
  const i2 = E.evaluateEF(d, { ...st, gi2t: true });
  assert.ok(i2.hi(200) > 0.2);
  const r = DB.devices.find((x) => x.id === 'cdg11-3s');
  const rs = { ...E.defaultSettings(r), fn: 'earth' }; E.normalize(r, rs);
  assert.ok(E.evaluateEF(r, rs) && !E.inPhaseView(r, rs));
});
