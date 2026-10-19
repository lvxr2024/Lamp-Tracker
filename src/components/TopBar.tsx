import type { ActiveSession, Screen, Session, Subject, Track } from '../types';
import { useNow } from '../hooks/useNow';
import { activeFocusedMs, formatDuration, sameDay } from '../utils';

interface Props {
  screen: Screen;
  onNavigate: (s: Screen) => void;
  sessions: Session[];
  subjects: Subject[];
  activeSession: ActiveSession | null;
  track: Track;
  onTrackChange: (t: Track) => void;
}

const NAV: { key: Screen; label: string }[] = [
  { key: 'focus', label: 'Focus' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'stats', label: 'Stats' },
  { key: 'results', label: 'Results' },
];

const TRACKS: { key: Track; label: string }[] = [
  { key: 'igcse', label: 'IGCSE' },
  { key: 'ib', label: 'IB' },
];

export function TopBar({
  screen,
  onNavigate,
  sessions,
  subjects,
  activeSession,
  track,
  onTrackChange,
}: Props) {
  const now = useNow();
  const trackSubjectIds = new Set(subjects.filter((s) => s.track === track).map((s) => s.id));
  const todayMs =
    sessions
      .filter((s) => trackSubjectIds.has(s.subjectId) && sameDay(s.endedAt, now))
      .reduce((sum, s) => sum + s.focusedMs, 0) +
    (activeSession && trackSubjectIds.has(activeSession.subjectId)
      ? activeFocusedMs(activeSession, now)
      : 0);

  return (
    <header className="topbar">
      <span className="wordmark">Lamp</span>
      <div className="track-switch" role="group" aria-label="Track">
        {TRACKS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={track === t.key ? 'is-active' : ''}
            onClick={() => onTrackChange(t.key)}
            aria-pressed={track === t.key}
          >
            {t.label}
          </button>
        ))}
      </div>
      <nav className="nav" aria-label="Main">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={screen === n.key ? 'nav-link is-active' : 'nav-link'}
            onClick={() => onNavigate(n.key)}
            aria-current={screen === n.key ? 'page' : undefined}
          >
            {n.label}
          </button>
        ))}
      </nav>
      <span className="topbar-today" aria-label="Today's focused time">
        <span className="today-label">Today · </span>
        {formatDuration(todayMs)}
      </span>
    </header>
  );
}
