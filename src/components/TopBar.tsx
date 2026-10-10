import type { ActiveSession, Screen, Session } from '../types';
import { useNow } from '../hooks/useNow';
import { activeFocusedMs, formatDuration, sameDay } from '../utils';

interface Props {
  screen: Screen;
  onNavigate: (s: Screen) => void;
  sessions: Session[];
  activeSession: ActiveSession | null;
}

const NAV: { key: Screen; label: string }[] = [
  { key: 'focus', label: 'Focus' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'stats', label: 'Stats' },
  { key: 'results', label: 'Results' },
];

export function TopBar({ screen, onNavigate, sessions, activeSession }: Props) {
  const now = useNow();
  const todayMs =
    sessions
      .filter((s) => sameDay(s.endedAt, now))
      .reduce((sum, s) => sum + s.focusedMs, 0) +
    (activeSession ? activeFocusedMs(activeSession, now) : 0);

  return (
    <header className="topbar">
      <span className="wordmark">Lamp</span>
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
