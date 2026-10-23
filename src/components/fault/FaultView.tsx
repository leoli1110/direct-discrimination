import React, { useMemo } from 'react';
import { DeviceDef, NetworkConfig, StudyItem, StudyItemCable } from '../../types';
import * as F from '../../engine/fault';
import { DB } from '../../data/db';
import { colorFor } from '../study/TccChart';

interface FaultViewProps {
  studyItems: StudyItem[];
  customCurves: DeviceDef[];
  net: NetworkConfig;
  baseKV: number;
  theme: 'light' | 'dark';
  onUpdateNet: (updates: Partial<NetworkConfig>) => void;
  onUpdateItem: (uid: number, updates: Partial<StudyItem>) => void;
  onSetChartOriginLevels: (ik3KA: number, ik1KA: number) => void;
  faultAnalysisData: any;
}

const BADGE: Record<string, string> = { ok: 'Pass', warn: 'Check', bad: 'Fail', na: 'n/a', info: 'Note' };
const CHECK_NAME: Record<string, string> = {
  break: 'Breaking capacity',
  load: 'Ib ≤ In ≤ Iz',
  vd: 'Voltage drop',
  disc: 'Disconnection',
  adiabatic: 'Withstand',
};

const fmtKA = (I: number | null | undefined) => (I == null || !Number.isFinite(I) ? '—' : F.fmtA(I));
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

export const FaultView: React.FC<FaultViewProps> = ({
  studyItems,
  customCurves,
  net,
  theme,
  onUpdateNet,
  onUpdateItem,
  onSetChartOriginLevels,
  faultAnalysisData,
}) => {
  const devMap = useMemo(() => {
    const map = new Map<string, DeviceDef>();
    for (const d of DB.devices) map.set(d.id, d);
    for (const d of customCurves) map.set(d.id, d);
    return map;
  }, [customCurves]);

  const fa = faultAnalysisData;
  const o = fa.origin;
  const rows = fa.rows || [];
  const N = DB.network;

  const handleUseOriginLevels = () => {
    const ik3KA = +(o.ik3 / 1000).toFixed(2);
    const ik1KA = +(o.ik1 / 1000).toFixed(2);
    onSetChartOriginLevels(ik3KA, ik1KA);
  };

  const updateCable = (item: StudyItem, key: keyof StudyItemCable, val: any) => {
    const prevCab = { ...F.DEFAULT_CABLE, ...(item.cab || {}) };
    const nextCab: StudyItemCable = { ...prevCab, [key]: key === 'ph' ? +val : val };
    if (key === 'mat') {
      const sz = F.cableSizes(N, nextCab.mat);
      if (!sz.includes(+nextCab.S)) nextCab.S = sz.find((x) => x >= +nextCab.S) || sz[sz.length - 1];
      if (!sz.includes(+nextCab.Spe)) nextCab.Spe = nextCab.S;
    }
    if (key === 'S' && +nextCab.Spe > +nextCab.S) {
      nextCab.Spe = +nextCab.S;
    }
    onUpdateItem(item.uid, { cab: nextCab });
  };

  return (
    <main className="view fault">
      <aside className="panel fa-source" aria-label="Supply">
        <div className="panel-head">
          <h2>Supply</h2>
        </div>
        <div className="fa-form">
          <div className="seg" role="group" aria-label="Source type">
            <button
              type="button"
              className="seg-btn"
              aria-pressed={net.src === 'tx'}
              onClick={() => onUpdateNet({ src: 'tx' })}
            >
              Transformer
            </button>
            <button
              type="button"
              className="seg-btn"
              aria-pressed={net.src === 'supply'}
              onClick={() => onUpdateNet({ src: 'supply' })}
            >
              Known fault level
            </button>
          </div>

          {net.src === 'tx' && (
            <div className="fa-grid src-tx">
              <label className="ctl">
                Rating (kVA)
                <input
                  type="number"
                  min="25"
                  step="any"
                  value={net.kVA}
                  onChange={(e) => onUpdateNet({ kVA: +e.target.value || 0 })}
                />
              </label>
              <label className="ctl">
                Impedance uk (%)
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="any"
                  value={net.uk}
                  onChange={(e) => onUpdateNet({ uk: +e.target.value || 0 })}
                />
              </label>
              <label className="ctl">
                Load losses (kW)
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="typical"
                  value={net.pk}
                  onChange={(e) => onUpdateNet({ pk: e.target.value === '' ? '' : +e.target.value })}
                />
              </label>
              <label className="ctl">
                Construction
                <select
                  value={net.txType}
                  onChange={(e) => onUpdateNet({ txType: e.target.value as 'oil' | 'resin' })}
                >
                  <option value="oil">Oil-immersed</option>
                  <option value="resin">Cast resin</option>
                </select>
              </label>
              <label className="ctl wide">
                Upstream MV fault level (MVA)
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={net.mva}
                  onChange={(e) => onUpdateNet({ mva: +e.target.value || 0 })}
                />
              </label>
            </div>
          )}

          {net.src === 'supply' && (
            <div className="fa-grid src-supply">
              <label className="ctl">
                Ik3 at origin (kA)
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={net.ik3}
                  onChange={(e) => onUpdateNet({ ik3: +e.target.value || 0 })}
                />
              </label>
              <label className="ctl">
                X/R at origin
                <input
                  type="number"
                  min="0.05"
                  step="any"
                  value={net.xr}
                  onChange={(e) => onUpdateNet({ xr: +e.target.value || 0 })}
                />
              </label>
              <label className="ctl wide">
                External loop impedance Ze (Ω)
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="same as phase source"
                  value={net.ze}
                  onChange={(e) => onUpdateNet({ ze: e.target.value === '' ? '' : +e.target.value })}
                />
              </label>
            </div>
          )}

          <div className="fa-grid">
            <label className="ctl">
              Nominal voltage (V)
              <input
                type="number"
                min="100"
                max="1000"
                step="any"
                value={net.Un}
                onChange={(e) => onUpdateNet({ Un: +e.target.value || 400 })}
              />
            </label>
            <label className="ctl">
              Voltage tolerance
              <select
                value={net.tol}
                onChange={(e) => onUpdateNet({ tol: e.target.value as '6' | '10' })}
              >
                <option value="6">+6 % (cmax 1.05)</option>
                <option value="10">+10 % (cmax 1.10)</option>
              </select>
            </label>
            <label className="ctl">
              Earthing system
              <select
                value={net.earthing}
                onChange={(e) => onUpdateNet({ earthing: e.target.value as 'TN' | 'TT' })}
              >
                <option value="TN">TN-S / TN-C-S</option>
                <option value="TT">TT</option>
              </select>
            </label>
            {net.earthing === 'TT' && (
              <label className="ctl src-tt">
                RA + RB (Ω)
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={net.raRb}
                  onChange={(e) => onUpdateNet({ raRb: +e.target.value || 0 })}
                />
              </label>
            )}
            <label className="ctl">
              Voltage-drop limit (%)
              <input
                type="number"
                min="0.5"
                max="20"
                step="any"
                value={net.vdLimit}
                onChange={(e) => onUpdateNet({ vdLimit: +e.target.value || 5 })}
              />
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={net.mark}
                onChange={(e) => onUpdateNet({ mark: e.target.checked })}
              />{' '}
              Mark fault levels on the chart
            </label>
          </div>

          <div className="fa-origin" id="fa-origin">
            <div className="fa-stat">
              <b>{fmtKA(o.ik3)}</b>
              <span>Ik3 max at origin</span>
            </div>
            <div className="fa-stat">
              <b>{fmtKA(o.ik1)}</b>
              <span>Ik1 max (L-PE) at origin</span>
            </div>
            {net.src === 'tx' && (
              <div className="fa-stat wide">
                <span>
                  Transformer Z {(o.info.ZT * 1000).toFixed(2)} mΩ (R {(o.info.RT * 1000).toFixed(2)}, X{' '}
                  {(o.info.XT * 1000).toFixed(2)}), KT {o.info.KT.toFixed(3)}; MV network {(o.info.ZQ * 1000).toFixed(2)} mΩ
                </span>
              </div>
            )}
          </div>

          <button className="btn small" id="fa-to-chart" type="button" onClick={handleUseOriginLevels}>
            Use origin levels for the chart markers
          </button>
        </div>
      </aside>

      <section className="fa-main">
        <div className="fa-head">
          <h1>Fault analysis</h1>
          <p className="lead">
            The network follows the study's “Downstream of” links. Each device sits at the end of its upstream device's cable. Enter the cable each device feeds to get the maximum fault current at every device, check its breaking capacity, and check the circuit for disconnection time, conductor withstand, current-carrying capacity and voltage drop.
          </p>
        </div>

        <div className="table-scroll">
          <table className="grid-table fa-table" id="fa-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Max fault at device</th>
                <th>Breaking capacity</th>
                <th>Circuit</th>
                <th>Ib / In / Iz</th>
                <th>ΔU at end</th>
                <th>Min fault at end</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={8}>
                    Add devices on the Study tab and link them with “Downstream of”.
                  </td>
                </tr>
              ) : (
                rows.map((r: any) => {
                  const it = studyItems.find((i) => i.uid === r.uid);
                  if (!it) return null;
                  const ind = r.depth ? <span className="indent">{'· '.repeat(r.depth)}</span> : null;
                  const nameCell = (
                    <td className="dev">
                      {ind}
                      <span className="swatch" style={{ background: colorFor(it, theme) }} /> {r.label}
                    </td>
                  );

                  if (!r.lv) {
                    return (
                      <tr key={r.uid}>
                        {nameCell}
                        <td colSpan={7} className="sub">
                          {r.skip}
                        </td>
                      </tr>
                    );
                  }

                  const b = r.checks.find((c: any) => c.k === 'break');
                  const l = r.checks.find((c: any) => c.k === 'load');
                  const v = r.checks.find((c: any) => c.k === 'vd');
                  const d = r.checks.find((c: any) => c.k === 'disc');
                  const c = r.cable;

                  return (
                    <tr key={r.uid}>
                      {nameCell}
                      <td className="num">
                        <b className="nw">{fmtKA(r.ireq)}</b>
                        <span className="sub">
                          Ik3 {fmtKA(r.ik3)}
                          <br />
                          Ik1 {fmtKA(r.ik1)}
                        </span>
                      </td>
                      <td className="num">
                        {b ? <span className={`badge ${b.st}`}>{BADGE[b.st]}</span> : <span className="badge na">—</span>}
                        <span className="sub">{r.bc ? r.bc.label : '—'}</span>
                      </td>
                      <td className="circ">
                        {c ? (
                          <>
                            <span className="nw">
                              {c.n > 1 ? c.n + '× ' : ''}
                              {c.S}/{c.Spe} mm²
                            </span>{' '}
                            {c.mat} {c.ins}
                            <span className="sub">
                              {c.L} m, {c.ph === 1 ? '1-ph' : '3-ph'}, method {c.method}
                              {r.final ? ', final' : ''}
                            </span>
                          </>
                        ) : (
                          <span className="sub">no cable entered</span>
                        )}
                      </td>
                      <td className="num">
                        {c ? (
                          <>
                            {l ? <span className={`badge ${l.st}`}>{BADGE[l.st]}</span> : null}
                            <span className="sub">
                              {c.Ib || 0} / {r.In != null ? +r.In.toFixed(1) : '—'} /{' '}
                              {r.Iz != null ? r.Iz.toFixed(0) : '—'} A
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num">
                        {c ? (
                          <>
                            {v ? <span className={`badge ${v.st}`}>{BADGE[v.st]}</span> : null}
                            <span className="sub">{r.vd.toFixed(2)} %</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num">
                        {c ? (
                          <>
                            {d ? <span className={`badge ${d.st}`}>{BADGE[d.st]}</span> : null}
                            <span className="sub">
                              {fmtKA(r.ik1Min)} → {Number.isFinite(r.tDisc) ? fmtT(r.tDisc) : 'not cleared'}
                              <br />
                              required ≤ {r.tReq} s
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className={`badge ${r.overall}`}>
                          {r.overall === 'na' ? 'Incomplete' : BADGE[r.overall]}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <h2 className="mt">Circuits</h2>
        <div className="fa-cards" id="fa-cards">
          {rows.map((r: any) => {
            const it = studyItems.find((i) => i.uid === r.uid);
            if (!it) return null;
            const d = devMap.get(it.deviceId)!;
            const head = (
              <header>
                <span className="swatch" style={{ background: colorFor(it, theme) }} />
                <h3>{r.label}</h3>
                <span className="mono sub">{r.lv ? fmtKA(r.ireq) : ''}</span>
              </header>
            );

            if (!r.lv) {
              return (
                <article key={r.uid} className="fa-card">
                  {head}
                  <p className="fa-skip">{r.skip}. Fault analysis covers the {fa.Un} V network.</p>
                </article>
              );
            }

            const c = { ...F.DEFAULT_CABLE, ...(it.cab || {}) };
            const sizes = F.cableSizes(N, c.mat);
            const bcOpts = d.bc?.options || [];

            return (
              <article key={r.uid} className="fa-card">
                {head}
                <div className="fa-body">
                  <div>
                    <h4>Breaking capacity</h4>
                    <div className="fa-ctls">
                      {bcOpts.length > 0 && (
                        <label className="ctl w2">
                          Breaking version
                          <select
                            value={it.bcCode || bcOpts[0]?.code}
                            onChange={(e) => onUpdateItem(it.uid, { bcCode: e.target.value })}
                          >
                            {bcOpts.map((x) => (
                              <option key={x.code} value={x.code}>
                                {x.code}
                                {x.icuBy ? ` — ${F.breakingCapacity(d, { ...it, bcCode: x.code, icuUser: '' })?.icu} kA at ${it.In} A` : ''}
                                {x.basis === 'assumed' ? ' (assumed)' : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className={`ctl ${bcOpts.length ? '' : 'w2'}`}>
                        Icu entered (kA)
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={it.icuUser ?? ''}
                          placeholder={bcOpts.length ? 'from list' : 'enter'}
                          onChange={(e) => onUpdateItem(it.uid, { icuUser: e.target.value === '' ? '' : +e.target.value })}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <h4>Outgoing circuit</h4>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={c.on}
                        onChange={(e) => updateCable(it, 'on', e.target.checked)}
                      />{' '}
                      This device feeds a cable
                    </label>

                    {c.on && (
                      <div className="fa-ctls">
                        <label className="ctl">
                          Conductor
                          <select
                            value={c.mat}
                            onChange={(e) => updateCable(it, 'mat', e.target.value as 'Cu' | 'Al')}
                          >
                            <option value="Cu">Copper</option>
                            <option value="Al">Aluminium</option>
                          </select>
                        </label>

                        <label className="ctl">
                          Insulation
                          <select
                            value={c.ins}
                            onChange={(e) => updateCable(it, 'ins', e.target.value as 'PVC' | 'XLPE')}
                          >
                            <option value="PVC">PVC 70 °C</option>
                            <option value="XLPE">XLPE 90 °C</option>
                          </select>
                        </label>

                        <label className="ctl w2">
                          Installation
                          <select
                            value={c.method}
                            onChange={(e) => updateCable(it, 'method', e.target.value)}
                          >
                            {Object.keys(N.ampacity.methods).map((k) => (
                              <option key={k} value={k}>
                                {N.ampacity.methods[k]}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="ctl">
                          Phase (mm²)
                          <select
                            value={c.S}
                            onChange={(e) => updateCable(it, 'S', +e.target.value)}
                          >
                            {sizes.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="ctl">
                          PE (mm²)
                          <select
                            value={c.Spe}
                            onChange={(e) => updateCable(it, 'Spe', +e.target.value)}
                          >
                            {sizes.filter((s) => s <= +c.S).map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="ctl">
                          Length (m)
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={c.L}
                            onChange={(e) => updateCable(it, 'L', +e.target.value || 0)}
                          />
                        </label>

                        <label className="ctl">
                          Parallel runs
                          <input
                            type="number"
                            min="1"
                            max="12"
                            step="1"
                            value={c.n}
                            onChange={(e) => updateCable(it, 'n', Math.max(1, +e.target.value || 1))}
                          />
                        </label>

                        <label className="ctl">
                          Circuit
                          <select
                            value={c.ph}
                            onChange={(e) => updateCable(it, 'ph', +e.target.value as 1 | 3)}
                          >
                            <option value={3}>3-phase</option>
                            <option value={1}>1-phase</option>
                          </select>
                        </label>

                        <label className="ctl">
                          Load Ib (A)
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={c.Ib}
                            onChange={(e) => updateCable(it, 'Ib', +e.target.value || 0)}
                          />
                        </label>

                        <label className="ctl">
                          Power factor
                          <input
                            type="number"
                            min="0.05"
                            max="1"
                            step="0.01"
                            value={c.pf}
                            onChange={(e) => updateCable(it, 'pf', +e.target.value || 0.85)}
                          />
                        </label>

                        <label className="ctl">
                          Circuit type
                          <select
                            value={c.kind}
                            onChange={(e) => updateCable(it, 'kind', e.target.value as any)}
                          >
                            <option value="auto">Auto</option>
                            <option value="final">Final</option>
                            <option value="distribution">Distribution</option>
                          </select>
                        </label>

                        <label className="ctl">
                          Ambient (°C)
                          <input
                            type="number"
                            min="-10"
                            max="80"
                            step="1"
                            value={c.amb}
                            onChange={(e) => updateCable(it, 'amb', +e.target.value || 30)}
                          />
                        </label>

                        <label className="ctl">
                          Grouping factor
                          <input
                            type="number"
                            min="0.1"
                            max="1.2"
                            step="0.01"
                            value={c.kf}
                            onChange={(e) => updateCable(it, 'kf', +e.target.value || 1)}
                          />
                        </label>

                        <label className="ctl w2">
                          Iz entered (A)
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="from table"
                            value={c.Iz}
                            onChange={(e) => updateCable(it, 'Iz', e.target.value === '' ? '' : +e.target.value)}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4>Results</h4>
                    <p className="sub mono">
                      At device: Ik3 {fmtKA(r.ik3)} · Ik1 {fmtKA(r.ik1)} · L-N {fmtKA(r.ikLN)}
                      {c.on && r.ik1Min
                        ? ` | Circuit end: Ik3 ${fmtKA(r.ik3End)} · Ik1 min ${fmtKA(r.ik1Min)} · Ik2 min ${fmtKA(r.ik2Min)}`
                        : ''}
                    </p>
                    <ul className="fa-checks">
                      {r.checks.map((x: any, idx: number) => (
                        <li key={idx}>
                          <span className={`badge ${x.st}`}>{CHECK_NAME[x.k]}</span>
                          <span>{x.txt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <p className="fine" id="fa-notes">
          Maximum currents use cmax {fa.cfac.max} and conductor resistance at 20 °C; minimum currents use cmin {fa.cfac.min} and resistance at the insulation's maximum operating temperature (
          <a href={DB.sources['iec60909_c']?.url} target="_blank" rel="noopener noreferrer">
            IEC 60909-0 voltage factors
          </a>
          ,{' '}
          <a href={DB.sources['iec60228']?.url} target="_blank" rel="noopener noreferrer">
            IEC 60228 resistances
          </a>
          ,{' '}
          <a href={DB.sources['eig_isc']?.url} target="_blank" rel="noopener noreferrer">
            reactance 0.08 mΩ/m
          </a>
          ). Disconnection times follow{' '}
          <a href={DB.sources['iec60364_41']?.url} target="_blank" rel="noopener noreferrer">
            IEC 60364-4-41 Table 41.1
          </a>
          ; ampacity follows{' '}
          <a href={DB.sources['iec60364_552_pvc']?.url} target="_blank" rel="noopener noreferrer">
            IEC 60364-5-52
          </a>{' '}
          via{' '}
          <a href={DB.sources['nbr5410_ampacity']?.url} target="_blank" rel="noopener noreferrer">
            NBR 5410 tables
          </a>
          ; k values follow{' '}
          <a href={DB.sources['bs7671_k']?.url} target="_blank" rel="noopener noreferrer">
            BS 7671 Table 54.3
          </a>
          .
        </p>
      </section>
    </main>
  );
};
