import { useMemo, useState } from 'react';
import type { AppData, Session, SessionPatch } from '../types';
import { FRICTION_CHIPS } from '../types';
import { dayLabel, durationToFields, formatDuration, formatEfficiency, parseDurationFields } from '../utils';
import { TimeFields } from './TimeFields';

interface Props {
  data: AppData;
  onEdit: (sessionId: string, patch: SessionPatch) => void;
}

export function SessionsScreen({ data, onEdit }: Props) {
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [hasNotes, setHasNotes] = useState(false);
  const [hasFriction, setHasFriction] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessions = useMemo(() => {
    let list = [...data.sessions].sort((a, b) => b.endedAt - a.endedAt);
    if (subjectFilter !== 'all') list = list.filter((s) => s.subjectId === subjectFilter);
    if (hasNotes) list = list.filter((s) => !!s.notes);
    if (hasFriction) list = list.filter((s) => !!s.friction);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        [s.modeLabel, s.notes ?? '', s.friction ?? ''].some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [data.sessions, subjectFilter, hasNotes, hasFriction, query]);

  // group by day
  const groups: { label: string; items: Session[] }[] = [];
  for (const s of sessions) {
    const label = dayLabel(s.endedAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(s);
    else groups.push({ label, items: [s] });
  }

  const selected = data.sessions.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="screen">
      <h1 className="screen-title">Sessions</h1>

      <div className="filters">
        <label className="sr-only" htmlFor="filter-subject">
          Filter by subject
        </label>
        <select
          id="filter-subject"
          className="input input-select"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="all">All subjects</option>
          {data.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={hasNotes}
            onChange={(e) => setHasNotes(e.target.checked)}
          />
          Has notes
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={hasFriction}
            onChange={(e) => setHasFriction(e.target.checked)}
          />
          Has friction
        </label>
        <label className="sr-only" htmlFor="filter-search">
          Search sessions
        </label>
        <input
          id="filter-search"
          className="input"
          placeholder="Search mode, notes, friction…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {groups.length === 0 ? (
        <p className="empty">No sessions yet. Start one from Focus.</p>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="day-group">
            <h2 className="day-label">{g.label}</h2>
            <ul className="session-list">
              {g.items.map((s) => {
                const subject = data.subjects.find((sub) => sub.id === s.subjectId);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="session-row"
                      onClick={() => setSelectedId(s.id)}
                    >
                      <span className={`tick tick-${subject?.color ?? 'slate'}`} aria-hidden="true" />
                      <span className="session-main">
                        <span className="session-mode">{s.modeLabel}</span>
                        <span className="session-subject">{subject?.name ?? 'Unknown subject'}</span>
                        {s.notes && <span className="session-friction">Notes · {s.notes}</span>}
                        {s.friction && <span className="session-friction">Friction · {s.friction}</span>}
                      </span>
                      <span className="session-side">
                        <span className="session-dur">{formatDuration(s.focusedMs)}</span>
                        {s.pausedMs > 0 && (
                          <span className="session-eff">+{formatDuration(s.pausedMs)} paused</span>
                        )}
                        {s.outputQuantity !== null && s.outputUnit && (
                          <span className="session-eff">
                            {s.outputQuantity} {s.outputUnit} ·{' '}
                            {formatEfficiency(s.outputQuantity, s.outputUnit, s.focusedMs)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {selected && (
        <SessionDetail
          key={selected.id}
          session={selected}
          subjectName={data.subjects.find((s) => s.id === selected.subjectId)?.name ?? ''}
          onClose={() => setSelectedId(null)}
          onEdit={onEdit}
        />
      )}
    </div>
  );
}

function SessionDetail({
  session,
  subjectName,
  onClose,
  onEdit,
}: {
  session: Session;
  subjectName: string;
  onClose: () => void;
  onEdit: Props['onEdit'];
}) {
  const [notes, setNotes] = useState(session.notes ?? '');
  const [friction, setFriction] = useState(session.friction ?? '');
  const [focus, setFocus] = useState(() => durationToFields(session.focusedMs));
  const [pause, setPause] = useState(() => durationToFields(session.pausedMs));
  const [qty, setQty] = useState(
    session.outputQuantity !== null ? String(session.outputQuantity) : '',
  );
  const [unit, setUnit] = useState(session.outputUnit ?? '');
  const [saved, setSaved] = useState(false);

  const focusedMs = parseDurationFields(focus.h, focus.m, focus.s);
  const pausedMs = parseDurationFields(pause.h, pause.m, pause.s);
  const timesValid = focusedMs !== null && pausedMs !== null;
  const qtyNum = qty.trim() === '' ? null : Number(qty);
  const validQty = qtyNum !== null && Number.isFinite(qtyNum) && qtyNum > 0;
  const unitTrim = unit.trim();
  const hasOutput = validQty && unitTrim !== '';

  const save = () => {
    if (!timesValid || focusedMs === null || pausedMs === null) return;
    const trimmed = notes.trim();
    const frictionTrim = friction.trim();
    onEdit(session.id, {
      notes: trimmed ? trimmed : null,
      friction: frictionTrim ? frictionTrim : null,
      qty: hasOutput ? qtyNum : null,
      unit: hasOutput ? unitTrim : null,
      focusedMs,
      pausedMs,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="sheet-eyebrow">
          {subjectName} · {dayLabel(session.endedAt)}
        </p>
        <h2 id="detail-title" className="sheet-title">
          {session.modeLabel}
        </h2>

        <TimeFields
          id="edit"
          focus={focus}
          pause={pause}
          onFocus={setFocus}
          onPause={setPause}
          valid={timesValid}
        />

        <div className="sheet-section">
          <label className="field-label" htmlFor="edit-notes">
            Notes
          </label>
          <textarea
            id="edit-notes"
            className="input notes-input"
            rows={4}
            placeholder="What happened? What moved, what didn’t."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="sheet-section">
          <label className="field-label" htmlFor="edit-friction">
            Friction
          </label>
          <input
            id="edit-friction"
            className="input"
            placeholder="What slowed you down?"
            value={friction}
            onChange={(e) => setFriction(e.target.value)}
            autoComplete="off"
          />
          <div className="chip-row">
            {FRICTION_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                className="chip"
                onClick={() =>
                  setFriction((f) => (f.trim() ? `${f.trimEnd()}, ${c.toLowerCase()}` : c))
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="sheet-section output-optional">
          <legend className="field-label">Output (if it applies)</legend>
          <div className="output-row">
            <label className="sr-only" htmlFor="edit-qty">
              Output quantity
            </label>
            <input
              id="edit-qty"
              className="input input-qty"
              inputMode="decimal"
              placeholder="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <label className="sr-only" htmlFor="edit-unit">
              Output unit
            </label>
            <input
              id="edit-unit"
              className="input input-unit"
              placeholder="problems, words, pages…"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              autoComplete="off"
            />
          </div>
          <p className="eff-preview" aria-live="polite">
            {hasOutput ? formatEfficiency(qtyNum, unitTrim, focusedMs ?? 0) : '—'}
            {qty.trim() !== '' && !validQty && (
              <span className="eff-preview-label">enter a quantity above zero, or leave blank</span>
            )}
          </p>
        </fieldset>

        <div className="sheet-actions">
          <button type="button" className="btn btn-primary" onClick={save} disabled={!timesValid}>
            {saved ? 'Saved' : 'Save changes'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
