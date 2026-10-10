import { useNow } from '../hooks/useNow';
import { formatClock } from '../utils';

interface Props {
  ms: number;
  className?: string;
}

/** Fixed-width clock digits — no layout shift as time advances. */
export function TimerDisplay({ ms, className }: Props) {
  useNow(1000);
  const clock = formatClock(ms);
  return (
    <div className={className ? `timer ${className}` : 'timer'} role="timer" aria-live="off">
      <span className="timer-cell">{clock.slice(0, 2)}</span>
      <span className="timer-sep">:</span>
      <span className="timer-cell">{clock.slice(3, 5)}</span>
      <span className="timer-sep">:</span>
      <span className="timer-cell">{clock.slice(6, 8)}</span>
    </div>
  );
}
