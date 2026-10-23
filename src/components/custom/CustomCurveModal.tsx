import React, { useState, useEffect } from 'react';
import { CurvePoint, DeviceDef } from '../../types';
import * as E from '../../engine/engine';

interface CustomCurveModalProps {
  isOpen: boolean;
  initialDef: DeviceDef | null;
  baseKV: number;
  onClose: () => void;
  onSave: (def: DeviceDef, saveToLibrary: boolean) => void;
  onStartPick: (draftDef: DeviceDef) => void;
}

export const CustomCurveModal: React.FC<CustomCurveModalProps> = ({
  isOpen,
  initialDef,
  baseKV,
  onClose,
  onSave,
  onStartPick,
}) => {
  const [draft, setDraft] = useState<DeviceDef>({
    id: '',
    manufacturer: 'User',
    series: '',
    category: 'FUSE',
    model: 'custom',
    mode: 'line',
    unit: 'A',
    base: 100,
    kV: baseKV,
    extend: true,
    points: [],
    sources: [],
    ratings: [],
  });

  const [keepInLibrary, setKeepInLibrary] = useState(true);
  const [pasteText, setPasteText] = useState('');
  const [messages, setMessages] = useState<{ level: 'error' | 'warn' | 'info'; text: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (initialDef) {
        setDraft(JSON.parse(JSON.stringify(initialDef)));
        setKeepInLibrary(initialDef.saved ?? true);
      } else {
        setDraft({
          id: '',
          manufacturer: 'User',
          series: '',
          category: 'FUSE',
          model: 'custom',
          mode: 'line',
          unit: 'A',
          base: 100,
          kV: baseKV,
          extend: true,
          points: [
            { I: 100, t: 100 },
            { I: 200, t: 10 },
          ],
          sources: [],
          ratings: [],
        });
        setKeepInLibrary(true);
      }
      setPasteText('');
    }
  }, [isOpen, initialDef, baseKV]);

  useEffect(() => {
    if (!isOpen) return;
    const m = E.checkPoints(draft);
    if (!String(draft.series || '').trim()) {
      m.unshift({ level: 'error', text: 'Give the curve a name.' });
    }
    setMessages(m);
  }, [draft, isOpen]);

  if (!isOpen) return null;

  const isEditing = !!draft.id;
  const hasErrors = messages.some((m) => m.level === 'error');

  const handleAddPoint = () => {
    const p = E.sortPts(draft.points || []);
    const last = p[p.length - 1];
    const newPt: CurvePoint = last
      ? { I: +(last.I * 2).toPrecision(4), t: +(Math.max(last.t / 5, 0.01)).toPrecision(3) }
      : { I: 100, t: 100 };
    if (draft.mode === 'band' && last?.t2) {
      newPt.t2 = +(Math.max(last.t2 / 5, 0.01)).toPrecision(3);
    }
    setDraft((prev) => ({
      ...prev,
      points: [...(prev.points || []), newPt],
    }));
  };

  const handleUpdatePoint = (idx: number, field: keyof CurvePoint, rawVal: string) => {
    const val = +rawVal.replace(',', '.');
    setDraft((prev) => {
      const nextPts = [...(prev.points || [])];
      nextPts[idx] = { ...nextPts[idx], [field]: val };
      return { ...prev, points: nextPts };
    });
  };

  const handleDeletePoint = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      points: (prev.points || []).filter((_, i) => i !== idx),
    }));
  };

  const handleSortPoints = () => {
    setDraft((prev) => ({
      ...prev,
      points: E.sortPts(prev.points || []),
    }));
  };

  const handleLoadPointsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    e.target.value = '';
    const pts = E.parsePoints(text);
    if (!pts.length) {
      setMessages((prev) => [{ level: 'error', text: `No current–time pairs found in ${file.name}.` }, ...prev]);
      return;
    }
    setDraft((prev) => {
      const mode = pts.some((p) => p.t2) ? 'band' : prev.mode;
      const series = prev.series || file.name.replace(/\.[^.]+$/, '');
      return { ...prev, series, mode, points: pts };
    });
    setMessages((prev) => [{ level: 'info', text: `Loaded ${pts.length} points from ${file.name}.` }, ...prev]);
  };

  const handlePaste = (append: boolean) => {
    const pts = E.parsePoints(pasteText);
    if (!pts.length) {
      setMessages((prev) => [{ level: 'error', text: 'No current–time pairs found in the pasted text.' }, ...prev]);
      return;
    }
    setDraft((prev) => {
      const mode = pts.some((p) => p.t2) ? 'band' : prev.mode;
      const newPts = append ? (prev.points || []).concat(pts) : pts;
      return { ...prev, mode, points: newPts };
    });
    setMessages((prev) => [{ level: 'info', text: `${append ? 'Appended' : 'Loaded'} ${pts.length} points.` }, ...prev]);
  };

  const handleSaveTxt = () => {
    const content = E.formatPoints(draft);
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(draft.series || 'custom-curve').replace(/[^\w.-]+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors) return;
    const cleaned: DeviceDef = {
      ...draft,
      series: draft.series.trim(),
      points: E.sortPts(draft.points || []).map((p) =>
        draft.mode === 'band' ? { I: p.I, t: p.t, t2: p.t2 ?? p.t } : { I: p.I, t: p.t }
      ),
      saved: keepInLibrary,
    };
    onSave(cleaned, keepInLibrary);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="cc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <form className="cc-form" onSubmit={handleSubmit}>
          <div className="cc-head">
            <h2 id="cc-title">{isEditing ? 'Edit custom curve' : 'New custom curve'}</h2>
            <button
              type="button"
              className="btn small ghost"
              onClick={onClose}
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>

          <div className="cc-body">
            <div className="cc-meta">
              <label className="ctl">
                Curve name
                <input
                  type="text"
                  required
                  value={draft.series}
                  onChange={(e) => setDraft((prev) => ({ ...prev, series: e.target.value }))}
                  placeholder="e.g. 160 A gG fuse"
                  autoFocus
                />
              </label>

              <label className="ctl">
                Category
                <select
                  value={draft.category}
                  onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value as any }))}
                >
                  <option value="FUSE">Fuse</option>
                  <option value="MCB">MCB</option>
                  <option value="MCCB">MCCB</option>
                  <option value="ACB">ACB</option>
                  <option value="RELAY">Relay</option>
                  <option value="DAMAGE">Damage / withstand</option>
                  <option value="EARTH">Earth fault / RCD</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>

              <label className="ctl">
                Device voltage (kV)
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={draft.kV ?? 0.4}
                  onChange={(e) => setDraft((prev) => ({ ...prev, kV: +e.target.value || 0.4 }))}
                />
              </label>

              <label className="ctl">
                Mode
                <select
                  value={draft.mode}
                  onChange={(e) => setDraft((prev) => ({ ...prev, mode: e.target.value as 'line' | 'band' }))}
                >
                  <option value="line">Single line</option>
                  <option value="band">Tolerance band (min / max)</option>
                </select>
              </label>

              <label className="ctl">
                Current unit
                <select
                  value={draft.unit}
                  onChange={(e) => setDraft((prev) => ({ ...prev, unit: e.target.value as 'A' | 'x' }))}
                >
                  <option value="A">Amperes (A)</option>
                  <option value="x">Multiples of a base current (×base)</option>
                </select>
              </label>

              {draft.unit === 'x' && (
                <label className="ctl">
                  Base current (A)
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={draft.base ?? 100}
                    onChange={(e) => setDraft((prev) => ({ ...prev, base: +e.target.value || 100 }))}
                  />
                </label>
              )}

              <label className="toggle wide">
                <input
                  type="checkbox"
                  checked={draft.extend !== false}
                  onChange={(e) => setDraft((prev) => ({ ...prev, extend: e.target.checked }))}
                />{' '}
                Extend the last time above the highest current point (otherwise the curve ends)
              </label>
            </div>

            <div>
              <div className="cc-points-head">
                <h3>
                  Current–time points{' '}
                  <span className="faint">({draft.points?.length || 0})</span>
                </h3>
                <div className="cc-tools">
                  <button type="button" className="btn small" onClick={handleAddPoint}>
                    + Add point
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => onStartPick(draft)}
                  >
                    Pick points on chart
                  </button>
                  <label className="btn small ghost">
                    Load file
                    <input
                      type="file"
                      accept=".txt,.csv,.tsv,text/plain,text/csv"
                      hidden
                      onChange={handleLoadPointsFile}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={handleSaveTxt}
                    disabled={!draft.points?.length}
                  >
                    Save as .txt
                  </button>
                </div>
              </div>

              <div className="cc-table-wrap">
                <table className="cc-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Current ({draft.unit === 'x' ? '×base' : 'A'})</th>
                      <th>{draft.mode === 'band' ? 'Min time (s)' : 'Time (s)'}</th>
                      {draft.mode === 'band' && <th>Max time (s)</th>}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {!draft.points?.length ? (
                      <tr className="empty-row">
                        <td colSpan={draft.mode === 'band' ? 5 : 4}>
                          No points yet — add points, paste a list, load a .txt/.csv file or pick them on the chart.
                        </td>
                      </tr>
                    ) : (
                      draft.points.map((p, i) => (
                        <tr key={i}>
                          <td className="idx">{i + 1}</td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={p.I}
                              onChange={(e) => handleUpdatePoint(i, 'I', e.target.value)}
                              onBlur={handleSortPoints}
                              aria-label={`Current point ${i + 1}`}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={p.t}
                              onChange={(e) => handleUpdatePoint(i, 't', e.target.value)}
                              onBlur={handleSortPoints}
                              aria-label={`Time point ${i + 1}`}
                            />
                          </td>
                          {draft.mode === 'band' && (
                            <td>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={p.t2 ?? p.t}
                                onChange={(e) => handleUpdatePoint(i, 't2', e.target.value)}
                                onBlur={handleSortPoints}
                                aria-label={`Maximum time point ${i + 1}`}
                              />
                            </td>
                          )}
                          <td className="del">
                            <button
                              type="button"
                              title="Delete point"
                              aria-label={`Delete point ${i + 1}`}
                              onClick={() => handleDeletePoint(i)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <details className="cc-paste">
                <summary>Paste a points list</summary>
                <div style={{ marginTop: '8px' }}>
                  <textarea
                    rows={4}
                    placeholder={`# current_A  time_s  [t_max_s]\n400  900  4000\n600  40  200\n1000  1.5  6`}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => handlePaste(false)}
                      disabled={!pasteText.trim()}
                    >
                      Replace points
                    </button>
                    <button
                      type="button"
                      className="btn small ghost"
                      onClick={() => handlePaste(true)}
                      disabled={!pasteText.trim()}
                    >
                      Append points
                    </button>
                  </div>
                </div>
              </details>

              {messages.length > 0 && (
                <ul className="cc-msgs">
                  {messages.map((m, idx) => (
                    <li key={idx} className={m.level}>
                      {m.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="cc-foot">
            <label className="toggle">
              <input
                type="checkbox"
                checked={keepInLibrary}
                onChange={(e) => setKeepInLibrary(e.target.checked)}
              />{' '}
              Save to “My curves” (travels with the study)
            </label>

            <div className="cc-foot-actions">
              <button type="button" className="btn ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={hasErrors}
              >
                {isEditing ? 'Save changes' : 'Add to study'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
