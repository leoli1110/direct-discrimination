import React, { useMemo } from 'react';
import { DeviceDef, StudyItem } from '../../types';
import * as E from '../../engine/engine';
import { DB } from '../../data/db';
import { colorFor } from './TccChart';

interface CoordinationSectionProps {
  studyItems: StudyItem[];
  customCurves: DeviceDef[];
  baseKV: number;
  faultKA: number;
  efKA: number;
  view: 'phase' | 'earth';
  efPhase: boolean;
  theme: 'light' | 'dark';
  onAutoChain: () => void;
}

const fmtT = (t: number) =>
  !Number.isFinite(t)
    ? '—'
    : t >= 100
    ? `${t.toFixed(0)} s`
    : t >= 1
    ? `${t.toFixed(2)} s`
    : t >= 0.1
    ? `${t.toFixed(3)} s`
    : `${(t * 1000).toFixed(0)} ms`;

const fmtI = (I: number) =>
  I >= 1e4
    ? `${(I / 1000).toFixed(1)} kA`
    : I >= 1000
    ? `${(I / 1000).toFixed(2)} kA`
    : I >= 10
    ? `${I.toFixed(0)} A`
    : I >= 1
    ? `${I.toFixed(2)} A`
    : `${+(I * 1000).toPrecision(3)} mA`;

const isEM = (d: DeviceDef) => d.model === 'idmt' && d.id.startsWith('cdg');

export const CoordinationSection: React.FC<CoordinationSectionProps> = ({
  studyItems,
  customCurves,
  baseKV,
  faultKA,
  efKA,
  view,
  efPhase,
  theme,
  onAutoChain,
}) => {
  const devMap = useMemo(() => {
    const map = new Map<string, DeviceDef>();
    for (const d of DB.devices) map.set(d.id, d);
    for (const d of customCurves) map.set(d.id, d);
    return map;
  }, [customCurves]);

  const curveOf = (it: StudyItem) => {
    const d = devMap.get(it.deviceId);
    if (!d) return null;
    if (view === 'earth') {
      const ef = E.evaluateEF(d, it);
      if (ef) return ef;
      if (!efPhase || !E.inPhaseView(d, it)) return null;
    } else if (!E.inPhaseView(d, it)) {
      return null;
    }
    const ev = E.evaluate(d, it);
    return ev.none ? null : ev;
  };

  const kScale = (it: StudyItem) => (it.kV || baseKV) / baseKV;
  const If = (view === 'earth' ? efKA : faultKA) * 1000;

  const pairs = useMemo(() => {
    return studyItems
      .filter((i) => i.downOf && studyItems.some((u) => u.uid === i.downOf))
      .map((dn) => ({
        dn,
        up: studyItems.find((u) => u.uid === dn.downOf)!,
      }))
      .filter(({ dn, up }) => curveOf(dn) && curveOf(up));
  }, [studyItems, view, efPhase, devMap, baseKV]);

  const rows = useMemo(() => {
    return pairs.map(({ up, dn }) => {
      const du = devMap.get(up.deviceId)!;
      const dd = devMap.get(dn.deviceId)!;
      const eu = curveOf(up)!;
      const ed = curveOf(dn)!;
      const ku = kScale(up);
      const kd = kScale(dn);
      const puR = (eu.pickup * ku) / (ed.pickup * kd);
      const X0 = 0.1;
      const lim = E.selectivity(eu, ku, ed, kd, Math.max(X0, ed.pickup * kd), Math.max(If, X0 * 10));

      let margin: number, need: number | null = null, mTxt: string;
      const relays = eu.isRelay;
      if (relays) {
        const tu = eu.nom ? eu.nom(If / ku) : eu.hi(If / ku);
        const td = ed.isRelay && ed.nom ? ed.nom(If / kd) : ed.hi(If / kd);
        margin = tu - td;
        need = isEM(du) || isEM(dd) ? 0.4 : 0.3;
        mTxt = Number.isFinite(margin)
          ? `Δt ${fmtT(margin)} (CTI ${need} s)`
          : !Number.isFinite(tu)
          ? 'upstream does not operate'
          : '—';
      } else {
        const tu = eu.lo(If / ku);
        const td = ed.hi(If / kd);
        margin = tu - td;
        mTxt = Number.isFinite(tu) && Number.isFinite(td)
          ? `down ≤ ${fmtT(td)} · up ≥ ${fmtT(tu)}`
          : !Number.isFinite(td)
          ? 'downstream does not clear'
          : 'upstream does not operate';
      }

      let res: string, cls: 'ok' | 'warn' | 'bad';
      if (puR < 1) {
        res = 'Upstream picks up first';
        cls = 'bad';
      } else if (relays && need !== null && Number.isFinite(margin) && margin < need) {
        res = margin > 0 ? `CTI short by ${fmtT(need - margin)}` : 'Overlap at If';
        cls = margin > 0 ? 'warn' : 'bad';
      } else if (lim === null) {
        res = relays ? 'Graded' : 'Selective (time-current)';
        cls = 'ok';
      } else if (lim < If) {
        const inst = eu.lo(lim / ku) <= 0.1;
        res = inst ? `Partial to ${fmtI(lim)} · check tables` : `Partial to ${fmtI(lim)}`;
        cls = 'warn';
      } else {
        res = 'Selective (time-current)';
        cls = 'ok';
      }

      return {
        up,
        dn,
        puR,
        lim,
        mTxt,
        res,
        cls,
      };
    });
  }, [pairs, If, baseKV, devMap]);

  return (
    <section className="analysis">
      <div className="an-head">
        <h2>
          Coordination check{' '}
          <span className="an-view" id="an-view">
            {view === 'earth' ? 'earth fault' : 'phase fault'}
          </span>
        </h2>
        <button
          className="btn small"
          id="btn-autochain"
          title="Link devices into an upstream→downstream chain ordered by pick-up current"
          onClick={onAutoChain}
        >
          Auto-chain by pick-up
        </button>
      </div>

      <div className="table-scroll">
        <table className="grid-table" id="sel-table">
          <thead>
            <tr>
              <th>Upstream</th>
              <th>Downstream</th>
              <th>Pick-up ratio</th>
              <th>Selective up to</th>
              <th>At {view === 'earth' ? 'earth fault' : 'fault'} {fmtI(If)}</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={6}>
                  {view === 'earth'
                    ? 'No linked pair has an earth-fault characteristic on both devices. Link RCBOs, RCDs, trip units with G or earth-fault relays with “Downstream of”, or tick “Phase devices too”.'
                    : 'Link devices with “Downstream of” on each card, or use Auto-chain.'}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <span className="swatch" style={{ background: colorFor(r.up, theme) }} /> {r.up.label}
                  </td>
                  <td>
                    <span className="swatch" style={{ background: colorFor(r.dn, theme) }} /> {r.dn.label}
                  </td>
                  <td className="num">{r.puR.toFixed(2)}</td>
                  <td className="num">{r.lim === null ? `≥ ${fmtI(If)}` : fmtI(r.lim)}</td>
                  <td className="num">{r.mTxt}</td>
                  <td>
                    <span className={`badge ${r.cls}`}>{r.res}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="fine">
        Time-current selectivity limit is the lowest current where the downstream device's latest clearing time reaches the upstream device's earliest operating time. Relay grading uses the CTI from{' '}
        <a href="https://ecalpro.com/docs/protection-coordination-methodology" target="_blank" rel="noopener noreferrer">
          ECalPro's IEC 60255 methodology
        </a>{' '}
        (0.4 s electromechanical, 0.3 s numerical). When both devices are in their instantaneous region, energy-based selectivity needs the manufacturer's selectivity tables.
      </p>
    </section>
  );
};
