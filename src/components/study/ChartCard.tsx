import React, { useState } from 'react';
import { CurvePoint, DeviceDef, StudyItem } from '../../types';
import { colorFor, TccChart } from './TccChart';

interface ChartCardProps {
  studyItems: StudyItem[];
  customCurves: DeviceDef[];
  baseKV: number;
  onBaseKVChange: (v: number) => void;
  faultKA: number;
  onFaultKAChange: (v: number) => void;
  efKA: number;
  onEfKAChange: (v: number) => void;
  view: 'phase' | 'earth';
  onViewChange: (v: 'phase' | 'earth') => void;
  efPhase: boolean;
  onEfPhaseChange: (v: boolean) => void;
  xRange: string;
  onXRangeChange: (v: string) => void;
  showBands: boolean;
  onShowBandsChange: (v: boolean) => void;
  theme: 'light' | 'dark';
  pickingState?: {
    active: boolean;
    curve: Partial<DeviceDef> | null;
    onAddPoint: (pt: CurvePoint) => void;
    onUndoPoint: () => void;
    onDonePicking: () => void;
  };
  faultAnalysisData?: any;
  chartSvgRef: React.RefObject<SVGSVGElement | null>;
}

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

export const ChartCard: React.FC<ChartCardProps> = ({
  studyItems,
  customCurves,
  baseKV,
  onBaseKVChange,
  faultKA,
  onFaultKAChange,
  efKA,
  onEfKAChange,
  view,
  onViewChange,
  efPhase,
  onEfPhaseChange,
  xRange,
  onXRangeChange,
  showBands,
  onShowBandsChange,
  theme,
  pickingState,
  faultAnalysisData,
  chartSvgRef,
}) => {
  const [hoverData, setHoverData] = useState<{
    I: number;
    items: { label: string; text: string; color: string }[];
  } | null>(null);

  const visibleItems = studyItems.filter((i) => i.visible);

  return (
    <div className="chart-card">
      <div className="chart-toolbar">
        <div className="seg" role="group" aria-label="Chart view">
          <button
            type="button"
            aria-pressed={view === 'phase'}
            onClick={() => onViewChange('phase')}
          >
            Phase fault
          </button>
          <button
            type="button"
            aria-pressed={view === 'earth'}
            onClick={() => onViewChange('earth')}
          >
            Earth fault
          </button>
        </div>

        <div className="tb-group">
          <label>
            Base voltage{' '}
            <span className="inp-unit">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={baseKV}
                onChange={(e) => onBaseKVChange(Math.max(0.01, +e.target.value || 0.4))}
              />
              <i>kV</i>
            </span>
          </label>
          {view === 'phase' ? (
            <label className="v-phase">
              Fault level{' '}
              <span className="inp-unit">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={faultKA}
                  onChange={(e) => onFaultKAChange(Math.max(0, +e.target.value || 0))}
                />
                <i>kA</i>
              </span>
            </label>
          ) : (
            <label className="v-earth">
              Earth-fault current{' '}
              <span className="inp-unit">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={efKA}
                  onChange={(e) => onEfKAChange(Math.max(0, +e.target.value || 0))}
                />
                <i>kA</i>
              </span>
            </label>
          )}
        </div>

        <div className="tb-group">
          <label>
            Current axis
            <select value={xRange} onChange={(e) => onXRangeChange(e.target.value)}>
              <option value="0,5">1 A – 100 kA</option>
              <option value="1,5">10 A – 100 kA</option>
              <option value="-1,4">0.1 A – 10 kA</option>
              <option value="1,6">10 A – 1 MA</option>
              <option value="-3,4">1 mA – 10 kA</option>
              <option value="-2,5">10 mA – 100 kA</option>
              <option value="auto">Auto</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={showBands}
              onChange={(e) => onShowBandsChange(e.target.checked)}
            />{' '}
            Tolerance bands
          </label>
          {view === 'earth' && (
            <label
              className="check v-earth"
              title="Also plot phase overcurrent curves, which respond to earth faults in TN systems"
            >
              <input
                type="checkbox"
                checked={efPhase}
                onChange={(e) => onEfPhaseChange(e.target.checked)}
              />{' '}
              Phase devices too
            </label>
          )}
        </div>
      </div>

      {pickingState?.active && (
        <div className="pick-banner" id="pick-banner">
          <span>
            <b>Picking points</b> — click the chart to add a current–time point to{' '}
            <span>“{pickingState.curve?.series || 'new curve'}”</span>.{' '}
            <span className="mono">
              {pickingState.curve?.points?.length || 0} point
              {pickingState.curve?.points?.length === 1 ? '' : 's'}
            </span>
          </span>
          <span className="pb-actions">
            <button
              className="btn small"
              onClick={pickingState.onUndoPoint}
              disabled={!pickingState.curve?.points?.length}
            >
              Undo last
            </button>
            <button className="btn small primary" onClick={pickingState.onDonePicking}>
              Done
            </button>
          </span>
        </div>
      )}

      <TccChart
        ref={chartSvgRef}
        studyItems={studyItems}
        customCurves={customCurves}
        baseKV={baseKV}
        faultKA={faultKA}
        efKA={efKA}
        view={view}
        efPhase={efPhase}
        xRange={xRange}
        showBands={showBands}
        theme={theme}
        pickingState={pickingState}
        faultAnalysisData={faultAnalysisData}
        onHoverDataChange={setHoverData}
      />

      <div className="readout" id="readout" aria-live="polite">
        {hoverData ? (
          <>
            <span className="ro-i">{fmtI(hoverData.I)}</span>
            {hoverData.items.map((it, idx) => (
              <span key={idx} className="ro-item">
                <span className="swatch" style={{ background: it.color }} />
                {it.label}: {it.text}
              </span>
            ))}
          </>
        ) : visibleItems.length > 0 ? (
          <>
            {visibleItems.map((it) => (
              <span key={it.uid} className="ro-item">
                <span className="swatch" style={{ background: colorFor(it, theme) }} />
                {it.label}
              </span>
            ))}
            <span className="ro-hint">· hover or tap the chart for operating times</span>
          </>
        ) : (
          <span className="ro-hint">Hover the chart to read operating times at any current.</span>
        )}
      </div>
    </div>
  );
};
