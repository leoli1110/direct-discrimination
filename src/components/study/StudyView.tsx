import React from 'react';
import { CurvePoint, DeviceDef, StudyItem } from '../../types';
import { LibraryPanel } from './LibraryPanel';
import { ChartCard } from './ChartCard';
import { CoordinationSection } from './CoordinationSection';
import { StudyPanel } from './StudyPanel';

interface StudyViewProps {
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
  onAddDevice: (deviceId: string) => void;
  onUpdateItem: (uid: number, updates: Partial<StudyItem>) => void;
  onDuplicateItem: (uid: number) => void;
  onDeleteItem: (uid: number) => void;
  onClearStudy: () => void;
  onAutoChain: () => void;
  onOpenCustomCurveModal: (def?: DeviceDef) => void;
  onForgetCurve: (id: string) => void;
  onLoadPointsFile: (file: File) => void;
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

export const StudyView: React.FC<StudyViewProps> = ({
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
  onAddDevice,
  onUpdateItem,
  onDuplicateItem,
  onDeleteItem,
  onClearStudy,
  onAutoChain,
  onOpenCustomCurveModal,
  onForgetCurve,
  onLoadPointsFile,
  pickingState,
  faultAnalysisData,
  chartSvgRef,
}) => {
  return (
    <main className="view study">
      <LibraryPanel
        customCurves={customCurves}
        studyItems={studyItems}
        onAddDevice={onAddDevice}
        onOpenCustomCurveModal={onOpenCustomCurveModal}
        onForgetCurve={onForgetCurve}
        onLoadPointsFile={onLoadPointsFile}
      />

      <section className="center">
        <ChartCard
          studyItems={studyItems}
          customCurves={customCurves}
          baseKV={baseKV}
          onBaseKVChange={onBaseKVChange}
          faultKA={faultKA}
          onFaultKAChange={onFaultKAChange}
          efKA={efKA}
          onEfKAChange={onEfKAChange}
          view={view}
          onViewChange={onViewChange}
          efPhase={efPhase}
          onEfPhaseChange={onEfPhaseChange}
          xRange={xRange}
          onXRangeChange={onXRangeChange}
          showBands={showBands}
          onShowBandsChange={onShowBandsChange}
          theme={theme}
          pickingState={pickingState}
          faultAnalysisData={faultAnalysisData}
          chartSvgRef={chartSvgRef}
        />

        <CoordinationSection
          studyItems={studyItems}
          customCurves={customCurves}
          baseKV={baseKV}
          faultKA={faultKA}
          efKA={efKA}
          view={view}
          efPhase={efPhase}
          theme={theme}
          onAutoChain={onAutoChain}
        />
      </section>

      <StudyPanel
        studyItems={studyItems}
        customCurves={customCurves}
        theme={theme}
        onUpdateItem={onUpdateItem}
        onDuplicateItem={onDuplicateItem}
        onDeleteItem={onDeleteItem}
        onClearStudy={onClearStudy}
        onEditCustomPoints={onOpenCustomCurveModal}
      />
    </main>
  );
};
