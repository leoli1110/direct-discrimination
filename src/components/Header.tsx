import React, { useRef, useState, useEffect } from 'react';

interface HeaderProps {
  currentView: 'study' | 'fault' | 'database' | 'method';
  onViewChange: (view: 'study' | 'fault' | 'database' | 'method') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSaveStudy: () => void;
  onLoadStudy: (file: File) => void;
  onExport: (type: 'png' | 'svg' | 'csv' | 'report') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  theme,
  onToggleTheme,
  onSaveStudy,
  onLoadStudy,
  onExport,
}) => {
  const [exportOpen, setExportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <header className="topbar">
      <div className="brand" onClick={() => onViewChange('study')}>
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 3v18h18" />
            <path d="M6 4c1 6 3 9 6 10.5S17 16 18 20" />
            <path d="M9 4c.6 4 2 6.5 4.5 8" />
          </svg>
        </span>
        <span className="brand-name">
          TCC Studio <span className="brand-year">2026</span>
        </span>
      </div>

      <nav className="tabs" role="tablist" aria-label="Views">
        <button
          role="tab"
          className="tab"
          aria-selected={currentView === 'study'}
          onClick={() => onViewChange('study')}
        >
          Study
        </button>
        <button
          role="tab"
          className="tab"
          aria-selected={currentView === 'fault'}
          onClick={() => onViewChange('fault')}
        >
          <span className="tab-long">Fault analysis</span>
          <span className="tab-short">Faults</span>
        </button>
        <button
          role="tab"
          className="tab"
          aria-selected={currentView === 'database'}
          onClick={() => onViewChange('database')}
        >
          Database
        </button>
        <button
          role="tab"
          className="tab"
          aria-selected={currentView === 'method'}
          onClick={() => onViewChange('method')}
        >
          Method
        </button>
      </nav>

      <div className="top-actions">
        <button className="btn ghost" title="Download the study as JSON" onClick={onSaveStudy}>
          Save
        </button>
        <label className="btn ghost" title="Load a study JSON file">
          Load
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onLoadStudy(file);
                e.target.value = '';
              }
            }}
          />
        </label>

        <div className="menu" ref={menuRef}>
          <button
            className="btn ghost"
            aria-haspopup="true"
            aria-expanded={exportOpen}
            onClick={(e) => {
              e.stopPropagation();
              setExportOpen((prev) => !prev);
            }}
          >
            Export
          </button>
          {exportOpen && (
            <div className="menu-pop">
              <button
                onClick={() => {
                  setExportOpen(false);
                  onExport('png');
                }}
              >
                Chart as PNG
              </button>
              <button
                onClick={() => {
                  setExportOpen(false);
                  onExport('svg');
                }}
              >
                Chart as SVG
              </button>
              <button
                onClick={() => {
                  setExportOpen(false);
                  onExport('csv');
                }}
              >
                Curve points (CSV)
              </button>
              <button
                onClick={() => {
                  setExportOpen(false);
                  onExport('report');
                }}
              >
                Settings report (Markdown)
              </button>
            </div>
          )}
        </div>

        <button
          className="btn icon"
          aria-label="Toggle dark mode"
          title="Toggle dark mode"
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
};
