import React from 'react';
import { ControlDef, DeviceDef, StudyItem } from '../../types';
import * as E from '../../engine/engine';
import { DB } from '../../data/db';
import { colorFor } from './TccChart';

interface StudyCardProps {
  item: StudyItem;
  device: DeviceDef;
  otherItems: StudyItem[];
  isCollapsed: boolean;
  theme: 'light' | 'dark';
  onUpdateItem: (uid: number, updates: Partial<StudyItem>) => void;
  onToggleCollapse: (uid: number) => void;
  onDuplicate: (uid: number) => void;
  onDelete: (uid: number) => void;
  onEditCustomPoints?: (device: DeviceDef) => void;
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

export const StudyCard: React.FC<StudyCardProps> = ({
  item,
  device,
  otherItems,
  isCollapsed,
  theme,
  onUpdateItem,
  onToggleCollapse,
  onDuplicate,
  onDelete,
  onEditCustomPoints,
}) => {
  const ev = E.evaluate(device, item);
  const efv = E.evaluateEF(device, item);
  const controls = E.controlsFor(device, item);

  const basisTags = () => {
    const b = new Set<string>();
    const walk = (o: any) => {
      if (o && typeof o === 'object') {
        for (const [k, v] of Object.entries(o)) {
          if (/basis$/i.test(k) && typeof v === 'string') b.add(v);
          else walk(v);
        }
      }
    };
    walk(device);
    if (device.tolBasis) b.add(device.tolBasis);
    return [...b].filter((x) => x !== 'user');
  };

  const settingsLine = () => {
    const parts: string[] = [];
    if (!ev.none && !(device.model === 'idmt' && item.fn === 'earth')) parts.push(ev.settingsText);
    if (efv) {
      parts.push(
        device.model === 'idmt'
          ? `Earth-fault relay: ${efv.settingsText}`
          : device.rcd
          ? `Residual: ${efv.settingsText}`
          : efv.settingsText
      );
    }
    return parts.join('\n');
  };

  const handleControlChange = (key: string, val: any) => {
    const updates: Partial<StudyItem> = { [key]: val };
    if (key === 'io') updates.Ir = val;
    const nextItem = { ...item, ...updates };
    E.normalize(device, nextItem);
    onUpdateItem(item.uid, nextItem);
  };

  const renderControl = (c: ControlDef) => {
    const val = item[c.key];
    const fmt = c.fmt || ((v: any) => `${v}${c.unit ? ' ' + c.unit : ''}`);
    const wide =
      ['Ii', 'Ir', 'fine', 'curve', 'plug', 'tms', 'isd'].includes(c.key) && c.kind === 'range'
        ? ' wide'
        : c.kind === 'select' && String(fmt(c.values?.[0])).length > 18
        ? ' wide'
        : '';

    if (c.kind === 'select') {
      return (
        <label key={c.key} className={`ctl${wide}`}>
          {c.label}
          <select
            value={val !== undefined ? String(val) : ''}
            onChange={(e) => {
              const strVal = e.target.value;
              const parsed = /^-?\d+(\.\d+)?$/.test(strVal) && !['curve', 'plugRange', 'rcdType', 'rcdClass', 'fn'].includes(c.key)
                ? +strVal
                : strVal;
              handleControlChange(c.key, parsed);
            }}
          >
            {c.values?.map((v) => (
              <option key={String(v)} value={String(v)}>
                {fmt(v)}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (c.kind === 'range') {
      return (
        <label key={c.key} className="ctl wide">
          {c.label} <span className="rv">{fmt(+val)}</span>
          <input
            type="range"
            min={c.min}
            max={c.max}
            step={c.step}
            value={val !== undefined ? +val : c.min || 0}
            onChange={(e) => handleControlChange(c.key, +e.target.value)}
          />
        </label>
      );
    }

    if (c.kind === 'fixed') {
      return (
        <div key={c.key} className="ctl">
          {c.label}
          <span className="fixed">{fmt(c.value)} · fixed</span>
        </div>
      );
    }

    if (c.kind === 'toggle') {
      return (
        <label key={c.key} className="toggle">
          <input
            type="checkbox"
            checked={!!val}
            onChange={(e) => handleControlChange(c.key, e.target.checked)}
          />{' '}
          {c.label}
        </label>
      );
    }

    return (
      <label key={c.key} className="ctl">
        {c.label}
        {c.unit ? ` (${c.unit})` : ''}
        <input
          type="number"
          min={c.min}
          max={c.max}
          step={c.step || 'any'}
          value={val !== undefined ? val : ''}
          onChange={(e) => {
            const v = e.target.value === '' ? '' : +e.target.value;
            handleControlChange(c.key, v);
          }}
        />
      </label>
    );
  };

  const subtitle =
    device.model === 'custom'
      ? `Custom ${(CC_TYPES[device.category] || '').toLowerCase()} · ${device.series}`
      : `${device.manufacturer} · ${device.series}`;

  return (
    <div className="card" data-hidden={!item.visible}>
      <div className="card-head">
        <label className="card-color" style={{ background: colorFor(item, theme) }} title="Curve colour">
          <input
            type="color"
            value={item.color}
            onChange={(e) => onUpdateItem(item.uid, { color: e.target.value })}
            aria-label="Curve colour"
          />
        </label>

        <div className="card-title">
          <input
            type="text"
            value={item.label}
            onChange={(e) => onUpdateItem(item.uid, { label: e.target.value })}
            aria-label="Label"
          />
          <div className="card-sub" title={subtitle}>
            {subtitle}
          </div>
        </div>

        <div className="card-tools">
          <button
            title={item.visible ? 'Hide curve' : 'Show curve'}
            aria-label="Toggle visibility"
            onClick={() => onUpdateItem(item.uid, { visible: !item.visible })}
          >
            {item.visible ? (
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3l18 18" />
                <path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
              </svg>
            )}
          </button>
          <button title="Duplicate" aria-label="Duplicate" onClick={() => onDuplicate(item.uid)}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h8" />
            </svg>
          </button>
          <button
            title={isCollapsed ? 'Expand' : 'Collapse'}
            aria-label="Collapse"
            onClick={() => onToggleCollapse(item.uid)}
          >
            {isCollapsed ? (
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 9l6 6 6-6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 15l6-6 6 6" />
              </svg>
            )}
          </button>
          <button title="Remove" aria-label="Remove" onClick={() => onDelete(item.uid)}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`card-body ${isCollapsed ? 'collapsed' : ''}`}>
        {controls.map((c) => renderControl(c))}

        <label className="ctl wide">
          Downstream of
          <select
            value={item.downOf || ''}
            onChange={(e) => onUpdateItem(item.uid, { downOf: e.target.value ? +e.target.value : null })}
          >
            <option value="">— none (top of chain) —</option>
            {otherItems.map((o) => (
              <option key={o.uid} value={o.uid}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <div className="card-foot">
          <span className="mono">{settingsLine()}</span>
        </div>

        <div className="card-foot">
          {device.model === 'custom' ? (
            <>
              <span className="tag user">user-defined</span>
              {onEditCustomPoints && (
                <button
                  type="button"
                  className="btn small"
                  onClick={() => onEditCustomPoints(device)}
                >
                  Edit points
                </button>
              )}
            </>
          ) : (
            <>
              {basisTags().map((t) => (
                <span key={t} className={`tag ${t}`}>
                  {t}
                </span>
              ))}
              {device.sources?.map((s, idx) => (
                <a
                  key={idx}
                  href={DB.sources[s]?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {DB.sources[s]?.publisher}
                  {device.sources.length > 1 && ` · ${DB.sources[s]?.title.slice(0, 28)}…`}
                </a>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
