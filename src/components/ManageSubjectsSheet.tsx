import { useState } from 'react';
import type { AppData, Subject, SubjectColor } from '../types';
import { SUBJECT_COLORS } from '../types';

interface Props {
  data: AppData;
  onRename: (id: string, name: string, color: SubjectColor) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

type DeleteStep = 'warning' | 'confirm';

/** Rename or delete subjects. Delete needs Continue, then the exact typed name. */
export function ManageSubjectsSheet({ data, onRename, onDelete, onClose }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameColor, setRenameColor] = useState<SubjectColor>('slate');
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('warning');
  const [typedName, setTypedName] = useState('');

  const startRename = (s: Subject) => {
    setRenamingId(s.id);
    setRenameValue(s.name);
    setRenameColor(s.color);
    setDeleteTarget(null);
  };

  const saveRename = () => {
    if (!renamingId || !renameValue.trim()) return;
    onRename(renamingId, renameValue, renameColor);
    setRenamingId(null);
  };

  const askDelete = (s: Subject) => {
    setRenamingId(null);
    setDeleteTarget(s);
    setDeleteStep('warning');
    setTypedName('');
  };

  const sessionCount = (id: string) => data.sessions.filter((s) => s.subjectId === id).length;
  const testCount = (id: string) => data.tests.filter((t) => t.subjectId === id).length;
  const modeCount = (id: string) => data.modes.filter((m) => m.subjectId === id).length;

  const deletingBlocked =
    deleteTarget !== null && data.activeSession?.subjectId === deleteTarget.id;
  const nameMatches = typedName.trim() === (deleteTarget?.name ?? '');

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="sheet-eyebrow">Subjects</p>
        <h2 id="manage-title" className="sheet-title">
          Manage subjects
        </h2>

        <ul className="manage-list">
          {data.subjects.map((s) => (
            <li key={s.id} className="manage-item">
              {renamingId === s.id ? (
                <div className="rename-row">
                  <label className="sr-only" htmlFor={`rename-${s.id}`}>
                    Subject name
                  </label>
                  <input
                    id={`rename-${s.id}`}
                    className="input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename();
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    autoComplete="off"
                  />
                  <div className="color-row" role="radiogroup" aria-label="Subject color">
                    {SUBJECT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={renameColor === c}
                        aria-label={c}
                        className={`color-dot color-${c}${renameColor === c ? ' is-active' : ''}`}
                        onClick={() => setRenameColor(c)}
                      />
                    ))}
                  </div>
                  <div className="manage-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      onClick={saveRename}
                      disabled={!renameValue.trim()}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => setRenamingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="manage-row">
                  <span className={`tick tick-${s.color}`} aria-hidden="true" />
                  <span className="manage-name">{s.name}</span>
                  <span className="manage-actions">
                    <button type="button" className="link-muted" onClick={() => startRename(s)}>
                      Rename
                    </button>
                    <button type="button" className="link-danger" onClick={() => askDelete(s)}>
                      Delete
                    </button>
                  </span>
                </div>
              )}

              {deleteTarget?.id === s.id && deleteStep === 'warning' && (
                <div className="delete-warning" role="alert">
                  <p>
                    Delete <strong>{s.name}</strong>? This removes {sessionCount(s.id)}{' '}
                    {sessionCount(s.id) === 1 ? 'session' : 'sessions'}, {testCount(s.id)}{' '}
                    {testCount(s.id) === 1 ? 'test' : 'tests'}, and {modeCount(s.id)}{' '}
                    {modeCount(s.id) === 1 ? 'mode' : 'modes'}. This cannot be undone.
                  </p>
                  {deletingBlocked ? (
                    <p className="delete-blocked">
                      End or discard the running session on this subject first.
                    </p>
                  ) : (
                    <div className="manage-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => setDeleteTarget(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost-danger btn-small"
                        onClick={() => setDeleteStep('confirm')}
                      >
                        Continue
                      </button>
                    </div>
                  )}
                </div>
              )}

              {deleteTarget?.id === s.id && deleteStep === 'confirm' && (
                <div className="delete-warning" role="alert">
                  <p>
                    Type <strong>{s.name}</strong> exactly to confirm.
                  </p>
                  <label className="sr-only" htmlFor={`confirm-${s.id}`}>
                    Type {s.name} to confirm deletion
                  </label>
                  <input
                    id={`confirm-${s.id}`}
                    className="input"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    autoComplete="off"
                  />
                  <div className="manage-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => setDeleteTarget(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost-danger btn-small"
                      disabled={!nameMatches}
                      onClick={() => {
                        onDelete(s.id);
                        setDeleteTarget(null);
                      }}
                    >
                      Yes, delete forever
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
