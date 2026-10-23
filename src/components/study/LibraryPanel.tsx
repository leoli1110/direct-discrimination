import React, { useMemo, useState } from 'react';
import { DeviceDef, StudyItem } from '../../types';
import { DB } from '../../data/db';
import * as E from '../../engine/engine';

interface LibraryPanelProps {
  customCurves: DeviceDef[];
  studyItems: StudyItem[];
  onAddDevice: (deviceId: string) => void;
  onOpenCustomCurveModal: (def?: DeviceDef) => void;
  onForgetCurve: (id: string) => void;
  onLoadPointsFile: (file: File) => void;
}

const CC_TYPES: Record<string, string> = {
  FUSE: 'Fuse',
  MCB: 'MCB',
  MCCB: 'MCCB',
  ACB: 'ACB',
  RELAY: 'Relay',
  DAMAGE: 'Damage / withstand',
  EARTH: 'Earth fault / RCD',
  OTHER: 'Other',
};

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

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  customCurves,
  studyItems,
  onAddDevice,
  onOpenCustomCurveModal,
  onForgetCurve,
  onLoadPointsFile,
}) => {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<'ALL' | 'MCB' | 'MCCB' | 'ACB' | 'RCBO' | 'RELAY' | 'CUSTOM'>('ALL');
  const [brand, setBrand] = useState('');

  const brands = useMemo(() => {
    const list = [...new Set(DB.devices.map((d) => d.manufacturer))].sort(
      (a, b) => (a.startsWith('Generic') ? 1 : 0) - (b.startsWith('Generic') ? 1 : 0) || a.localeCompare(b)
    );
    return list;
  }, []);

  const devMeta = (d: DeviceDef) => {
    const mA = (v: number) => (v >= 1000 ? `${v / 1000} A` : `${v} mA`);
    const rc = d.rcd ? ` · ${d.rcd.idn.map(mA).join('/')}` : '';
    if (d.model === 'rcd') {
      return `Residual only · ${d.ratings?.[0]}–${d.ratings?.[d.ratings.length - 1]} A${rc}`;
    }
    if (d.model === 'mcb') {
      return `${Object.keys(d.curves || {}).join(' · ')} curves · ${d.ratings?.[0]}–${d.ratings?.[d.ratings.length - 1]} A${rc}`;
    }
    if (d.model === 'tm') {
      return `Thermal-magnetic · ${d.ratings?.[0]}–${d.ratings?.[d.ratings.length - 1]} A`;
    }
    if (d.model === 'etu') {
      return `Electronic ${d.S ? 'LSI' : 'LI'}${d.G ? '(G)' : ''} · ${d.ratings?.[0]}–${d.ratings?.[d.ratings.length - 1]} A`;
    }
    if (d.model === 'custom') {
      const p = E.sortPts(d.points || []);
      return `${CC_TYPES[d.category] || 'Custom'} · ${p.length} points${d.mode === 'band' ? ' · band' : ''}${
        p.length ? ` · ${fmtI(p[0].I * (d.unit === 'x' ? d.base || 1 : 1))}–${fmtI(p[p.length - 1].I * (d.unit === 'x' ? d.base || 1 : 1))}` : ''
      }`;
    }
    return `IDMT · ${Object.keys(d.curves || {}).map((k) => k.split(' ')[0]).join(' · ')}`;
  };

  const mine = useMemo(() => {
    return customCurves.filter((d) => d.saved || studyItems.some((i) => i.deviceId === d.id));
  }, [customCurves, studyItems]);

  const list = useMemo(() => {
    const q = search.toLowerCase();
    return DB.devices.filter(
      (d) =>
        (cat === 'ALL' || d.category === cat) &&
        (!brand || d.manufacturer === brand) &&
        (!q ||
          `${d.manufacturer} ${d.series} ${d.standard} ${Object.keys(d.curves || {}).join(' ')} ${d.category}`
            .toLowerCase()
            .includes(q))
    );
  }, [search, cat, brand]);

  const myList = useMemo(() => {
    const q = search.toLowerCase();
    return mine.filter(
      (d) =>
        (cat === 'ALL' || cat === 'CUSTOM') &&
        !brand &&
        (!q || `${d.series} ${CC_TYPES[d.category] || ''} custom`.toLowerCase().includes(q))
    );
  }, [mine, cat, brand, search]);

  const groups = useMemo(() => {
    const map: Record<string, DeviceDef[]> = {};
    for (const d of list) {
      if (!map[d.category]) map[d.category] = [];
      map[d.category].push(d);
    }
    return map;
  }, [list]);

  const categoryNames: Record<string, string> = {
    MCB: 'Miniature circuit breakers',
    RCBO: 'RCBOs and RCDs (residual current)',
    MCCB: 'Moulded-case circuit breakers',
    ACB: 'Air circuit breakers',
    RELAY: 'Overcurrent relays (IDMT)',
  };

  return (
    <aside className="panel library" aria-label="Device library">
      <div className="panel-head">
        <h2>Library</h2>
        <span className="count" id="lib-count">
          {list.length + myList.length} / {DB.devices.length + mine.length}
        </span>
      </div>

      <div className="lib-filters">
        <input
          type="search"
          placeholder="Search series, brand, curve…"
          aria-label="Search library"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="chips" role="group" aria-label="Category">
          {(['ALL', 'MCB', 'MCCB', 'ACB', 'RCBO', 'RELAY', 'CUSTOM'] as const).map((c) => (
            <button
              key={c}
              className="chip"
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
            >
              {c === 'ALL' ? 'All' : c === 'CUSTOM' ? 'My curves' : c === 'RELAY' ? 'Relay' : c}
            </button>
          ))}
        </div>
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          aria-label="Manufacturer"
        >
          <option value="">All manufacturers</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="lib-custom">
        <button
          className="btn small"
          title="Define a curve from current–time points"
          onClick={() => onOpenCustomCurveModal()}
        >
          + Custom curve
        </button>
        <label
          className="btn small ghost"
          title="Load a points list (.txt / .csv) as a new custom curve"
        >
          Load points
          <input
            type="file"
            accept=".txt,.csv,.tsv,text/plain,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                onLoadPointsFile(f);
                e.target.value = '';
              }
            }}
          />
        </label>
      </div>

      <div className="lib-list" id="lib-list">
        {myList.length > 0 && (
          <div className="lib-group">
            <h3>My curves</h3>
            {myList.map((d) => (
              <div
                key={d.id}
                className="lib-item"
                role="button"
                tabIndex={0}
                title="Add to study"
                onClick={() => onAddDevice(d.id)}
              >
                <span className="li-name">{d.series}</span>
                <span className="li-add" aria-hidden="true">+</span>
                <span className="li-meta">
                  {devMeta(d)}
                  {d.saved ? '' : ' · this study only'}
                </span>
                <span className="li-edit" onClick={(e) => e.stopPropagation()}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenCustomCurveModal(d)}
                  >
                    Edit
                  </span>
                  {d.saved && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => onForgetCurve(d.id)}
                    >
                      Remove
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {cat === 'CUSTOM' && myList.length === 0 && (
          <p className="study-empty">
            No custom curves yet. Use “+ Custom curve” to enter current–time points, paste a list or load a .txt / .csv file.
          </p>
        )}

        {['MCB', 'RCBO', 'MCCB', 'ACB', 'RELAY'].map((g) => {
          const groupDevices = groups[g];
          if (!groupDevices || !groupDevices.length) return null;
          return (
            <div key={g} className="lib-group">
              <h3>{categoryNames[g]}</h3>
              {groupDevices.map((d) => (
                <button
                  key={d.id}
                  className="lib-item"
                  title="Add to study"
                  onClick={() => onAddDevice(d.id)}
                >
                  <span className="li-name">
                    {d.manufacturer.startsWith('Generic')
                      ? d.series
                      : `${d.manufacturer.replace(' Electric', '')} · ${d.series}`}
                  </span>
                  <span className="li-add" aria-hidden="true">+</span>
                  <span className="li-meta">{devMeta(d)}</span>
                </button>
              ))}
            </div>
          );
        })}

        {list.length === 0 && myList.length === 0 && cat !== 'CUSTOM' && (
          <p className="study-empty">No devices match these filters.</p>
        )}
      </div>
    </aside>
  );
};
