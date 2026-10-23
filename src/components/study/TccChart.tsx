import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { CurvePoint, DeviceDef, StudyItem } from '../../types';
import * as E from '../../engine/engine';
import { DB } from '../../data/db';

interface TccChartProps {
  studyItems: StudyItem[];
  customCurves: DeviceDef[];
  baseKV: number;
  faultKA: number;
  efKA: number;
  view: 'phase' | 'earth';
  efPhase: boolean;
  xRange: string;
  showBands: boolean;
  theme: 'light' | 'dark';
  pickingState?: {
    active: boolean;
    curve: Partial<DeviceDef> | null;
    onAddPoint: (pt: CurvePoint) => void;
  };
  faultAnalysisData?: any;
  onHoverDataChange?: (data: { I: number; items: { label: string; text: string; color: string }[] } | null) => void;
}

const Y0 = 0.001;
const Y1 = 10000;

export const PALETTE = {
  light: ['#1d5f8a', '#b4441c', '#2c7a4b', '#7b4a9e', '#9a7412', '#0e7783', '#8c2b4b', '#4a5560'],
  dark: ['#6cb2e0', '#f08a5d', '#6fcf8f', '#b993dd', '#e3bd57', '#4fc4cf', '#e47b9b', '#a5b0ba'],
};

export const colorFor = (it: StudyItem, theme: 'light' | 'dark') => {
  const i = PALETTE.light.indexOf(it.color);
  return theme === 'dark' && i >= 0 ? PALETTE.dark[i] : it.color;
};

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

export const TccChart = React.forwardRef<SVGSVGElement, TccChartProps>(({
  studyItems,
  customCurves,
  baseKV,
  faultKA,
  efKA,
  view,
  efPhase,
  xRange,
  showBands,
  theme,
  pickingState,
  faultAnalysisData,
  onHoverDataChange,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalSvgRef = useRef<SVGSVGElement | null>(null);

  const [dims, setDims] = useState<{ width: number; height: number }>({ width: 700, height: 500 });
  const [cursor, setCursor] = useState<{ x: number; y: number; I: number } | null>(null);

  const setSvgRef = useCallback((node: SVGSVGElement | null) => {
    internalSvgRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<SVGSVGElement | null>).current = node;
  }, [ref]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setDims({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const devMap = useMemo(() => {
    const map = new Map<string, DeviceDef>();
    for (const d of DB.devices) map.set(d.id, d);
    for (const d of customCurves) map.set(d.id, d);
    return map;
  }, [customCurves]);

  const curveOf = useCallback((it: StudyItem) => {
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
  }, [devMap, view, efPhase]);

  const kScale = useCallback((it: StudyItem) => (it.kV || baseKV) / baseKV, [baseKV]);

  const faultA = (view === 'earth' ? efKA : faultKA) * 1000;

  // Calculate X domain
  const [X0, X1] = useMemo(() => {
    if (xRange !== 'auto') {
      const [a, b] = xRange.split(',').map(Number);
      return [10 ** a, 10 ** b];
    }
    const vis = studyItems.filter((i) => i.visible);
    if (!vis.length) return [1, 1e5];
    let lo = Infinity;
    for (const it of vis) {
      const ev = curveOf(it);
      if (ev) lo = Math.min(lo, ev.pickup * kScale(it));
    }
    if (!Number.isFinite(lo)) return view === 'earth' ? [0.01, 1e5] : [1, 1e5];
    const a = Math.floor(Math.log10(lo * 0.8));
    const hiNeed = Math.max(faultA * 1.5, lo * 1000);
    const b = Math.max(a + 3, Math.ceil(Math.log10(hiNeed)));
    return [10 ** a, 10 ** Math.min(b, a + (view === 'earth' ? 7 : 6))];
  }, [xRange, studyItems, curveOf, kScale, faultA, view]);

  const W = dims.width;
  const H = dims.height;
  const narrow = W < 520;
  const m = { l: narrow ? 46 : 62, r: narrow ? 10 : 18, t: 14, b: narrow ? 40 : 46 };
  const pw = Math.max(10, W - m.l - m.r);
  const ph = Math.max(10, H - m.t - m.b);

  const sx = useCallback((I: number) => {
    return m.l + ((Math.log10(I) - Math.log10(X0)) / (Math.log10(X1) - Math.log10(X0))) * pw;
  }, [m.l, pw, X0, X1]);

  const sy = useCallback((t: number) => {
    return m.t + (1 - (Math.log10(t) - Math.log10(Y0)) / (Math.log10(Y1) - Math.log10(Y0))) * ph;
  }, [m.t, ph]);

  // Color theme variables
  const C = useMemo(() => {
    return theme === 'dark'
      ? {
          paper: '#14181a',
          major: '#34413c',
          minor: '#1f2826',
          axis: '#9fb0a9',
          text: '#a2a8aa',
          fault: '#ec7b66',
          font: 'Geist Mono, ui-monospace, monospace',
        }
      : {
          paper: '#fdfcf7',
          major: '#b8c6bf',
          minor: '#e0e7e2',
          axis: '#41504b',
          text: '#565f62',
          fault: '#a8321f',
          font: 'Geist Mono, ui-monospace, monospace',
        };
  }, [theme]);

  // Grid lines
  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    const d0 = Math.floor(Math.log10(X0));
    const d1 = Math.ceil(Math.log10(X1));
    for (let d = d0; d <= d1; d++) {
      for (let k = 1; k < 10; k++) {
        const I = k * 10 ** d;
        if (I < X0 || I > X1) continue;
        const xPos = sx(I);
        lines.push(
          <line
            key={`gx-${d}-${k}`}
            x1={xPos}
            x2={xPos}
            y1={m.t}
            y2={m.t + ph}
            stroke={k === 1 ? C.major : C.minor}
            strokeWidth={k === 1 ? 1 : 0.7}
          />
        );
      }
    }
    for (let d = -3; d <= 4; d++) {
      for (let k = 1; k < 10; k++) {
        const t = k * 10 ** d;
        if (t < Y0 || t > Y1) continue;
        const yPos = sy(t);
        lines.push(
          <line
            key={`gy-${d}-${k}`}
            x1={m.l}
            x2={m.l + pw}
            y1={yPos}
            y2={yPos}
            stroke={k === 1 ? C.major : C.minor}
            strokeWidth={k === 1 ? 1 : 0.7}
          />
        );
      }
    }
    return lines;
  }, [X0, X1, sx, sy, m.t, m.l, pw, ph, C.major, C.minor]);

  // Axis text labels
  const axisLabels = useMemo(() => {
    const labels: React.ReactNode[] = [];
    const fs = narrow ? 9 : 10.5;
    const d0 = Math.floor(Math.log10(X0));
    const d1 = Math.ceil(Math.log10(X1));
    for (let d = d0; d <= d1; d++) {
      const I = 10 ** d;
      if (I < X0 * 0.999 || I > X1 * 1.001) continue;
      const lab = I >= 1e6 ? `${I / 1e6}M` : I >= 1000 ? `${I / 1000}k` : I < 1 ? `${+(I * 1000).toPrecision(3)}m` : `${I}`;
      labels.push(
        <text
          key={`lx-${d}`}
          x={sx(I)}
          y={m.t + ph + 15}
          fill={C.text}
          fontSize={fs}
          fontFamily={C.font}
          textAnchor="middle"
        >
          {lab}
        </text>
      );
    }
    for (let d = -3; d <= 4; d++) {
      const t = 10 ** d;
      labels.push(
        <text
          key={`ly-${d}`}
          x={m.l - 6}
          y={sy(t) + 3.5}
          fill={C.text}
          fontSize={fs}
          fontFamily={C.font}
          textAnchor="end"
        >
          {t}
        </text>
      );
    }
    return labels;
  }, [X0, X1, sx, sy, m.t, m.l, ph, C.text, C.font, narrow]);

  // Curves rendering
  const renderedCurves = useMemo(() => {
    const fs = narrow ? 9 : 10.5;
    const clampT = (t: number) => Math.min(Y1 * 1.5, Math.max(Y0 / 1.5, t));
    const elements: React.ReactNode[] = [];
    const curveLabels: { x: number; y: number; text: string; col: string }[] = [];

    for (const it of studyItems) {
      if (!it.visible) continue;
      const ev = curveOf(it);
      if (!ev) continue;
      const k = kScale(it);
      const col = colorFor(it, theme);
      const pts = E.sample(ev, k, X0, X1, Math.round(Math.max(260, pw)));

      const pathFor = (key: 'lo' | 'hi' | 'nom') => {
        let s = '', on = false;
        for (const p of pts) {
          const t = p[key];
          if (t == null || !Number.isFinite(t)) {
            on = false;
            continue;
          }
          s += `${on ? 'L' : 'M'}${sx(p.I).toFixed(1)},${sy(clampT(t)).toFixed(1)}`;
          on = true;
        }
        return s;
      };

      const same = pts.every(
        (p) =>
          p.lo === p.hi ||
          (!Number.isFinite(p.lo) && !Number.isFinite(p.hi)) ||
          Math.abs(p.lo - p.hi) / p.hi < 1e-9
      );

      if (showBands && !same) {
        const fp = pts.filter((p) => Number.isFinite(p.lo));
        if (fp.length > 1) {
          const top = fp.map((p) => `${sx(p.I).toFixed(1)},${sy(clampT(Number.isFinite(p.hi) ? p.hi : Y1 * 1.5)).toFixed(1)}`);
          const bot = fp.slice().reverse().map((p) => `${sx(p.I).toFixed(1)},${sy(clampT(p.lo)).toFixed(1)}`);
          elements.push(
            <polygon
              key={`band-${it.uid}`}
              points={`${top.join(' ')} ${bot.join(' ')}`}
              fill={col}
              fillOpacity={0.13}
              stroke="none"
            />
          );
        }
        elements.push(
          <path
            key={`lo-${it.uid}`}
            d={pathFor('lo')}
            fill="none"
            stroke={col}
            strokeWidth={1.1}
            strokeOpacity={0.85}
          />
        );
        elements.push(
          <path
            key={`hi-${it.uid}`}
            d={pathFor('hi')}
            fill="none"
            stroke={col}
            strokeWidth={1.9}
          />
        );
      } else {
        elements.push(
          <path
            key={`line-${it.uid}`}
            d={pathFor(ev.nom ? 'nom' : 'hi')}
            fill="none"
            stroke={col}
            strokeWidth={2}
          />
        );
      }

      if (ev.nom && showBands && !same) {
        elements.push(
          <path
            key={`nom-${it.uid}`}
            d={pathFor('nom')}
            fill="none"
            stroke={col}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        );
      }

      const anchor = pts.find((p) => Number.isFinite(p.hi) && p.hi <= 300) || pts.find((p) => Number.isFinite(p.hi));
      if (anchor) {
        curveLabels.push({ x: sx(anchor.I) + 5, y: sy(clampT(anchor.hi)), text: it.label, col });
      }
    }

    curveLabels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < curveLabels.length; i++) {
      if (curveLabels[i].y - curveLabels[i - 1].y < 13 && Math.abs(curveLabels[i].x - curveLabels[i - 1].x) < 160) {
        curveLabels[i].y = curveLabels[i - 1].y + 13;
      }
    }

    if (!narrow) {
      curveLabels.forEach((L, i) => {
        elements.push(
          <text
            key={`lbl-${i}`}
            x={Math.min(L.x, m.l + pw - 4)}
            y={L.y}
            fill={L.col}
            fontSize={fs}
            fontFamily="Geist, sans-serif"
            fontWeight="600"
            textAnchor={L.x > m.l + pw - 120 ? 'end' : 'start'}
            paintOrder="stroke"
            stroke={C.paper}
            strokeWidth={3}
          >
            {L.text}
          </text>
        );
      });
    }

    return elements;
  }, [studyItems, curveOf, kScale, theme, X0, X1, pw, showBands, sx, sy, narrow, m.l, C.paper]);

  // Pointer move handler
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!internalSvgRef.current) return;
    const r = internalSvgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;

    if (x < m.l || x > m.l + pw || y < m.t || y > m.t + ph) {
      setCursor(null);
      if (onHoverDataChange) onHoverDataChange(null);
      return;
    }

    const I = 10 ** (Math.log10(X0) + ((x - m.l) / pw) * (Math.log10(X1) - Math.log10(X0)));
    setCursor({ x, y, I });

    if (onHoverDataChange) {
      const items: { label: string; text: string; color: string }[] = [];
      for (const it of studyItems) {
        if (!it.visible) continue;
        const ev = curveOf(it);
        if (!ev) continue;
        const k = kScale(it);
        const lo = ev.lo(I / k);
        const hi = ev.hi(I / k);
        const col = colorFor(it, theme);
        const txt = !Number.isFinite(hi) && !Number.isFinite(lo)
          ? 'no trip'
          : lo === hi
          ? fmtT(hi)
          : `${fmtT(lo)} – ${Number.isFinite(hi) ? fmtT(hi) : 'no trip'}`;
        items.push({ label: it.label, text: txt, color: col });
      }
      onHoverDataChange({ I, items });
    }
  };

  const handlePointerLeave = () => {
    setCursor(null);
    if (onHoverDataChange) onHoverDataChange(null);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pickingState || !pickingState.active || !pickingState.curve) return;
    if (!internalSvgRef.current) return;
    const r = internalSvgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    if (x < m.l || x > m.l + pw || y < m.t || y > m.t + ph) return;

    const I = 10 ** (Math.log10(X0) + ((x - m.l) / pw) * (Math.log10(X1) - Math.log10(X0)));
    const t = 10 ** (Math.log10(Y1) - ((y - m.t) / ph) * (Math.log10(Y1) - Math.log10(Y0)));

    const ed = pickingState.curve;
    const k = (ed.kV || baseKV) / baseKV;
    const b = ed.unit === 'x' ? ed.base || 1 : 1;
    const ptI = +(I / k / b).toPrecision(4);
    const ptT = +t.toPrecision(3);

    pickingState.onAddPoint(ed.mode === 'band' ? { I: ptI, t: ptT, t2: ptT } : { I: ptI, t: ptT });
  };

  // Picking preview
  const pickingPreview = useMemo(() => {
    if (!pickingState?.active || !pickingState.curve || !pickingState.curve.points?.length) return null;
    const ed = pickingState.curve;
    const k = (ed.kV || baseKV) / baseKV;
    const b = ed.unit === 'x' ? ed.base || 1 : 1;
    const pts = E.sortPts(ed.points).map((p) => ({
      x: sx(p.I * b * k),
      y: sy(p.t),
      y2: sy(p.t2 ?? p.t),
    }));
    const col = theme === 'dark' ? '#e0814f' : '#a8431a';

    const path1 = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
    const path2 = ed.mode === 'band' ? pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y2.toFixed(1)}`).join('') : '';

    return (
      <g>
        <path d={path1} fill="none" stroke={col} strokeWidth={1.8} strokeDasharray="6 3" />
        {ed.mode === 'band' && (
          <path d={path2} fill="none" stroke={col} strokeWidth={1.2} strokeDasharray="2 3" />
        )}
        {pts.map((p, i) => (
          <circle key={`pt-${i}`} cx={p.x} cy={p.y} r={3.5} fill={C.paper} stroke={col} strokeWidth={1.6} />
        ))}
      </g>
    );
  }, [pickingState, baseKV, sx, sy, theme, C.paper]);

  // Fault markers
  const faultMarkers = useMemo(() => {
    const list: React.ReactNode[] = [];
    const fs = narrow ? 9 : 10.5;
    if (faultA > X0 && faultA < X1) {
      const xPos = sx(faultA);
      list.push(
        <g key="fault-line">
          <line
            x1={xPos}
            x2={xPos}
            y1={m.t}
            y2={m.t + ph}
            stroke={C.fault}
            strokeWidth={1.2}
            strokeDasharray="5 4"
          />
          <text
            x={xPos - 4}
            y={m.t + 12}
            fill={C.fault}
            fontSize={fs}
            fontFamily={C.font}
            textAnchor="end"
          >
            {`If ${fmtI(faultA)}`}
          </text>
        </g>
      );
    }

    if (faultAnalysisData && faultAnalysisData.byUid) {
      for (const it of studyItems) {
        const r = faultAnalysisData.byUid.get(it.uid);
        if (!it.visible || !r || !r.lv) continue;
        const pts: [number, string][] =
          view === 'earth'
            ? [
                [r.ik1, 'Ik1 max at device'],
                [r.ik1Min, 'Ik1 min at circuit end'],
              ]
            : [
                [r.ireq, 'Ik max at device'],
                [r.ik2Min, 'Ik2 min at circuit end'],
              ];
        const col = colorFor(it, theme);
        pts.forEach(([IVal, what], j) => {
          if (!(IVal > X0 && IVal < X1)) return;
          const xPos = sx((IVal * baseKV) / (+it.kV || baseKV));
          const y0 = m.t + ph;
          list.push(
            <g key={`fa-${it.uid}-${j}`}>
              <title>{`${it.label} — ${what}: ${fmtI(IVal)}`}</title>
              <line
                x1={xPos}
                x2={xPos}
                y1={y0}
                y2={y0 - 26}
                stroke={col}
                strokeWidth={1.4}
                strokeDasharray={j ? '2 2' : 'none'}
              />
              <path
                d={`M${xPos - 5},${y0} L${xPos + 5},${y0} L${xPos},${y0 - 8} Z`}
                fill={j ? C.paper : col}
                stroke={col}
                strokeWidth={1.2}
              />
            </g>
          );
        });
      }
    }
    return list;
  }, [faultA, X0, X1, sx, m.t, ph, C.fault, C.font, C.paper, narrow, faultAnalysisData, studyItems, view, theme, baseKV]);

  // Cursor points on curves
  const cursorDots = useMemo(() => {
    if (!cursor) return null;
    const dots: React.ReactNode[] = [];
    for (const it of studyItems) {
      if (!it.visible) continue;
      const ev = curveOf(it);
      if (!ev) continue;
      const k = kScale(it);
      const lo = ev.lo(cursor.I / k);
      const hi = ev.hi(cursor.I / k);
      const col = colorFor(it, theme);
      for (const t of [lo, hi]) {
        if (Number.isFinite(t) && t > Y0 && t < Y1) {
          dots.push(
            <circle
              key={`dot-${it.uid}-${t}`}
              cx={cursor.x}
              cy={sy(t)}
              r={3}
              fill={col}
            />
          );
        }
      }
    }
    return dots;
  }, [cursor, studyItems, curveOf, kScale, theme, sy]);

  const hasVisibleCurves = studyItems.some((i) => i.visible && curveOf(i));

  return (
    <div
      ref={containerRef}
      className={`chart-wrap ${pickingState?.active ? 'picking' : ''}`}
      id="chart-wrap"
    >
      <svg
        ref={setSvgRef}
        id="chart"
        role="img"
        aria-label="Time-current characteristic chart"
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerUp={handlePointerUp}
      >
        <rect x="0" y="0" width={W} height={H} fill={C.paper} />
        {gridLines}
        {axisLabels}
        <text
          x={m.l + pw / 2}
          y={H - 8}
          fill={C.text}
          fontSize={narrow ? 9.5 : 11}
          fontFamily="Geist, sans-serif"
          textAnchor="middle"
        >
          {view === 'earth' ? 'Earth-fault / residual current' : 'Current'} (A) at {baseKV} kV base
        </text>
        <text
          transform={`translate(${narrow ? 11 : 14},${m.t + ph / 2}) rotate(-90)`}
          fill={C.text}
          fontSize={narrow ? 9.5 : 11}
          fontFamily="Geist, sans-serif"
          textAnchor="middle"
        >
          Time (s)
        </text>

        <rect x={m.l} y={m.t} width={pw} height={ph} fill="none" stroke={C.axis} strokeWidth="1" />

        <defs>
          <clipPath id="plotclip">
            <rect x={m.l} y={m.t} width={pw} height={ph} />
          </clipPath>
        </defs>

        <g clipPath="url(#plotclip)">
          {faultMarkers}
          {renderedCurves}
          {pickingPreview}
        </g>

        {cursor && (
          <g id="cursor">
            <line
              x1={cursor.x}
              x2={cursor.x}
              y1={m.t}
              y2={m.t + ph}
              stroke={C.axis}
              strokeWidth={0.8}
              strokeOpacity={0.6}
            />
            {cursorDots}
          </g>
        )}
      </svg>

      {!hasVisibleCurves && !pickingState?.active && (
        <div className="empty-chart" id="empty-chart">
          <p>Add a breaker or relay from the library to plot its time-current band.</p>
        </div>
      )}
    </div>
  );
});
