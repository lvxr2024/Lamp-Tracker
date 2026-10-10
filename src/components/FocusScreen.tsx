import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppData, SubjectColor } from '../types';
import { SUBJECT_COLORS } from '../types';
import { useNow } from '../hooks/useNow';
import { activeFocusedMs, activePausedMs, formatDuration, sameDay } from '../utils';
import { TimerDisplay } from './TimerDisplay';
import { ManageSubjectsSheet } from './ManageSubjectsSheet';

interface Props {
  data: AppData;
  onStart: (subjectId: string, modeLabel: string) => void;
  onPause: () => void;
  onEnd: () => void;
  onAddSubject: (name: string, color: SubjectColor) => string;
  onRenameSubject: (id: string, name: string, color: SubjectColor) => void;
  onDeleteSubject: (id: string) => void;
}

export function FocusScreen({
  data,
  onStart,
  onPause,
  onEnd,
  onAddSubject,
  onRenameSubject,
  onDeleteSubject,
}: Props) {
  const active = data.activeSession;
  if (active) {
    return <RunningView subjectName={data.subjects.find((s) => s.id === active.subjectId)?.name} active={active} onPause={onPause} onEnd={onEnd} />;
  }
  return (
    <IdleView
      data={data}
      onStart={onStart}
      onAddSubject={onAddSubject}
      onRenameSubject={onRenameSubject}
      onDeleteSubject={onDeleteSubject}
    />
  );
}

/* ---------------- Idle ---------------- */

function IdleView({
  data,
  onStart,
  onAddSubject,
  onRenameSubject,
  onDeleteSubject,
}: {
  data: AppData;
  onStart: (subjectId: string, modeLabel: string) => void;
  onAddSubject: (name: string, color: SubjectColor) => string;
  onRenameSubject: (id: string, name: string, color: SubjectColor) => void;
  onDeleteSubject: (id: string) => void;
}) {
  const now = useNow();
  const todaySessions = data.sessions.filter((s) => sameDay(s.endedAt, now));
  const todayMs = todaySessions.reduce((sum, s) => sum + s.focusedMs, 0);

  const [subjectId, setSubjectId] = useState<string | null>(
    data.lastUsed.subjectId && data.subjects.some((s) => s.id === data.lastUsed.subjectId)
      ? data.lastUsed.subjectId
      : (data.subjects[0]?.id ?? null),
  );
  const [modeLabel, setModeLabel] = useState(data.lastUsed.modeLabel);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<SubjectColor>(firstFreeColor(data.subjects.map((s) => s.color)));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const recentModes = useMemo(() => {
    if (!subjectId) return [];
    const labels = new Set<string>();
    const out: string[] = [];
    // most recently used first: sessions newest → oldest, then any remaining saved modes
    const byTime = [...data.sessions].sort((a, b) => b.endedAt - a.endedAt);
    for (const s of byTime) {
      if (s.subjectId === subjectId && !labels.has(s.modeLabel)) {
        labels.add(s.modeLabel);
        out.push(s.modeLabel);
      }
    }
    for (const m of data.modes) {
      if (m.subjectId === subjectId && !labels.has(m.label)) {
        labels.add(m.label);
        out.push(m.label);
      }
    }
    return out.slice(0, 6);
  }, [data.sessions, data.modes, subjectId]);

  const canStart = subjectId !== null && modeLabel.trim().length > 0;

  const submitNewSubject = () => {
    if (!newName.trim()) return;
    const id = onAddSubject(newName, newColor);
    setSubjectId(id);
    setShowNewSubject(false);
    setNewName('');
    inputRef.current?.focus();
  };

  return (
    <div className="focus-idle">
      <p className="eyebrow">
        Today · {formatDuration(todayMs)} · {todaySessions.length}{' '}
        {todaySessions.length === 1 ? 'session' : 'sessions'}
      </p>

      <div className="field-group">
        <span className="field-label" id="subject-label">
          Subject
        </span>
        <div className="segmented" role="group" aria-labelledby="subject-label">
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
          <button
            type="button"
            className={showNewSubject ? 'seg seg-new is-active' : 'seg seg-new'}
            onClick={() => setShowNewSubject((v) => !v)}
            aria-expanded={showNewSubject}
          >
            + New subject
          </button>
        </div>
        {data.subjects.length > 0 && (
          <button type="button" className="link-muted manage-link" onClick={() => setManageOpen(true)}>
            Manage subjects
          </button>
        )}

        {showNewSubject && (
          <div className="new-subject">
            <label className="sr-only" htmlFor="new-subject-name">
              Subject name
            </label>
            <input
              id="new-subject-name"
              className="input"
              placeholder="Subject name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewSubject();
                if (e.key === 'Escape') setShowNewSubject(false);
              }}
            />
            <div className="color-row" role="radiogroup" aria-label="Subject color">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={newColor === c}
                  aria-label={c}
                  className={`color-dot color-${c}${newColor === c ? ' is-active' : ''}`}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={submitNewSubject}
              disabled={!newName.trim()}
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div className="field-group">
        <label className="field-label" htmlFor="mode-input">
          Mode
        </label>
        <input
          ref={inputRef}
          id="mode-input"
          className="input mode-input"
          placeholder="What exactly are you doing?"
          value={modeLabel}
          onChange={(e) => setModeLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canStart) onStart(subjectId!, modeLabel);
          }}
          autoComplete="off"
        />
        <p className="helper">Name the cognitive task, not the subject. e.g. Map step-by-step logic</p>
        {recentModes.length > 0 && (
          <div className="chip-row" aria-label="Recent modes for this subject">
            {recentModes.map((m) => (
              <button
                key={m}
                type="button"
                className="chip"
                onClick={() => setModeLabel(m)}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn btn-primary btn-start"
        disabled={!canStart}
        onClick={() => onStart(subjectId!, modeLabel)}
      >
        Start session
      </button>

      {manageOpen && (
        <ManageSubjectsSheet
          data={data}
          onRename={onRenameSubject}
          onDelete={onDeleteSubject}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}

function firstFreeColor(used: SubjectColor[]): SubjectColor {
  return SUBJECT_COLORS.find((c) => !used.includes(c)) ?? SUBJECT_COLORS[0];
}

/* ---------------- Running / Paused ---------------- */

function RunningView({
  subjectName,
  active,
  onPause,
  onEnd,
}: {
  subjectName: string | undefined;
  active: AppData['activeSession'] & object;
  onPause: () => void;
  onEnd: () => void;
}) {
  const now = useNow();
  const focused = activeFocusedMs(active, now);
  const paused = activePausedMs(active, now);
  const isRunning = active.status === 'running';

  return (
    <div className="focus-running">
      <p className="run-subject">{subjectName}</p>
      <h1 className="run-mode">{active.modeLabel}</h1>

      <TimerDisplay ms={focused} className={isRunning ? '' : 'timer-paused'} />

      <div className="status-row">
        {isRunning ? (
          <span className="status status-focusing">
            <span className="pulse-dot" aria-hidden="true" />
            Focusing
          </span>
        ) : (
          <span className="status status-paused">Paused</span>
        )}
        {paused > 0 && <span className="status-paused-total">Paused total {formatDuration(paused)}</span>}
      </div>

      <div className="run-actions">
        <button type="button" className="btn btn-secondary" onClick={onPause}>
          {isRunning ? 'Pause' : 'Resume'}
        </button>
        <button type="button" className="btn btn-primary" onClick={onEnd}>
          End session
        </button>
      </div>
    </div>
  );
}
