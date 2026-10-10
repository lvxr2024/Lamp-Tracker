import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppData } from '../types';
import { defaultBlockSessions, percentOf, type TestFields } from '../results';
import { endOfDay, formatDuration, parseISODate, toISODate } from '../utils';
import { PrepBlockList } from './PrepBlockList';

interface Props {
  data: AppData;
  initialSubjectId: string | null;
  onSave: (fields: TestFields) => void;
  onClose: () => void;
}

export function LogTestSheet({ data, initialSubjectId, onSave, onClose }: Props) {
  const validInitial =
    initialSubjectId && data.subjects.some((s) => s.id === initialSubjectId)
      ? initialSubjectId
      : (data.subjects[0]?.id ?? null);
  const [subjectId, setSubjectId] = useState<string | null>(validInitial);
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState(toISODate(Date.now()));
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const takenAt = endOfDay(parseISODate(dateStr));
  const windowSessions = useMemo(
    () => (subjectId ? defaultBlockSessions(subjectId, takenAt, data) : []),
    // recompute when subject or date changes
    [data, subjectId, takenAt],
  );

  const [checked, setChecked] = useState<ReadonlySet<string>>(
    () => new Set(windowSessions.map((s) => s.id)),
  );

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // default prep block = everything in the window; follows subject/date changes
  const windowKey = `${subjectId ?? ''}|${dateStr}`;
  const [appliedKey, setAppliedKey] = useState(windowKey);
  if (appliedKey !== windowKey) {
    setAppliedKey(windowKey);
    setChecked(new Set(windowSessions.map((s) => s.id)));
  }

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
  const validScore =
    scoreNum !== null && Number.isFinite(scoreNum) && scoreNum >= 0;
  const validMax = maxNum !== null && Number.isFinite(maxNum) && maxNum > 0;
  const scoresValid = validScore && validMax && (scoreNum as number) <= (maxNum as number);

  const draft = useMemo(
    () =>
      scoresValid
        ? { score: scoreNum as number, maxScore: maxNum as number }
        : null,
    [scoresValid, scoreNum, maxNum],
  );
  const percent = draft ? Math.round(percentOf(draft)) : null;

  const blockMs = windowSessions
    .filter((s) => checked.has(s.id))
    .reduce((sum, s) => sum + s.focusedMs, 0);
  const blockCount = windowSessions.filter((s) => checked.has(s.id)).length;

  const noSubjects = data.subjects.length === 0;
  const canSave =
    !noSubjects &&
    subjectId !== null &&
    title.trim() !== '' &&
    scoresValid &&
    blockCount > 0;

  const save = () => {
    if (!canSave || !subjectId || !draft) return;
    onSave({
      subjectId,
      title: title.trim(),
      takenAt,
      score: draft.score,
      maxScore: draft.maxScore,
      feedback: feedback.trim(),
      sessionIds: windowSessions.filter((s) => checked.has(s.id)).map((s) => s.id),
    });
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-test-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="sheet-eyebrow">Log a test</p>
        <h2 id="log-test-title" className="sheet-title">
          What did you sit?
        </h2>

        {noSubjects ? (
          <p className="empty empty-small">Add a subject from Focus first.</p>
        ) : (
          <>
            <div className="sheet-section">
              <span className="field-label" id="log-test-subject-label">
                Subject
              </span>
              <div className="segmented" role="group" aria-labelledby="log-test-subject-label">
                {data.subjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={subjectId === s.id ? 'seg is-active' : 'seg'}
                    onClick={() => setSubjectId(s.id)}
                    aria-pressed={subjectId === s.id}
                  >
                    <span className={`tick tick-${s.color}`} aria-hidden="true" />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet-section">
              <label className="field-label" htmlFor="log-test-title-input">
                Title
              </label>
              <input
                ref={titleRef}
                id="log-test-title-input"
                className="input"
                placeholder="AMC 10 2023 A, IGCSE Econ Paper 2 mock…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="sheet-section">
              <label className="field-label" htmlFor="log-test-date">
                Date taken
              </label>
              <input
                id="log-test-date"
                className="input input-date"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>

            <fieldset className="sheet-section">
              <legend className="field-label">Score</legend>
              <div className="output-row">
                <label className="sr-only" htmlFor="log-test-score">
                  Score
                </label>
                <input
                  id="log-test-score"
                  className="input input-qty"
                  inputMode="decimal"
                  placeholder="18"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
                <span className="score-sep" aria-hidden="true">
                  /
                </span>
                <label className="sr-only" htmlFor="log-test-max">
                  Maximum score
                </label>
                <input
                  id="log-test-max"
                  className="input input-qty"
                  inputMode="decimal"
                  placeholder="25"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                />
                <span className="eff-preview" aria-live="polite">
                  {percent !== null ? `(${percent}%)` : '—'}
                  {score.trim() !== '' && maxScore.trim() !== '' && !scoresValid && (
                    <span className="eff-preview-label">score must be between 0 and max</span>
                  )}
                </span>
              </div>
            </fieldset>

            <div className="sheet-section">
              <label className="field-label" htmlFor="log-test-feedback">
                Feedback
              </label>
              <input
                id="log-test-feedback"
                className="input"
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
                {blockCount} {blockCount === 1 ? 'session' : 'sessions'} ·{' '}
                {formatDuration(blockMs)}
                {blockCount === 0 && windowSessions.length > 0 && (
                  <span className="eff-preview-label"> check at least one session</span>
                )}
              </p>
            </div>
          </>
        )}

        <div className="sheet-actions">
          <button type="button" className="btn btn-primary" onClick={save} disabled={!canSave}>
            Save
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
