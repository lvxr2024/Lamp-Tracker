import { useMemo, useState } from 'react';
import type { AppData, BlockReading, Test } from '../types';
import { analyzeTest, blockPayload, defaultBlockSessions } from '../results';
import type { TestFields } from '../results';
import { endOfDay, formatDuration, formatTestDate, parseISODate, toISODate } from '../utils';
import { PrepBlockList } from './PrepBlockList';
import { BlockReader } from './BlockReader';

interface Props {
  test: Test;
  data: AppData;
  subjectName: string;
  onSave: (id: string, patch: TestFields) => void;
  onSaveReading: (reading: BlockReading) => void;
  onApplyNextMode: (subjectId: string, modeLabel: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function TestDetailSheet({
  test,
  data,
  subjectName,
  onSave,
  onSaveReading,
  onApplyNextMode,
  onDelete,
  onClose,
}: Props) {
  const [title, setTitle] = useState(test.title);
  const [dateStr, setDateStr] = useState(toISODate(test.takenAt));
  const [score, setScore] = useState(String(test.score));
  const [maxScore, setMaxScore] = useState(String(test.maxScore));
  const [feedback, setFeedback] = useState(test.feedback);
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);

  const takenAt = endOfDay(parseISODate(dateStr));
  // window follows subject (fixed here) and the edited date; excludes this test.
  // Already-attached sessions stay listed even when they fall before the
  // previous test's cutoff, so saving never silently detaches them.
  const windowSessions = useMemo(() => {
    const base = defaultBlockSessions(test.subjectId, takenAt, data, test.id);
    const inWindow = new Set(base.map((s) => s.id));
    const attached = data.sessions.filter(
      (s) =>
        s.subjectId === test.subjectId &&
        test.sessionIds.includes(s.id) &&
        !inWindow.has(s.id),
    );
    return [...attached, ...base].sort((a, b) => b.endedAt - a.endedAt);
  }, [data, test.subjectId, test.id, test.sessionIds, takenAt]);
  const [checked, setChecked] = useState<ReadonlySet<string>>(
    () => new Set(test.sessionIds.filter((id) => windowSessions.some((s) => s.id === id))),
  );

  const toggle = (id: string, on: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const scoreNum = score.trim() === '' ? null : Number(score);
  const maxNum = maxScore.trim() === '' ? null : Number(maxScore);
  const scoresValid =
    scoreNum !== null &&
    maxNum !== null &&
    Number.isFinite(scoreNum) &&
    Number.isFinite(maxNum) &&
    maxNum > 0 &&
    scoreNum >= 0 &&
    scoreNum <= maxNum;

  // live recalculation of gain + verdict from the edited draft
  const draft: Test = useMemo(
    () => ({
      ...test,
      title: title.trim(),
      takenAt,
      score: scoresValid ? (scoreNum as number) : test.score,
      maxScore: scoresValid ? (maxNum as number) : test.maxScore,
      feedback: feedback.trim(),
      sessionIds: windowSessions.filter((s) => checked.has(s.id)).map((s) => s.id),
    }),
    [test, title, takenAt, scoresValid, scoreNum, maxNum, feedback, windowSessions, checked],
  );
  const a = useMemo(() => analyzeTest(draft, data), [draft, data]);
  const readingPayload = useMemo(
    () =>
      blockPayload({
        subjectName,
        test: draft,
        previousTest: a.previous,
        sessions: a.sessions,
      }),
    [subjectName, draft, a],
  );

  const save = () => {
    if (!scoresValid || title.trim() === '' || draft.sessionIds.length === 0) return;
    onSave(test.id, {
      subjectId: test.subjectId,
      title: title.trim(),
      takenAt,
      score: scoreNum as number,
      maxScore: maxNum as number,
      feedback: feedback.trim(),
      sessionIds: draft.sessionIds,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const gainLabel =
    a.gainPercent === null
      ? 'first'
      : `${a.gainPercent > 0 ? '+' : a.gainPercent < 0 ? '−' : '±'}${Math.abs(Math.round(a.gainPercent))}pp vs last`;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="sheet-eyebrow">
          {subjectName} · {formatTestDate(takenAt)}
        </p>

        <div className="sheet-section">
          <label className="sr-only" htmlFor="edit-test-title">
            Title
          </label>
          <input
            id="edit-test-title"
            className="input test-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
          />
        </div>

        <p className="verdict-line">{a.verdict}</p>
        <p className="verdict-nums">
          {draft.score} / {draft.maxScore} ({Math.round(a.percent)}%) · {gainLabel}
        </p>
        <p className="verdict-nums">
          Prep · {formatDuration(a.block.focusedMs)} · {a.block.sessionCount}{' '}
          {a.block.sessionCount === 1 ? 'session' : 'sessions'}
          {a.block.avgEfficiency !== null && a.block.unit !== null && (
            <> · {a.block.avgEfficiency.toFixed(1)} {a.block.unit}/hour</>
          )}
        </p>
        {a.speedDeltaPct !== null && a.prevBlock && (
          <p className="verdict-nums">
            Last prep · {formatDuration(a.prevBlock.focusedMs)} ·{' '}
            {(a.prevBlock.avgEfficiency as number).toFixed(1)} {a.prevBlock.unit}/hour
          </p>
        )}

        <div className="sheet-section">
          <label className="field-label" htmlFor="edit-test-date">
            Date taken
          </label>
          <input
            id="edit-test-date"
            className="input input-date"
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
          />
        </div>

        <fieldset className="sheet-section">
          <legend className="field-label">Score</legend>
          <div className="output-row">
            <label className="sr-only" htmlFor="edit-test-score">
              Score
            </label>
            <input
              id="edit-test-score"
              className="input input-qty"
              inputMode="decimal"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
            <span className="score-sep" aria-hidden="true">
              /
            </span>
            <label className="sr-only" htmlFor="edit-test-max">
              Maximum score
            </label>
            <input
              id="edit-test-max"
              className="input input-qty"
              inputMode="decimal"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
            />
            <span className="eff-preview" aria-live="polite">
              {scoresValid ? `(${Math.round((scoreNum! / maxNum!) * 100)}%)` : '—'}
              {!scoresValid && score.trim() !== '' && maxScore.trim() !== '' && (
                <span className="eff-preview-label">score must be between 0 and max</span>
              )}
            </span>
          </div>
        </fieldset>

        <div className="sheet-section">
          <label className="field-label" htmlFor="edit-test-feedback">
            Feedback
          </label>
          <textarea
            id="edit-test-feedback"
            className="input notes-input"
            rows={4}
            placeholder="What did the paper show you?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="sheet-section">
          <span className="field-label">Prep block</span>
          <PrepBlockList sessions={windowSessions} checked={checked} onToggle={toggle} />
          <p className="prep-summary" aria-live="polite">
            {a.block.sessionCount} {a.block.sessionCount === 1 ? 'session' : 'sessions'} ·{' '}
            {formatDuration(a.block.focusedMs)}
          </p>
        </div>

        <BlockReader
          payload={readingPayload}
          subjectId={test.subjectId}
          initialReading={test.reading}
          onSave={onSaveReading}
          onNextMode={onApplyNextMode}
        />

        <div className="sheet-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={!scoresValid || title.trim() === '' || draft.sessionIds.length === 0}
          >
            {saved ? 'Saved' : 'Save changes'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {confirming ? (
            <span className="discard-confirm" role="alert">
              Delete this test?
              <button type="button" className="link-danger" onClick={() => onDelete(test.id)}>
                Yes, delete
              </button>
              <button type="button" className="link-muted" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="btn btn-ghost-danger"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
