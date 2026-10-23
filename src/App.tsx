import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CurvePoint, DeviceDef, NetworkConfig, StudyItem } from './types';
import { DB } from './data/db';
import * as E from './engine/engine';
import * as F from './engine/fault';
import { Header } from './components/Header';
import { Disclaimer } from './components/Disclaimer';
import { StudyView } from './components/study/StudyView';
import { FaultView } from './components/fault/FaultView';
import { DatabaseView } from './components/database/DatabaseView';
import { MethodView } from './components/method/MethodView';
import { CustomCurveModal } from './components/custom/CustomCurveModal';
import { PALETTE } from './components/study/TccChart';

function newCurveId() {
  return 'user-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function shortName(d: DeviceDef, st: Partial<StudyItem>) {
  const m = d.manufacturer.startsWith('Generic') ? '' : d.manufacturer.split(' ')[0] + ' ';
  const series = d.series.split(' — ')[0].split(' (')[0];
  if (d.model === 'mcb') return `${m}${series} ${st.curve}${st.In}`;
  if (d.model === 'idmt') return `${series.split(' / ')[0]}`;
  if (d.model === 'custom') return d.series;
  return `${m}${series} ${st.In} A`;
}

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  const [currentView, setCurrentView] = useState<'study' | 'fault' | 'database' | 'method'>('study');

  // Study State
  const [studyItems, setStudyItems] = useState<StudyItem[]>([]);
  const [customCurves, setCustomCurves] = useState<DeviceDef[]>([]);
  const [baseKV, setBaseKV] = useState<number>(0.4);
  const [faultKA, setFaultKA] = useState<number>(10);
  const [efKA, setEfKA] = useState<number>(1);
  const [chartView, setChartView] = useState<'phase' | 'earth'>('phase');
  const [efPhase, setEfPhase] = useState<boolean>(false);
  const [xRange, setXRange] = useState<string>('auto');
  const [showBands, setShowBands] = useState<boolean>(true);
  const [net, setNet] = useState<NetworkConfig>({ ...F.DEFAULT_NET });

  const nextUidRef = useRef<number>(1);
  const chartSvgRef = useRef<SVGSVGElement | null>(null);

  // Custom curve modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomCurve, setEditingCustomCurve] = useState<DeviceDef | null>(null);

  // Picking mode state
  const [pickingState, setPickingState] = useState<{
    active: boolean;
    curve: Partial<DeviceDef> | null;
  }>({
    active: false,
    curve: null,
  });

  // Sync theme attribute
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const devLookup = useCallback(
    (id: string): DeviceDef => {
      const c = customCurves.find((d) => d.id === id);
      if (c) return c;
      const d = DB.devices.find((x) => x.id === id);
      if (d) return d;
      return {
        id,
        category: 'OTHER',
        manufacturer: 'Unknown',
        series: 'Unknown',
        model: 'mcb',
        sources: [],
      };
    },
    [customCurves]
  );

  const nextColor = useCallback((currentItems: StudyItem[]) => {
    const pal = PALETTE.light;
    const used = currentItems.map((i) => i.color);
    return pal.find((c) => !used.includes(c)) || pal[currentItems.length % pal.length];
  }, []);

  const addDevice = useCallback(
    (id: string, overrides: Partial<StudyItem> = {}) => {
      const d = devLookup(id);
      if (!d) return;
      const uid = nextUidRef.current++;
      const st: StudyItem = {
        ...E.defaultSettings(d),
        ...overrides,
        uid,
        downOf: overrides.downOf !== undefined ? overrides.downOf : null,
      };
      if (!overrides.label) st.label = shortName(d, st);
      if (!overrides.color) st.color = nextColor(studyItems);
      E.normalize(d, st);
      setStudyItems((prev) => [...prev, st]);
    },
    [devLookup, nextColor, studyItems]
  );

  const autoChain = useCallback(() => {
    setStudyItems((prev) => {
      if (!prev.length) return prev;
      const evs = prev
        .map((it) => {
          const d = devLookup(it.deviceId);
          const ev =
            (chartView === 'earth' ? E.evaluateEF(d, it) : null) ||
            E.evaluate(d, it) ||
            E.evaluateEF(d, it);
          const kScale = (it.kV || baseKV) / baseKV;
          const pu = (Number.isFinite(ev?.pickup) ? ev.pickup : 0) * kScale;
          return { it, pu };
        })
        .sort((a, b) => b.pu - a.pu);

      const next = prev.map((item) => ({ ...item }));
      evs.forEach((e, i) => {
        const target = next.find((x) => x.uid === e.it.uid);
        if (target) {
          target.downOf = i === 0 ? null : evs[i - 1].it.uid;
        }
      });
      return next;
    });
  }, [devLookup, chartView, baseKV]);

  // Initial load: from hash or demo study
  useEffect(() => {
    const loadHash = () => {
      const m = location.hash.match(/#s=([^&]+)/);
      if (!m) return false;
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
        applyStudy(decoded);
        return true;
      } catch {
        return false;
      }
    };

    if (!loadHash()) {
      // Demo study
      const d1: DeviceDef = DB.devices.find((d) => d.id === 'cdg11-3s')!;
      const d2: DeviceDef = DB.devices.find((d) => d.id === 'se-ml52')!;
      const d3: DeviceDef = DB.devices.find((d) => d.id === 'hager-h3-p160-tm')!;
      const d4: DeviceDef = DB.devices.find((d) => d.id === 'se-ic60n')!;

      const items: StudyItem[] = [];
      let uid = 1;

      const s1: StudyItem = {
        ...E.defaultSettings(d1),
        kV: 11,
        ctPri: 100,
        ctSec: 1,
        plugRange: '50-200%',
        plug: 100,
        tms: 0.2,
        label: 'HV CDG11 (11 kV)',
        uid: uid++,
        color: PALETTE.light[0],
        downOf: null,
      };
      E.normalize(d1, s1);
      items.push(s1);

      const s2: StudyItem = {
        ...E.defaultSettings(d2),
        In: 250,
        io: 250,
        Ir: 250,
        tr: 8,
        isd: 8,
        tsd: 0.2,
        i2t: false,
        label: 'Main LV ML5.2 250 A',
        uid: uid++,
        color: PALETTE.light[1],
        downOf: null,
      };
      E.normalize(d2, s2);
      items.push(s2);

      const s3: StudyItem = {
        ...E.defaultSettings(d3),
        In: 100,
        irX: 1,
        Ii: 800,
        label: 'Sub-board h3+ 100 A',
        uid: uid++,
        color: PALETTE.light[2],
        downOf: null,
      };
      E.normalize(d3, s3);
      items.push(s3);

      const s4: StudyItem = {
        ...E.defaultSettings(d4),
        curve: 'C',
        In: 32,
        label: 'Final circuit iC60N C32',
        uid: uid++,
        color: PALETTE.light[3],
        downOf: null,
      };
      E.normalize(d4, s4);
      items.push(s4);

      // Auto chain them: s1 (top) -> s2 -> s3 -> s4
      s2.downOf = s1.uid;
      s3.downOf = s2.uid;
      s4.downOf = s3.uid;

      nextUidRef.current = uid;
      setStudyItems(items);
    }
  }, []);

  // Serialize and sync hash
  const serializeStudy = useCallback(() => {
    const usedIds = new Set(studyItems.map((i) => i.deviceId));
    const usedCustom = customCurves.filter((d) => d.saved || usedIds.has(d.id));
    return {
      app: 'tcc-studio',
      version: DB.meta.version,
      baseKV,
      faultKA,
      efKA,
      view: chartView,
      efPhase,
      net,
      customCurves: usedCustom,
      items: studyItems,
    };
  }, [studyItems, customCurves, baseKV, faultKA, efKA, chartView, efPhase, net]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const payload = serializeStudy();
        const str = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        window.history.replaceState(null, '', '#s=' + str);
      } catch {
        // Ignored if URL hash limit or iframe permission
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [serializeStudy]);

  const applyStudy = (o: any) => {
    if (!o || !Array.isArray(o.items)) return;
    const loadedCurves: DeviceDef[] = [];
    for (const d of o.customCurves || []) {
      if (d && d.id && Array.isArray(d.points)) {
        loadedCurves.push({
          ...d,
          model: 'custom',
          saved: !!d.saved,
        });
      }
    }
    setCustomCurves(loadedCurves);
    setBaseKV(+o.baseKV || 0.4);
    setFaultKA(+o.faultKA || 10);
    setEfKA(o.efKA > 0 ? +o.efKA : 1);
    setChartView(o.view === 'earth' ? 'earth' : 'phase');
    setEfPhase(!!o.efPhase);
    setNet({ ...F.DEFAULT_NET, ...(o.net || {}) });

    const allCurves = [...DB.devices, ...loadedCurves];
    const dev = (id: string) => allCurves.find((x) => x.id === id);

    const validItems = o.items
      .filter((i: any) => dev(i.deviceId))
      .map((i: any) => E.normalize(dev(i.deviceId)!, { ...i }));

    const maxUid = Math.max(0, ...validItems.map((i: any) => +i.uid || 0));
    nextUidRef.current = maxUid + 1;
    setStudyItems(validItems);
  };

  // Compute Fault Analysis
  const faultAnalysisData = useMemo(() => {
    return F.analyse({
      items: studyItems,
      dev: devLookup,
      E,
      N: DB.network,
      net,
      baseKV,
    });
  }, [studyItems, devLookup, net, baseKV]);

  // Exports
  const downloadFile = (name: string, data: any, type: string) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const handleExport = (type: 'png' | 'svg' | 'csv' | 'report') => {
    const svg = chartSvgRef.current;
    if (!svg) return;

    if (type === 'svg') {
      const x = new XMLSerializer().serializeToString(svg);
      const src =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        (x.includes('xmlns="http://www.w3.org/2000/svg"') ? x : x.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
      downloadFile('tcc-chart.svg', src, 'image/svg+xml');
      return;
    }

    if (type === 'png') {
      const rect = svg.getBoundingClientRect();
      const W = rect.width || 800;
      const H = rect.height || 600;
      const x = new XMLSerializer().serializeToString(svg);
      const src =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        (x.includes('xmlns="http://www.w3.org/2000/svg"') ? x : x.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
      const img = new Image();
      const scale = 2;
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = W * scale;
        c.height = H * scale;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          c.toBlob((b) => {
            if (b) downloadFile('tcc-chart.png', b, 'image/png');
          });
        }
      };
      img.onerror = () => {
        downloadFile('tcc-chart.svg', src, 'image/svg+xml');
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
      return;
    }

    if (type === 'csv') {
      const lines = ['label,current_A_at_base,t_min_s,t_max_s,t_nominal_s'];
      const X0 = 1, X1 = 1e5;
      for (const it of studyItems) {
        const d = devLookup(it.deviceId);
        const ev = chartView === 'earth' ? E.evaluateEF(d, it) : E.evaluate(d, it);
        if (!ev || ev.none) continue;
        const kScale = (it.kV || baseKV) / baseKV;
        for (const p of E.sample(ev, kScale, X0, X1, 200)) {
          lines.push(
            [
              `"${it.label.replace(/"/g, "'")}"`,
              p.I.toPrecision(5),
              Number.isFinite(p.lo) ? p.lo.toPrecision(5) : '',
              Number.isFinite(p.hi) ? p.hi.toPrecision(5) : '',
              p.nom != null && Number.isFinite(p.nom) ? p.nom.toPrecision(5) : '',
            ].join(',')
          );
        }
      }
      downloadFile('tcc-curves.csv', lines.join('\n'), 'text/csv');
      return;
    }

    if (type === 'report') {
      const L = [
        `# TCC study report`,
        ``,
        `Base voltage ${baseKV} kV · fault level ${faultKA} kA · database ${DB.meta.version}`,
        ``,
        `> ${DB.meta.disclaimer}`,
        ``,
        `## Devices`,
        ``,
        `| Label | Device | Voltage | Settings | Sources |`,
        `|---|---|---|---|---|`,
      ];
      for (const it of studyItems) {
        const d = devLookup(it.deviceId);
        const ev = E.evaluate(d, it);
        L.push(
          `| ${it.label} | ${d.model === 'custom' ? 'Custom curve: ' + d.series : d.manufacturer + ' ' + d.series} | ${it.kV} kV | ${ev.settingsText} | ${
            d.model === 'custom'
              ? 'user-defined points'
              : d.sources.map((s) => `[${DB.sources[s]?.publisher}](${DB.sources[s]?.url})`).join(', ')
          } |`
        );
      }
      L.push(
        '',
        '## Coordination',
        '',
        '| Upstream | Downstream | Pick-up ratio | Selective up to | At fault | Result |',
        '|---|---|---|---|---|---|'
      );
      const selTable = document.querySelector('#sel-table tbody');
      if (selTable) {
        selTable.querySelectorAll('tr').forEach((tr) => {
          const cells = Array.from(tr.children).map((td) => td.textContent?.trim() || '');
          if (cells.length === 6) L.push(`| ${cells.join(' | ')} |`);
        });
      }
      downloadFile('tcc-report.md', L.join('\n'), 'text/markdown');
    }
  };

  const handleSaveStudy = () => {
    const data = JSON.stringify(serializeStudy(), null, 2);
    downloadFile('tcc-study.json', data, 'application/json');
  };

  const handleLoadStudy = async (file: File) => {
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      applyStudy(obj);
    } catch (err: any) {
      alert('Could not read study file: ' + err.message);
    }
  };

  const handleDuplicateItem = (uid: number) => {
    const item = studyItems.find((i) => i.uid === uid);
    if (!item) return;
    const nextUid = nextUidRef.current++;
    const copy: StudyItem = {
      ...item,
      uid: nextUid,
      label: item.label + ' (copy)',
      color: nextColor(studyItems),
      downOf: null,
    };
    const idx = studyItems.findIndex((i) => i.uid === uid);
    const nextList = [...studyItems];
    nextList.splice(idx + 1, 0, copy);
    setStudyItems(nextList);
  };

  const handleDeleteItem = (uid: number) => {
    const item = studyItems.find((i) => i.uid === uid);
    if (!item) return;
    setStudyItems((prev) => {
      const filtered = prev.filter((x) => x.uid !== uid);
      return filtered.map((x) => (x.downOf === uid ? { ...x, downOf: item.downOf } : x));
    });
  };

  const handleUpdateItem = (uid: number, updates: Partial<StudyItem>) => {
    setStudyItems((prev) =>
      prev.map((item) => (item.uid === uid ? { ...item, ...updates } : item))
    );
  };

  // Custom curves handlers
  const handleOpenCustomCurveModal = (def?: DeviceDef) => {
    setEditingCustomCurve(def || null);
    setIsModalOpen(true);
  };

  const handleForgetCurve = (id: string) => {
    const d = customCurves.find((x) => x.id === id);
    if (!d) return;
    const inStudy = studyItems.some((i) => i.deviceId === id);
    if (
      !confirm(
        `Remove “${d.series}” from My curves?${
          inStudy ? ' It stays in the current study.' : ''
        }`
      )
    )
      return;

    setCustomCurves((prev) => {
      if (inStudy) {
        return prev.map((x) => (x.id === id ? { ...x, saved: false } : x));
      }
      return prev.filter((x) => x.id !== id);
    });
  };

  const handleSaveCustomCurve = (def: DeviceDef, saveToLibrary: boolean) => {
    let finalId = def.id;
    if (def.id) {
      // Editing existing
      setCustomCurves((prev) =>
        prev.map((c) => (c.id === def.id ? { ...def, saved: saveToLibrary } : c))
      );
      setStudyItems((prev) =>
        prev.map((i) => {
          if (i.deviceId === def.id) {
            const next = { ...i };
            E.normalize(def, next);
            return next;
          }
          return i;
        })
      );
    } else {
      // New custom curve
      finalId = newCurveId();
      const newDef: DeviceDef = {
        ...def,
        id: finalId,
        saved: saveToLibrary,
      };
      setCustomCurves((prev) => [...prev, newDef]);
      addDevice(finalId, { kV: newDef.kV, label: newDef.series });
    }
    setIsModalOpen(false);
    setEditingCustomCurve(null);
  };

  const handleStartPick = (draftDef: DeviceDef) => {
    setIsModalOpen(false);
    setPickingState({
      active: true,
      curve: draftDef,
    });
  };

  const handleAddPickPoint = (pt: CurvePoint) => {
    setPickingState((prev) => {
      if (!prev.curve) return prev;
      return {
        ...prev,
        curve: {
          ...prev.curve,
          points: [...(prev.curve.points || []), pt],
        },
      };
    });
  };

  const handleUndoPickPoint = () => {
    setPickingState((prev) => {
      if (!prev.curve || !prev.curve.points?.length) return prev;
      const pts = [...prev.curve.points];
      pts.pop();
      return {
        ...prev,
        curve: {
          ...prev.curve,
          points: pts,
        },
      };
    });
  };

  const handleDonePicking = () => {
    if (pickingState.curve) {
      setEditingCustomCurve(pickingState.curve as DeviceDef);
      setIsModalOpen(true);
    }
    setPickingState({ active: false, curve: null });
  };

  const handleLoadPointsFileFromLibrary = async (file: File) => {
    const text = await file.text();
    const pts = E.parsePoints(text);
    const series = file.name.replace(/\.[^.]+$/, '');
    const def: DeviceDef = {
      id: '',
      manufacturer: 'User',
      series,
      category: 'FUSE',
      model: 'custom',
      mode: pts.some((p) => p.t2) ? 'band' : 'line',
      unit: 'A',
      base: 100,
      kV: baseKV,
      extend: true,
      points: pts,
      sources: [],
      ratings: [],
      saved: true,
    };
    handleOpenCustomCurveModal(def);
  };

  return (
    <div>
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSaveStudy={handleSaveStudy}
        onLoadStudy={handleLoadStudy}
        onExport={handleExport}
      />

      <Disclaimer />

      {currentView === 'study' && (
        <StudyView
          studyItems={studyItems}
          customCurves={customCurves}
          baseKV={baseKV}
          onBaseKVChange={setBaseKV}
          faultKA={faultKA}
          onFaultKAChange={setFaultKA}
          efKA={efKA}
          onEfKAChange={setEfKA}
          view={chartView}
          onViewChange={setChartView}
          efPhase={efPhase}
          onEfPhaseChange={setEfPhase}
          xRange={xRange}
          onXRangeChange={setXRange}
          showBands={showBands}
          onShowBandsChange={setShowBands}
          theme={theme}
          onAddDevice={addDevice}
          onUpdateItem={handleUpdateItem}
          onDuplicateItem={handleDuplicateItem}
          onDeleteItem={handleDeleteItem}
          onClearStudy={() => setStudyItems([])}
          onAutoChain={autoChain}
          onOpenCustomCurveModal={handleOpenCustomCurveModal}
          onForgetCurve={handleForgetCurve}
          onLoadPointsFile={handleLoadPointsFileFromLibrary}
          pickingState={{
            active: pickingState.active,
            curve: pickingState.curve,
            onAddPoint: handleAddPickPoint,
            onUndoPoint: handleUndoPickPoint,
            onDonePicking: handleDonePicking,
          }}
          faultAnalysisData={faultAnalysisData}
          chartSvgRef={chartSvgRef}
        />
      )}

      {currentView === 'fault' && (
        <FaultView
          studyItems={studyItems}
          customCurves={customCurves}
          net={net}
          baseKV={baseKV}
          theme={theme}
          onUpdateNet={(updates) => setNet((prev) => ({ ...prev, ...updates }))}
          onUpdateItem={handleUpdateItem}
          onSetChartOriginLevels={(ik3KA, ik1KA) => {
            setFaultKA(ik3KA);
            setEfKA(ik1KA);
          }}
          faultAnalysisData={faultAnalysisData}
        />
      )}

      {currentView === 'database' && <DatabaseView />}

      {currentView === 'method' && <MethodView />}

      <CustomCurveModal
        isOpen={isModalOpen}
        initialDef={editingCustomCurve}
        baseKV={baseKV}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCustomCurve(null);
        }}
        onSave={handleSaveCustomCurve}
        onStartPick={handleStartPick}
      />
    </div>
  );
};
