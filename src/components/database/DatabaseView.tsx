import React, { useMemo, useState } from 'react';
import { DeviceDef } from '../../types';
import { DB } from '../../data/db';

export const DatabaseView: React.FC = () => {
  const [search, setSearch] = useState('');

  const brands = useMemo(() => {
    return new Set(DB.devices.map((d) => d.manufacturer.split(' (')[0]));
  }, []);

  const basisLegend = useMemo(() => {
    return Object.entries(DB.meta.basisLegend).filter(([k]) => k !== 'user');
  }, []);

  const keyRanges = (d: DeviceDef) => {
    const mA = (v: number) => (v >= 1000 ? `${v / 1000} A` : `${v} mA`);
    const rc = d.rcd
      ? ` · IΔn ${d.rcd.idn.map(mA).join('/')} type ${d.rcd.types.join('/')}${d.rcd.classes.length > 1 ? ` (${d.rcd.classes.join('/')})` : ''}`
      : '';
    const g = d.G
      ? (() => {
          const v = d.G.ig.steps ? d.G.ig.steps.filter((x: number) => x > 0) : [d.G.ig.min, d.G.ig.max];
          const t = d.G.tg.steps || [d.G.tg.min, d.G.tg.max];
          return ` · G ${v[0]}–${v[v.length - 1]}×In, tg ${t[0]}–${t[t.length - 1]} s`;
        })()
      : '';
    if (d.model === 'rcd') return rc.slice(3);
    if (d.model === 'mcb') return Object.entries(d.curves || {}).map(([k, v]) => `${k} ${v.lo}–${v.hi}×In`).join(', ') + rc;
    if (d.model === 'tm') return `Ir ${d.ir?.steps ? d.ir.steps.join('/') : `${d.ir?.min}–${d.ir?.max}`}×In`;
    if (d.model === 'etu') return `L ${d.L.form === 'thermal-image' ? 'thermal image' : 'I²t'} @${d.L.ref}×Ir${d.S ? ' · S' : ''}${d.I ? ' · I' : ''}${g}`;
    return Object.entries(d.curves || {})
      .map(([k, v]) => `${k}: k=${v.k}, α=${v.alpha}${v.L ? `, B=${v.L}` : ''}${v.scale && v.scale !== 1 ? `, ×${v.scale}` : ''}`)
      .join('; ');
  };

  const basisTags = (d: DeviceDef) => {
    const b = new Set<string>();
    const walk = (o: any) => {
      if (o && typeof o === 'object') {
        for (const [k, v] of Object.entries(o)) {
          if (/basis$/i.test(k) && typeof v === 'string') b.add(v);
          else walk(v);
        }
      }
    };
    walk(d);
    if (d.tolBasis) b.add(d.tolBasis);
    return [...b].filter((x) => x !== 'user');
  };

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return DB.devices;
    return DB.devices.filter((d) => JSON.stringify(d).toLowerCase().includes(q));
  }, [search]);

  return (
    <main className="view database">
      <div className="db-head">
        <div>
          <h1>
            Curve database <span className="mono">v{DB.meta.version}</span>
          </h1>
          <p className="lead">
            {DB.devices.length} device families across {[...brands].filter((b) => !b.startsWith('Generic')).length} manufacturers plus generic IEC / IEEE standards, built from {Object.keys(DB.sources).length} published documents (accessed {DB.meta.built}). Every value is tagged with its basis.
          </p>
        </div>
        <div className="db-actions">
          <input
            type="search"
            placeholder="Filter entries…"
            aria-label="Filter database"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <a className="btn" href="/db/curvedb.json" download="curvedb-2026.json">
            Download JSON
          </a>
        </div>
      </div>

      <div className="legend-basis">
        {basisLegend.map(([k, v]) => (
          <span key={k}>
            <span className={`tag ${k}`}>{k}</span>
            {v}
          </span>
        ))}
      </div>

      <div className="table-scroll">
        <table className="grid-table db-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Manufacturer</th>
              <th>Series</th>
              <th>Standard</th>
              <th>Ratings</th>
              <th>Characteristic</th>
              <th>Basis</th>
              <th>Datasheet notes</th>
              <th>Sources</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.category}</td>
                <td>{d.manufacturer}</td>
                <td className="series">{d.series}</td>
                <td>
                  {d.standard}
                  {d.refTempC && (
                    <>
                      <br />
                      <span className="mono">{d.refTempC} °C ref.</span>
                    </>
                  )}
                </td>
                <td className="num">
                  {d.ratings ? (
                    <>
                      {d.ratings[0]}–{d.ratings[d.ratings.length - 1]} A
                      <br />
                      <span className="mono" style={{ color: 'var(--faint)' }}>
                        {d.ratings.length} ratings
                      </span>
                    </>
                  ) : (
                    `CT ${d.ctSec?.join('/')} A`
                  )}
                </td>
                <td>{keyRanges(d)}</td>
                <td>
                  {basisTags(d).map((t) => (
                    <span key={t} className={`tag ${t}`}>
                      {t}
                    </span>
                  ))}
                </td>
                <td className="notes">
                  {d.notes}
                  {d.breaking && (
                    <>
                      <br />
                      <b>Breaking:</b> {d.breaking}
                    </>
                  )}
                </td>
                <td className="src">
                  {d.sources.map((s, idx) => (
                    <a
                      key={idx}
                      href={DB.sources[s]?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {DB.sources[s]?.title.slice(0, 42)}
                      {DB.sources[s]?.title.length > 42 ? '…' : ''}
                    </a>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt">Sources</h2>
      <ol className="sources">
        {Object.entries(DB.sources).map(([k, s]) => (
          <li key={k}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
            </a>{' '}
            — {s.publisher}{' '}
            <span>
              {k} · accessed {s.accessed}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
};
