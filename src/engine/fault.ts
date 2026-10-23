import { DeviceDef, NetworkConfig, StudyItem, StudyItemCable } from '../types';

const INF = Infinity;
const cx = (r = 0, x = 0) => ({ r, x });
const add = (a: { r: number; x: number }, b: { r: number; x: number }) => cx(a.r + b.r, a.x + b.x);
const mul = (a: { r: number; x: number }, k: number) => cx(a.r * k, a.x * k);
const mag = (a: { r: number; x: number }) => Math.hypot(a.r, a.x);

export const DEFAULT_NET: NetworkConfig = {
  src: 'tx',
  kVA: 1000,
  uk: 6,
  pk: '',
  txType: 'oil',
  mva: 500,
  Un: 400,
  ik3: 16,
  xr: 2,
  ze: '',
  earthing: 'TN',
  raRb: 20,
  tol: '6',
  vdLimit: 5,
  mark: true,
};

export const DEFAULT_CABLE: StudyItemCable = {
  on: false,
  mat: 'Cu',
  ins: 'XLPE',
  method: 'C',
  S: 16,
  Spe: 16,
  L: 20,
  n: 1,
  ph: 3,
  Ib: 0,
  pf: 0.85,
  amb: 30,
  kf: 1,
  kind: 'auto',
  Iz: '',
};

export function cableSizes(N: any, mat: string): number[] {
  return Object.keys(N.resistance20[mat] || {})
    .map(Number)
    .filter((x) => x >= 1.5)
    .sort((a, b) => a - b);
}

const r20 = (N: any, mat: string, S: number): number => {
  const t = N.resistance20[mat];
  if (t[String(S)] !== undefined) return t[String(S)] / 1000;
  const ks = Object.keys(t).map(Number);
  const s0 = ks.reduce((a, b) => (Math.abs(b - S) < Math.abs(a - S) ? b : a), ks[0]);
  return ((t[String(s0)] * s0) / S) / 1000;
};

const rT = (N: any, mat: string, S: number, theta: number): number =>
  r20(N, mat, S) * (1 + (N.alpha[mat] || 0.004) * (theta - 20));

export function ampacity(N: any, c: any) {
  const tab = N.ampacity[c.ins]?.[c.mat]?.[c.method];
  const base = tab ? tab[String(c.S)] : undefined;
  if (+c.Iz > 0) return { Iz: +c.Iz, base: null, ca: 1, user: true };
  if (base === undefined) return { Iz: null, base: null, ca: 1 };
  const th = N.insulation[c.ins].thetaMax, ref = c.method === 'D1' ? 20 : 30;
  const amb = Number.isFinite(+c.amb) ? +c.amb : ref;
  const ca = amb >= th ? 0 : Math.sqrt((th - amb) / (th - ref));
  return { Iz: base * ca * (+c.kf || 1) * Math.max(1, +c.n || 1), base, ca };
}

export function settingCurrent(d: DeviceDef, st: StudyItem): number | null {
  if (d.model === 'mcb' || d.model === 'rcd') return +st.In!;
  if (d.model === 'tm') return (+st.irX! || 1) * +st.In!;
  if (d.model === 'etu') return +st.Ir! || +st.In!;
  return null;
}

export function breakingCapacity(d: DeviceDef, st: StudyItem) {
  if (+st.icuUser! > 0) return { icu: +st.icuUser!, ics: null, label: `${st.icuUser} kA (entered)`, basis: 'user', note: '' };
  const opts = d.bc?.options;
  if (!opts || !opts.length) return null;
  const o = opts.find((x) => x.code === st.bcCode) || opts[0];
  let icu = o.icu;
  if (o.icuBy) {
    const In = +st.In!;
    const row = o.icuBy.find(([m]) => In <= m) || o.icuBy[o.icuBy.length - 1];
    icu = row[1];
  }
  return { icu: icu!, ics: o.ics ? (icu! * o.ics) / 100 : null, label: o.code, basis: o.basis, note: o.note };
}

function sourceZ(N: any, net: NetworkConfig, cfac: { max: number; min: number }) {
  const Un = +net.Un || 400;
  if (net.src === 'tx') {
    const Sn = (+net.kVA || 1000) * 1000, uk = (+net.uk || 6) / 100, Zb = (Un * Un) / Sn;
    const ZT = uk * Zb;
    let RT: number;
    if (+net.pk > 0) {
      RT = (+net.pk * 1000 * Un * Un) / (Sn * Sn);
    } else {
      const rows = N.transformers.rows;
      const row = rows.reduce((a: any, b: any) => (Math.abs(b[0] - Sn / 1000) < Math.abs(a[0] - Sn / 1000) ? b : a), rows[0]);
      const [rr, xx] = net.txType === 'resin' ? [row[5], row[6]] : [row[2], row[3]];
      RT = ZT * (rr / Math.hypot(rr, xx));
    }
    const XT = Math.sqrt(Math.max(0, ZT * ZT - RT * RT));
    const KT = (0.95 * cfac.max) / (1 + 0.6 * (XT / Zb));
    const ZQ = (cfac.max * Un * Un) / ((+net.mva || 500) * 1e6), XQ = 0.995 * ZQ, RQ = 0.1 * XQ;
    const zT = cx(RT * KT, XT * KT), zQ = cx(RQ, XQ);
    const z1 = add(zT, zQ);
    const zE = mul(add(mul(z1, 2), zT), 1 / 3);
    return { z1, zE, KT, info: { ZT, RT, XT, KT, ZQ } };
  }
  const Ik = (+net.ik3 || 16) * 1000, xr = Math.max(0.01, +net.xr || 1);
  const Z = (cfac.max * Un) / (Math.sqrt(3) * Ik), R = Z / Math.sqrt(1 + xr * xr);
  const z1 = cx(R, R * xr);
  const zE = +net.ze > 0 ? mul(z1, +net.ze / Z) : z1;
  return { z1, zE, KT: 1, info: { Z, ZT: 0, RT: 0, XT: 0, ZQ: 0 } };
}

function u0Band(U0: number) {
  return U0 <= 127 ? '120' : U0 <= 242 ? '230' : U0 <= 400 ? '400' : 'inf';
}

export interface AnalyseParams {
  items: StudyItem[];
  dev: (id: string) => DeviceDef;
  E: any;
  N: any;
  net?: Partial<NetworkConfig>;
  baseKV: number;
}

export function analyse({ items, dev, E, N, net: netIn, baseKV }: AnalyseParams) {
  const net: NetworkConfig = { ...DEFAULT_NET, ...(netIn || {}) };
  const Un = +net.Un || 400, U0 = Un / Math.sqrt(3);
  const cfac = { max: N.voltageFactor.cmax[net.tol] || 1.05, min: N.voltageFactor.cmin[net.tol] || 0.95 };
  const src = sourceZ(N, net, cfac);
  const xpm = N.reactance.value / 1000;
  const isLV = (it: StudyItem) => Math.abs((+it.kV || baseKV) * 1000 - Un) / Un < 0.15;
  const byUid = new Map(items.map((i) => [i.uid, i]));
  const kids = new Map<number, StudyItem[]>();
  for (const i of items) {
    if (i.downOf && byUid.has(i.downOf)) {
      if (!kids.has(i.downOf)) kids.set(i.downOf, []);
      kids.get(i.downOf)!.push(i);
    }
  }
  const roots = items.filter((i) => !i.downOf || !byUid.has(i.downOf));
  const out: any[] = [];
  const res = new Map<number, any>();
  const ikFrom = (c: number, U: number, z: { r: number; x: number }) => (c * U) / mag(z);

  const origin = { z1: src.z1, zE: src.zE, zLN: src.zE, z1h: src.z1, zEh: src.zE, vd: 0, path: [] as number[] };

  const walk = (it: StudyItem, at: typeof origin, depth: number) => {
    const d = dev(it.deviceId);
    const r: any = { uid: it.uid, label: it.label, depth, path: at.path, lv: isLV(it), checks: [] };
    res.set(it.uid, r);
    out.push(r);
    if (!r.lv) {
      r.skip = `Outside the ${Un} V network (${it.kV} kV)`;
      for (const k of kids.get(it.uid) || []) walk(k, at, depth + 1);
      return;
    }
    const c = { ...DEFAULT_CABLE, ...(it.cab || {}) };
    r.ik3 = ikFrom(cfac.max, Un / Math.sqrt(3), at.z1);
    r.ik1 = ikFrom(cfac.max, U0, at.zE);
    r.ikLN = ikFrom(cfac.max, U0, at.zLN);
    r.ph = +c.ph === 1 ? 1 : 3;
    r.ireq = r.ph === 1 ? Math.max(r.ikLN, r.ik1) : Math.max(r.ik3, r.ikLN, r.ik1);

    const bc = breakingCapacity(d, it);
    r.bc = bc;
    if (d.model === 'rcd') {
      r.checks.push({ k: 'break', st: 'na', txt: 'No short-circuit breaking capacity — protect with the host / upstream breaker (conditional rating)' });
    } else if (d.model === 'idmt' || (d.model === 'custom' && !(+it.icuUser! > 0))) {
      r.checks.push({ k: 'break', st: 'na', txt: 'Enter the interrupting device’s breaking capacity' });
    } else if (!bc) {
      r.checks.push({ k: 'break', st: 'na', txt: 'No breaking capacity in the database — enter one' });
    } else {
      const need = r.ireq / 1000;
      const st = bc.icu >= need ? (bc.ics && bc.ics < need ? 'warn' : 'ok') : 'bad';
      r.checks.push({
        k: 'break',
        st,
        txt: st === 'bad'
          ? `Icu ${bc.icu} kA < ${need.toFixed(2)} kA — needs a higher breaking version or back-up (cascading) protection`
          : st === 'warn'
            ? `Icu ${bc.icu} kA ≥ ${need.toFixed(2)} kA, but Ics ${bc.ics!.toFixed(1)} kA is lower`
            : `Icu ${bc.icu} kA ≥ ${need.toFixed(2)} kA`,
      });
    }

    let end = at;
    if (c.on && +c.L > 0 && +c.S > 0) {
      const n = Math.max(1, +c.n || 1), L = +c.L, ins = N.insulation[c.ins];
      const Spe = +c.Spe > 0 ? +c.Spe : +c.S;
      const Rp = (r20(N, c.mat, +c.S) * L) / n, Rpe = (r20(N, c.mat, Spe) * L) / n, X = (xpm * L) / n;
      const Rph_h = (rT(N, c.mat, +c.S, ins.thetaMax) * L) / n, Rpe_h = (rT(N, c.mat, Spe, ins.thetaMax) * L) / n;
      const zc1 = cx(Rp, X), zcE = cx(Rp + Rpe, 2 * X), zcLN = cx(2 * Rp, 2 * X);
      end = {
        z1: add(at.z1, zc1),
        zE: add(at.zE, zcE),
        zLN: add(at.zLN, zcLN),
        z1h: add(at.z1h, cx(Rph_h, X)),
        zEh: add(at.zEh, cx(Rph_h + Rpe_h, 2 * X)),
        path: [...at.path, it.uid],
        vd: at.vd,
      };

      const pf = Math.min(1, Math.max(0.05, +c.pf || 0.85)), sin = Math.sqrt(1 - pf * pf), Ib = +c.Ib || 0;
      const du = r.ph === 3
        ? ((Math.sqrt(3) * Ib * (Rph_h * pf + X * sin)) / Un) * 100
        : ((2 * Ib * (Rph_h * pf + X * sin)) / U0) * 100;
      end.vd = at.vd + du;
      r.vd = end.vd;
      r.vdOwn = du;
      r.ik3End = ikFrom(cfac.max, Un / Math.sqrt(3), end.z1);

      const zEmin = net.earthing === 'TT' ? add(end.zEh, cx(+net.raRb || 0, 0)) : end.zEh;
      r.ik1Min = ikFrom(cfac.min, U0, zEmin);
      r.ik2Min = (cfac.min * Un) / (2 * mag(end.z1h));
      r.cable = { ...c, Spe, n };

      const In = settingCurrent(d, it), az = ampacity(N, c);
      r.In = In;
      r.Iz = az.Iz;
      r.ca = az.ca;
      if (az.Iz == null) {
        r.checks.push({ k: 'load', st: 'na', txt: `No tabulated ampacity for ${c.S} mm² ${c.mat} ${c.ins} method ${c.method} — enter Iz` });
      } else if (In == null) {
        r.checks.push({ k: 'load', st: Ib <= az.Iz ? 'ok' : 'bad', txt: `Ib ${Ib} A ${Ib <= az.Iz ? '≤' : '>'} Iz ${az.Iz.toFixed(0)} A (device has no overload setting)` });
      } else {
        const okA = Ib <= In + 1e-9, okB = d.model === 'rcd' ? true : In <= az.Iz + 1e-9;
        r.checks.push({
          k: 'load',
          st: okA && okB ? 'ok' : 'bad',
          txt: `Ib ${Ib} A ${okA ? '≤' : '>'} In ${+In.toFixed(1)} A ${d.model === 'rcd' ? '' : `${okB ? '≤' : '>'} Iz ${az.Iz.toFixed(0)} A`}`.trim(),
        });
      }
      const lim = +net.vdLimit || 5;
      r.checks.push({ k: 'vd', st: end.vd <= lim ? 'ok' : 'bad', txt: `ΔU ${end.vd.toFixed(2)} % at the circuit end (this cable ${du.toFixed(2)} %, limit ${lim} %)` });

      const ev = E.evaluate(d, it), ef = E.evaluateEF(d, it);
      const tPh = ev && !ev.none ? ev.hi(r.ik1Min) : INF, tEf = ef ? ef.hi(r.ik1Min) : INF;
      const t = Math.min(tPh, tEf);
      const hasKids = (kids.get(it.uid) || []).length > 0;
      const final = c.kind === 'final' || (c.kind === 'auto' && !hasKids && (In ?? INF) <= 63);
      const treq = final ? N.disconnection[net.earthing][u0Band(U0)] : N.disconnection.distribution[net.earthing];
      r.tDisc = t;
      r.tReq = treq;
      r.final = final;
      r.byRcd = tEf < tPh;
      r.checks.push({
        k: 'disc',
        st: t <= treq ? 'ok' : 'bad',
        txt: Number.isFinite(t)
          ? `Clears ${net.earthing === 'TT' ? 'earth fault' : 'L-PE fault'} ${fmtA(r.ik1Min)} in ≤ ${fmtS(t)}${r.byRcd ? ' (residual function)' : ''}; required ≤ ${treq} s (${final ? 'final' : 'distribution'} circuit)`
          : `Does not clear the minimum earth fault ${fmtA(r.ik1Min)} (required ≤ ${treq} s)`,
      });

      const kPE = (Spe > 300 && ins.kLarge ? ins.kLarge : ins.k)[c.mat];
      const kPh = (+c.S > 300 && ins.kLarge ? ins.kLarge : ins.k)[c.mat];
      const tAt = (I: number) => Math.min(ev && !ev.none ? ev.hi(I) : INF, ef ? ef.hi(I) : INF);
      const adi: any[] = [];
      for (const [I, S, k, who] of [
        [r.ik1Min, Spe * n, kPE, 'PE at min fault'],
        [r.ik1, Spe * n, kPE, 'PE at max fault'],
        [r.ik3, +c.S * n, kPh, 'phase at max fault'],
      ] as const) {
        const tt = tAt(I);
        if (!Number.isFinite(tt)) {
          adi.push({ who, st: 'bad', txt: `${who}: not cleared` });
          continue;
        }
        if (tt < 0.1) {
          adi.push({ who, st: 'info', txt: `${who}: t < 0.1 s, use the device’s let-through I²t` });
          continue;
        }
        const Smin = (I * Math.sqrt(tt)) / k;
        adi.push({ who, st: Smin <= S + 1e-9 ? 'ok' : 'bad', txt: `${who}: needs ${Smin.toFixed(1)} mm² (k ${k}, t ${fmtS(tt)}), has ${S} mm²` });
      }
      const worst = adi.some((a) => a.st === 'bad') ? 'bad' : adi.every((a) => a.st === 'info') ? 'info' : 'ok';
      r.checks.push({
        k: 'adiabatic',
        st: worst,
        txt: worst === 'info' ? 'All fault cases clear in < 0.1 s — confirm with the device’s let-through I²t (k²S² ≥ I²t)' : adi.map((a) => a.txt).join(' · '),
        parts: adi,
      });
    }
    const order: Record<string, number> = { bad: 3, warn: 2, ok: 1, info: 0, na: 0 };
    r.overall = r.checks.reduce((a: string, b: any) => (order[b.st] > order[a] ? b.st : a), 'na');
    for (const k of kids.get(it.uid) || []) walk(k, end, depth + 1);
  };

  for (const rt of roots) walk(rt, origin, 0);

  return {
    net,
    cfac,
    Un,
    U0,
    origin: { ik3: ikFrom(cfac.max, Un / Math.sqrt(3), src.z1), ik1: ikFrom(cfac.max, U0, src.zE), info: src.info },
    rows: out,
    byUid: res,
  };
}

export function fmtA(I: number): string {
  return I >= 1000 ? `${(I / 1000).toFixed(2)} kA` : `${I.toFixed(0)} A`;
}

export function fmtS(t: number): string {
  return t >= 1 ? `${t.toFixed(2)} s` : `${Math.round(t * 1000)} ms`;
}
