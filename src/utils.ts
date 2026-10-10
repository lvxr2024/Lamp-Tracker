import type { ActiveSession, Session, SessionPatch } from './types';

/** Zero-padded HH:MM:SS — timer digits, fixed width so no layout shift. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Split a duration into hours, minutes, and leftover seconds. */
export function splitDuration(ms: number): { hours: number; minutes: number; seconds: number } {
  const totalSecs = Math.max(0, Math.round(ms / 1000));
  return {
    hours: Math.floor(totalSecs / 3600),
    minutes: Math.floor((totalSecs % 3600) / 60),
    seconds: totalSecs % 60,
  };
}

/** Hours, minutes, seconds → milliseconds. Minutes and seconds may exceed 59. */
export function joinDuration(hours: number, minutes: number, seconds: number): number {
  return (
    (Math.max(0, hours) * 3600 + Math.max(0, minutes) * 60 + Math.max(0, seconds)) * 1000
  );
}

/**
 * Parse hour/minute/second fields. Empty = 0. Returns null when any value is
 * negative or not a finite number.
 */
export function parseDurationFields(
  hoursStr: string,
  minutesStr: string,
  secondsStr: string,
): number | null {
  const h = hoursStr.trim() === '' ? 0 : Number(hoursStr);
  const m = minutesStr.trim() === '' ? 0 : Number(minutesStr);
  const s = secondsStr.trim() === '' ? 0 : Number(secondsStr);
  if (![h, m, s].every((v) => Number.isFinite(v) && v >= 0)) return null;
  return joinDuration(h, m, s);
}

/** Editable h / m / s field values for the time editors. */
export interface DurationValue {
  h: string;
  m: string;
  s: string;
}

/** Split a stored duration into editable h / m / s field strings. */
export function durationToFields(ms: number): DurationValue {
  const totalSecs = Math.max(0, Math.round(ms / 1000));
  return {
    h: String(Math.floor(totalSecs / 3600)),
    m: String(Math.floor((totalSecs % 3600) / 60)),
    s: String(totalSecs % 60),
  };
}

/** Apply a log/edit patch onto a stored session. */
export function applySessionPatch(session: Session, patch: SessionPatch): Session {
  const focusedMs = patch.focusedMs ?? session.focusedMs;
  const pausedMs = patch.pausedMs ?? session.pausedMs;
  return {
    ...session,
    focusedMs,
    pausedMs,
    notes: patch.notes,
    friction: patch.friction,
    outputQuantity: patch.qty,
    outputUnit: patch.qty !== null ? patch.unit : null,
    efficiencyPerHour:
      patch.qty !== null && patch.unit && focusedMs > 0
        ? patch.qty / (focusedMs / 3_600_000)
        : null,
  };
}

/** Human duration, e.g. "1h 12m", "45m", "32s". */
export function formatDuration(ms: number): string {  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

/** Focused ms of an active session as of `now`. */
export function activeFocusedMs(a: ActiveSession, now: number): number {
  return a.accumulatedMs + (a.runningSince !== null ? now - a.runningSince : 0);
}

export function activePausedMs(a: ActiveSession, now: number): number {
  return a.accumulatedPausedMs + (a.pausedSince !== null ? now - a.pausedSince : 0);
}

export function efficiencyPerHour(qty: number, focusedMs: number): number | null {
  if (focusedMs <= 0) return null;
  return qty / (focusedMs / 3_600_000);
}

/** "12.5 problems/hour", or "—" when not computable. */
export function formatEfficiency(
  qty: number | null,
  unit: string | null,
  focusedMs: number,
): string {
  if (qty === null || unit === null || focusedMs <= 0) return '—';
  const rate = efficiencyPerHour(qty, focusedMs);
  if (rate === null) return '—';
  return `${rate.toFixed(1)} ${unit}/hour`;
}

/** Extra "4.2 words/min" line for word-based units. */
export function formatWordsPerMin(qty: number | null, unit: string | null, focusedMs: number): string | null {
  if (qty === null || unit === null || focusedMs <= 0) return null;
  if (unit.trim().toLowerCase() !== 'words') return null;
  return `${(qty / (focusedMs / 60_000)).toFixed(1)} words/min`;
}

const DAY = 86_400_000;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Last millisecond of the calendar day containing `ts`. */
export function endOfDay(ts: number): number {
  return startOfDay(ts) + DAY - 1;
}

/** Local `YYYY-MM-DD` for a date input's value. */
export function toISODate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Inverse of toISODate; falls back to today on garbage input. */
export function parseISODate(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return Date.now();
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
}

/** Short date for test rows, e.g. "Sep 12". */
export function formatTestDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function dayLabel(ts: number): string {
  const start = startOfDay(ts);
  const today = startOfDay(Date.now());
  if (start === today) return 'Today';
  if (start === today - DAY) return 'Yesterday';
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}
