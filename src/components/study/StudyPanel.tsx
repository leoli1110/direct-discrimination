import React, { useState } from 'react';
import { DeviceDef, StudyItem } from '../../types';
import { DB } from '../../data/db';
import { StudyCard } from './StudyCard';

interface StudyPanelProps {
  studyItems: StudyItem[];
  customCurves: DeviceDef[];
  theme: 'light' | 'dark';
  onUpdateItem: (uid: number, updates: Partial<StudyItem>) => void;
  onDuplicateItem: (uid: number) => void;
  onDeleteItem: (uid: number) => void;
  onClearStudy: () => void;
  onEditCustomPoints: (device: DeviceDef) => void;
}

export const StudyPanel: React.FC<StudyPanelProps> = ({
  studyItems,
  customCurves,
  theme,
  onUpdateItem,
  onDuplicateItem,
  onDeleteItem,
  onClearStudy,
  onEditCustomPoints,
}) => {
  const [collapsedUids, setCollapsedUids] = useState<Set<number>>(new Set());

  const toggleCollapse = (uid: number) => {
    setCollapsedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const getDevice = (id: string): DeviceDef => {
    return (
      customCurves.find((d) => d.id === id) ||
      DB.devices.find((d) => d.id === id) || {
        id,
        category: 'OTHER',
        manufacturer: 'Unknown',
        series: 'Unknown',
        model: 'mcb',
        sources: [],
      }
    );
  };

  return (
    <aside className="panel studypanel" aria-label="Study devices">
      <div className="panel-head">
        <h2>Study</h2>
        {studyItems.length > 0 && (
          <button className="btn small ghost" onClick={onClearStudy}>
            Clear
          </button>
        )}
      </div>

      <div className="study-list" id="study-list">
        {studyItems.length === 0 ? (
          <p className="study-empty">
            No devices yet. Pick a breaker or relay from the library — each one is plotted with its tolerance band and linked to its datasheet.
          </p>
        ) : (
          studyItems.map((item) => (
            <StudyCard
              key={item.uid}
              item={item}
              device={getDevice(item.deviceId)}
              otherItems={studyItems.filter((o) => o.uid !== item.uid)}
              isCollapsed={collapsedUids.has(item.uid)}
              theme={theme}
              onUpdateItem={onUpdateItem}
              onToggleCollapse={toggleCollapse}
              onDuplicate={onDuplicateItem}
              onDelete={onDeleteItem}
              onEditCustomPoints={onEditCustomPoints}
            />
          ))
        )}
      </div>
    </aside>
  );
};
