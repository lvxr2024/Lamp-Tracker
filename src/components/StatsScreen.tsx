import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AppData, Session } from '../types';
import { gainPercentFor } from '../results';
import { dayLabel, formatDuration, formatTestDate, startOfDay } from '../utils';

type Range = 'today' | '3d' | '7d' | '30d' | 'all';

const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '3d', label: '3d' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'all', label: 'All' },
];

const DAY = 86_400_000;

/** First ms of the range: Today is calendar-today; N-day ranges are the local day plus the N−1 before it. */
function rangeStart(range: Range, now: number): number {
  if (range === 'all') return 0;
  if (range === 'today') return startOfDay(now);
  const days = range === '3d' ? 3 : range === '7d' ? 7 : 30;
  return startOfDay(now) - (days - 1) * DAY;
}

interface EffPoint {
  ts: number;
  rate: number;
  session: Session;
}

export function StatsScreen({
  data,
  onOpenResults,
  onLogTest,
}: {
  data: AppData;
  onOpenResults: () => void;
  onLogTest: (subjectId: string | null) => void;
}) {
  const [subjectId, setSubjectId] = useState<string>('');
  const [modeId, setModeId] = useState<string>('');
  const [range, setRange] = useState<Range>('all');

  const trackSubjects = useMemo(
    () => data.subjects.filter((s) => s.track === data.activeTrack),
    [data.subjects, data.activeTrack],
  );
  const trackSubjectIds = useMemo(
    () => new Set(trackSubjects.map((s) => s.id)),
    [trackSubjects],
  );

  // a selection left over from the other track resets to unselected
  const effectiveSubjectId = trackSubjectIds.has(subjectId) ? subjectId : '';

  const modesForSubject = useMemo(() => {
    if (effectiveSubjectId === '') return [];
    return data.modes.filter((m) => m.subjectId === effectiveSubjectId);
  }, [data.modes, effectiveSubjectId]);

  const rangeStartMs = rangeStart(range, Date.now());

  const inRange = useMemo(
    () =>
      data.sessions.filter(
        (s) => trackSubjectIds.has(s.subjectId) && s.endedAt >= rangeStartMs,
      ),
    [data.sessions, trackSubjectIds, rangeStartMs],
  );

  // summary / friction follow the subject choice, never the mode
  const filtered = useMemo(
    () =>
      effectiveSubjectId === ''
        ? inRange
        : inRange.filter((s) => s.subjectId === effectiveSubjectId),
    [inRange, effectiveSubjectId],
  );

  // Efficiency curve: exactly one subject + one mode, sessions with output only.
  const pairSessions = useMemo(
    () =>
      effectiveSubjectId !== '' && modeId !== ''
        ? inRange.filter(
            (s) => s.subjectId === effectiveSubjectId && s.modeId === modeId,
          )
        : [],
    [inRange, effectiveSubjectId, modeId],
  );

  // One axis, one unit: the most recently logged unit in this subject+mode pair.
  const unit = useMemo(() => {
    const withOutput = pairSessions
      .filter((s) => s.outputQuantity !== null && s.outputUnit)
      .sort((a, b) => b.endedAt - a.endedAt);
    return withOutput.length > 0 ? (withOutput[0].outputUnit as string) : null;
  }, [pairSessions]);

  const effPoints: EffPoint[] = useMemo(() => {
    if (!unit) return [];
    return pairSessions
      .filter((s) => s.outputUnit === unit && s.outputQuantity !== null && s.focusedMs > 0)
      .map((s) => ({
        ts: s.endedAt,
        rate: s.outputQuantity! / (s.focusedMs / 3_600_000),
        session: s,
      }))
      .sort((a, b) => a.ts - b.ts);
  }, [pairSessions, unit]);

  const totalMs = filtered.reduce((sum, s) => sum + s.focusedMs, 0);
  const avgEff =
    effPoints.length > 0
      ? effPoints.reduce((sum, p) => sum + p.rate, 0) / effPoints.length
      : null;

  const bySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of inRange) map.set(s.subjectId, (map.get(s.subjectId) ?? 0) + s.focusedMs);
    return trackSubjects
      .map((sub) => ({ subject: sub, ms: map.get(sub.id) ?? 0 }))
      .filter((x) => x.ms > 0)
      .sort((a, b) => b.ms - a.ms);
  }, [inRange, trackSubjects]);

  const maxSubjectMs = bySubject[0]?.ms ?? 1;

  const frictionNotes = useMemo(
    () =>
      filtered
        .filter((s) => s.friction)
        .sort((a, b) => b.endedAt - a.endedAt)
        .slice(0, 10),
    [filtered],
  );

  const noFiltersActive = effectiveSubjectId === '' && range === 'all';

  // most recent test for the filtered subject (or overall) — one quiet line
  const lastTest = useMemo(() => {
    const list = data.tests.filter(
      (t) =>
        trackSubjectIds.has(t.subjectId) &&
        (effectiveSubjectId === '' || t.subjectId === effectiveSubjectId),
    );
    return list.sort((a, b) => b.takenAt - a.takenAt)[0] ?? null;
  }, [data.tests, trackSubjectIds, effectiveSubjectId]);

  const lastTestGain = lastTest ? gainPercentFor(lastTest, data) : null;

  return (
    <div className="screen">
      <h1 className="screen-title">Stats</h1>

      <div className="filters">
        <label className="sr-only" htmlFor="stats-subject">
          Filter by subject
        </label>
        <select
          id="stats-subject"
          className="input input-select"
          value={effectiveSubjectId}
          onChange={(e) => {
            setSubjectId(e.target.value);
            setModeId('');
          }}
        >
          <option value="">Subject…</option>
          {trackSubjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {effectiveSubjectId !== '' && modesForSubject.length > 0 && (
          <>
            <label className="sr-only" htmlFor="stats-mode">
              Filter by mode
            </label>
            <select
              id="stats-mode"
              className="input input-select"
              value={modeId}
              onChange={(e) => setModeId(e.target.value)}
            >
              <option value="">Mode…</option>
              {modesForSubject.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </>
        )}
        <div className="chip-row" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={range === r.key ? 'chip is-active' : 'chip'}
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="link-muted stats-log-test"
          onClick={() => onLogTest(effectiveSubjectId || null)}
        >
          Log a test for this subject
        </button>
      </div>

      <div className="summary-strip">
        <div className="stat">
          <span className="stat-value">{filtered.length}</span>
          <span className="stat-label">sessions</span>
        </div>
        <div className="stat">
          <span className="stat-value">{(totalMs / 3_600_000).toFixed(1)}</span>
          <span className="stat-label">focused hours</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {avgEff !== null && unit !== null ? `${avgEff.toFixed(1)} ${unit}/hour` : '—'}
          </span>
          <span className="stat-label">avg efficiency</span>
        </div>
      </div>

      {lastTest && (
        <button type="button" className="last-test" onClick={onOpenResults}>
          Last test · {lastTest.title} · {lastTest.score}/{lastTest.maxScore}
          {lastTestGain !== null && lastTestGain !== 0 && (
            <>
              {' · '}
              <span className={lastTestGain > 0 ? 'gain-up' : 'gain-down'}>
                {lastTestGain > 0 ? '+' : '−'}
                {Math.abs(Math.round(lastTestGain))}pp
              </span>
            </>
          )}
          <span className="last-test-date">{formatTestDate(lastTest.takenAt)}</span>
        </button>
      )}

      <section className="stats-block">
        <h2 className="block-title">Efficiency over time</h2>
        {effectiveSubjectId === '' || modeId === '' ? (
          <p className="empty">Pick a subject and a mode to graph efficiency.</p>
        ) : effPoints.length >= 2 ? (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={effPoints} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="ts"
                  tickFormatter={(ts: number) =>
                    new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  }
                  stroke="var(--muted)"
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  stroke="var(--muted)"
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  unit=""
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as EffPoint;
                    const s = p.session;
                    return (
                      <div className="chart-tip">
                        <p className="tip-date">
                          {dayLabel(s.endedAt)} · {s.modeLabel}
                        </p>
                        <p>{formatDuration(s.focusedMs)}</p>
                        {s.outputQuantity !== null && s.outputUnit && (
                          <p>
                            {s.outputQuantity} {s.outputUnit} · {p.rate.toFixed(1)} {s.outputUnit}/hr
                          </p>
                        )}
                        {s.friction && <p className="tip-friction">Friction · {s.friction}</p>}
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="chart-unit">{unit}/hour</p>
          </div>
        ) : (
          <p className="empty">
            Need at least two logged outputs in this mode to graph.
            {unit === null && ' Units must match.'}
          </p>
        )}
      </section>

      <section className="stats-block">
        <h2 className="block-title">Time by subject</h2>
        {bySubject.length === 0 ? (
          <p className="empty">No focused time in this range yet.</p>
        ) : (
          <ul className="subject-bars">
            {bySubject.map(({ subject, ms }) => (
              <li key={subject.id} className="subject-bar-row">
                <span className="subject-bar-name">{subject.name}</span>
                <span className="subject-bar-track">
                  <span
                    className={`subject-bar-fill bar-${subject.color}`}
                    style={{ width: `${Math.max(2, (ms / maxSubjectMs) * 100)}%` }}
                  />
                </span>
                <span className="subject-bar-val">{formatDuration(ms)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stats-block">
        <h2 className="block-title">Friction</h2>
        {frictionNotes.length === 0 ? (
          <p className="empty">
            {noFiltersActive
              ? 'No friction logged yet. The log sheet asks after each session.'
              : 'No friction in this selection.'}
          </p>
        ) : (
          <ul className="friction-list">
            {frictionNotes.map((s) => (
              <li key={s.id} className="friction-item">
                <span className="friction-text">{s.friction}</span>
                <span className="friction-meta">
                  {s.modeLabel} · {dayLabel(s.endedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
