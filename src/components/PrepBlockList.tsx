import type { Session } from '../types';
import { dayLabel, formatDuration } from '../utils';

interface Props {
  sessions: Session[]; // candidate window, newest first
  checked: ReadonlySet<string>;
  onToggle: (id: string, checked: boolean) => void;
}

/** Compact checkbox list of the sessions attached to a test's prep block. */
export function PrepBlockList({ sessions, checked, onToggle }: Props) {
  if (sessions.length === 0) {
    return (
      <p className="empty empty-small">No sessions in this window. Record study sessions first.</p>
    );
  }
  return (
    <ul className="prep-list">
      {sessions.map((s) => {
        const note = s.notes ?? '';
        return (
          <li key={s.id}>
            <label className="check prep-item">
              <input
                type="checkbox"
                checked={checked.has(s.id)}
                onChange={(e) => onToggle(s.id, e.target.checked)}
              />
              <span className="prep-main">
                <span className="prep-mode">{s.modeLabel}</span>
                <span className="prep-meta">
                  {dayLabel(s.endedAt)} · {formatDuration(s.focusedMs)}
                  {s.outputQuantity !== null && s.outputUnit
                    ? ` · ${s.outputQuantity} ${s.outputUnit}`
                    : ''}
                </span>
                {note && (
                  <span className="prep-note">
                    {note.length > 90 ? `${note.slice(0, 90)}…` : note}
                  </span>
                )}
                {s.friction && (
                  <span className="prep-note">
                    Friction · {s.friction.length > 90 ? `${s.friction.slice(0, 90)}…` : s.friction}
                  </span>
                )}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
