import { useEffect, useRef, useState } from 'react';
import type { PendingLog } from '../App';
import type { SessionPatch } from '../types';
import { FRICTION_CHIPS } from '../types';
import { durationToFields, formatDuration, formatEfficiency, parseDurationFields, type DurationValue } from '../utils';
import { TimeFields } from './TimeFields';

interface Props {
  pending: PendingLog;
  onSave: (sessionId: string, patch: SessionPatch) => void;
  onSkip: (sessionId: string, patch: SessionPatch) => void;
  onDiscard: (sessionId: string) => void;
}

const DEFAULT_UNITS = ['problems', 'words', 'essays', 'pages', 'questions', 'tables'];

export function SessionLogSheet({ pending, onSave, onSkip, onDiscard }: Props) {
  const { session, subjectName } = pending;
  const [notes, setNotes] = useState('');
  const [friction, setFriction] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [focus, setFocus] = useState<DurationValue>(() => durationToFields(session.focusedMs));
  const [pause, setPause] = useState<DurationValue>(() => durationToFields(session.pausedMs));
  const [confirming, setConfirming] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    notesRef.current?.focus();
  }, []);

  const appendChip = (chip: string) => {
    setFriction((f) => (f.trim() ? `${f.trimEnd()}, ${chip.toLowerCase()}` : chip));
  };

  const focusedMs = parseDurationFields(focus.h, focus.m, focus.s);
  const pausedMs = parseDurationFields(pause.h, pause.m, pause.s);
  const timesValid = focusedMs !== null && pausedMs !== null;

  const qtyNum = qty.trim() === '' ? null : Number(qty);
  const validQty = qtyNum !== null && Number.isFinite(qtyNum) && qtyNum > 0;
  const unitTrim = unit.trim();
  // both filled → output counts; anything empty → output unused, never blocks Save
  const output: { qty: number | null; unit: string | null } =
    validQty && unitTrim ? { qty: qtyNum, unit: unitTrim } : { qty: null, unit: null };
  // efficiency preview follows the edited focused time
  const previewMs = focusedMs ?? session.focusedMs;

  const save = () => {
    if (!timesValid || focusedMs === null || pausedMs === null) return;
    const trimmed = notes.trim();
    const frictionTrim = friction.trim();
    onSave(session.id, {
      ...output,
      notes: trimmed ? trimmed : null,
      friction: frictionTrim ? frictionTrim : null,
      focusedMs,
      pausedMs,
    });
  };

  const skip = () => {
    if (!timesValid || focusedMs === null || pausedMs === null) return;
    // Skip notes clears notes only — friction, output, and times are kept
    const frictionTrim = friction.trim();
    onSkip(session.id, {
      ...output,
      notes: null,
      friction: frictionTrim ? frictionTrim : null,
      focusedMs,
      pausedMs,
    });
  };

  return (
    <div className="sheet-overlay">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        <p className="sheet-eyebrow">
          {subjectName} · ended {formatDuration(session.focusedMs)} focused
        </p>
        <h2 id="sheet-title" className="sheet-title">
          {session.modeLabel}
        </h2>

        <TimeFields
          id="log"
          focus={focus}
          pause={pause}
          onFocus={setFocus}
          onPause={setPause}
          valid={timesValid}
        />

        <div className="sheet-section">
          <label className="field-label" htmlFor="notes-input">
            Notes
          </label>
          <textarea
            ref={notesRef}
            id="notes-input"
            className="input notes-input"
            rows={4}
            placeholder="What happened? What moved, what didn’t."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="sheet-section">
          <label className="field-label" htmlFor="friction-input">
            Friction
          </label>
          <input
            id="friction-input"
            className="input"
            placeholder="What slowed you down?"
            value={friction}
            onChange={(e) => setFriction(e.target.value)}
            autoComplete="off"
          />
          <div className="chip-row">
            {FRICTION_CHIPS.map((c) => (
              <button key={c} type="button" className="chip" onClick={() => appendChip(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="sheet-section output-optional">
          <legend className="field-label">Output (if it applies)</legend>
          <p className="helper">Skip this unless the work had a clear count — problems, pages, a paper. Not every session has one.</p>
          <div className="output-row">
            <label className="sr-only" htmlFor="output-qty">
              Output quantity
            </label>
            <input
              id="output-qty"
              className="input input-qty"
              inputMode="decimal"
              placeholder="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <label className="sr-only" htmlFor="output-unit">
              Output unit
            </label>
            <input
              id="output-unit"
              className="input input-unit"
              placeholder="problems, words, pages…"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="chip-row">
            {DEFAULT_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                className={unitTrim.toLowerCase() === u ? 'chip is-active' : 'chip'}
                onClick={() => setUnit(u)}
              >
                {u}
              </button>
            ))}
          </div>
          <p className="eff-preview" aria-live="polite">
            {validQty && unitTrim ? formatEfficiency(qtyNum, unitTrim, previewMs) : '—'}
            {qty.trim() !== '' && !validQty && (
              <span className="eff-preview-label">enter a quantity above zero, or leave blank</span>
            )}
          </p>
        </fieldset>

        <div className="sheet-actions">
          <button type="button" className="btn btn-primary" onClick={save} disabled={!timesValid}>
            Save
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={skip}
            disabled={!timesValid}
          >
            Skip notes
          </button>
          {confirming ? (
            <span className="discard-confirm" role="alert">
              Discard this session?
              <button type="button" className="link-danger" onClick={() => onDiscard(session.id)}>
                Yes, discard
              </button>
              <button type="button" className="link-muted" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirming(true)}>
              Discard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
