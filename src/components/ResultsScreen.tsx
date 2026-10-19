import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AppData, BlockReading, Test } from '../types';
import { analyzeTest, blockPayload, type TestAnalysis, type TestFields } from '../results';
import { formatDuration, formatTestDate } from '../utils';
import { LogTestSheet } from './LogTestSheet';
import { TestDetailSheet } from './TestDetailSheet';
import { BlockReader } from './BlockReader';

export interface LogTestRequest {
  subjectId: string | null;
}

interface Props {
  data: AppData;
  logRequest: LogTestRequest | null;
  onLogRequestHandled: () => void;
  onSaveTest: (fields: TestFields) => void;
  onUpdateTest: (id: string, fields: TestFields) => void;
  onDeleteTest: (id: string) => void;
  onSaveReading: (testId: string, reading: BlockReading) => void;
  onApplyNextMode: (subjectId: string, modeLabel: string) => void;
  onStartOptimize: () => void;
}

interface TestPoint {
  ts: number;
  percent: number;
  title: string;
  scoreText: string;
  gainText: string;
  verdict: string;
  prepMs: number;
}

export function ResultsScreen({
  data,
  logRequest,
  onLogRequestHandled,
  onSaveTest,
  onUpdateTest,
  onDeleteTest,
  onSaveReading,
  onApplyNextMode,
  onStartOptimize,
}: Props) {
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logSubject, setLogSubject] = useState<string | null>(null);
  const [handledRequest, setHandledRequest] = useState(logRequest);

  const trackSubjects = useMemo(
    () => data.subjects.filter((s) => s.track === data.activeTrack),
    [data.subjects, data.activeTrack],
  );
  const trackSubjectIds = useMemo(
    () => new Set(trackSubjects.map((s) => s.id)),
    [trackSubjects],
  );
  // a filter left over from the other track falls back to "all"
  const effectiveFilter =
    subjectFilter !== 'all' && trackSubjectIds.has(subjectFilter) ? subjectFilter : 'all';

  // open the log sheet when Stats (or another caller) requests it
  if (logRequest && logRequest !== handledRequest) {
    setHandledRequest(logRequest);
    if (logRequest.subjectId) setSubjectFilter(logRequest.subjectId);
    setLogSubject(logRequest.subjectId);
    setLogOpen(true);
  }

  useEffect(() => {
    if (logRequest) onLogRequestHandled();
  }, [logRequest, onLogRequestHandled]);

  const rows = useMemo(() => {
    const list = data.tests
      .filter((t) => trackSubjectIds.has(t.subjectId))
      .filter((t) => effectiveFilter === 'all' || t.subjectId === effectiveFilter)
      .sort((a, b) => b.takenAt - a.takenAt);
    return list.map((test) => ({ test, a: analyzeTest(test, data) }));
  }, [data, trackSubjectIds, effectiveFilter]);

  // grouped by subject when unfiltered, in order of most recent test
  const groups = useMemo(() => {
    if (effectiveFilter !== 'all') return [{ subjectId: effectiveFilter, items: rows }];
    const order: string[] = [];
    const bySubject = new Map<string, { test: Test; a: TestAnalysis }[]>();
    for (const r of rows) {
      if (!bySubject.has(r.test.subjectId)) {
        bySubject.set(r.test.subjectId, []);
        order.push(r.test.subjectId);
      }
      bySubject.get(r.test.subjectId)!.push(r);
    }
    return order.map((subjectId) => ({ subjectId, items: bySubject.get(subjectId)! }));
  }, [rows, effectiveFilter]);

  // one gold line: percent over time for the selected subject (never mixed)
  const chartPoints: TestPoint[] = useMemo(() => {
    if (effectiveFilter === 'all') return [];
    return data.tests
      .filter((t) => t.subjectId === effectiveFilter)
      .sort((a, b) => a.takenAt - b.takenAt)
      .map((t) => {
        const a = analyzeTest(t, data);
        return {
          ts: t.takenAt,
          percent: Math.round(a.percent),
          title: t.title,
          scoreText: `${t.score}/${t.maxScore}`,
          gainText:
            a.gainPercent === null
              ? 'first'
              : `${a.gainPercent > 0 ? '+' : '−'}${Math.abs(Math.round(a.gainPercent))}pp`,
          verdict: a.verdict,
          prepMs: a.block.focusedMs,
        };
      });
  }, [data, effectiveFilter]);

  const selected = data.tests.find((t) => t.id === selectedId) ?? null;

  // subject filtered, sessions exist, no test yet → speculative block reading
  const looseBlock = useMemo(() => {
    if (effectiveFilter === 'all') return null;
    if (data.tests.some((t) => t.subjectId === effectiveFilter)) return null;
    const sessions = data.sessions
      .filter((s) => s.subjectId === effectiveFilter)
      .sort((a, b) => b.endedAt - a.endedAt);
    if (sessions.length === 0) return null;
    return { subjectId: effectiveFilter, sessions };
  }, [data, effectiveFilter]);

  const loosePayload = useMemo(
    () =>
      looseBlock
        ? blockPayload({
            subjectName:
              data.subjects.find((s) => s.id === looseBlock.subjectId)?.name ?? '',
            test: null,
            previousTest: null,
            sessions: looseBlock.sessions,
          })
        : null,
    [data, looseBlock],
  );

  return (
    <div className="screen">
      <h1 className="screen-title">Results</h1>

      <div className="filters">
        <label className="sr-only" htmlFor="results-subject">
          Filter by subject
        </label>
        <select
          id="results-subject"
          className="input input-select"
          value={effectiveFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="all">All subjects</option>
          {trackSubjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-secondary btn-small results-log-btn"
          onClick={onStartOptimize}
        >
          Start optimizing
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => {
            setLogSubject(effectiveFilter === 'all' ? null : effectiveFilter);
            setLogOpen(true);
          }}
        >
          Log a test
        </button>
      </div>

      {loosePayload && looseBlock && (
        <section className="stats-block loose-reading">
          <h2 className="block-title">No test logged yet</h2>
          <BlockReader
            payload={loosePayload}
            subjectId={looseBlock.subjectId}
            onNextMode={onApplyNextMode}
          />
        </section>
      )}

      {rows.length === 0 ? (
        <p className="empty">
          Sit a paper, then log it here. Lamp will attach the sessions that led up
          to it and tell you if the speed was worth it.
        </p>
      ) : (
        groups.map((g) => {
          const subject = data.subjects.find((s) => s.id === g.subjectId);
          return (
            <section key={g.subjectId} className="day-group">
              {effectiveFilter === 'all' && (
                <h2 className="day-label">{subject?.name ?? 'Unknown subject'}</h2>
              )}
              <ul className="session-list">
                {g.items.map(({ test, a }) => (
                  <li key={test.id}>
                    <button
                      type="button"
                      className="session-row test-row"
                      onClick={() => setSelectedId(test.id)}
                    >
                      <span
                        className={`tick tick-${subject?.color ?? 'slate'}`}
                        aria-hidden="true"
                      />
                      <span className="session-main">
                        <span className="test-title">{test.title}</span>
                        <span className="session-subject">
                          {formatTestDate(test.takenAt)} · {test.score}/{test.maxScore} (
                          {Math.round(a.percent)}%)
                        </span>
                        <span className="test-verdict">{a.verdict}</span>
                        {test.feedback && (
                          <span className="session-friction">Feedback · {test.feedback}</span>
                        )}
                      </span>
                      <span className="session-side">
                        <GainBadge analysis={a} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {effectiveFilter !== 'all' && chartPoints.length >= 2 && (
        <section className="stats-block">
          <h2 className="block-title">Test percent over time</h2>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartPoints} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
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
                  domain={[0, 100]}
                  stroke="var(--muted)"
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  unit="%"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as TestPoint;
                    return (
                      <div className="chart-tip">
                        <p className="tip-date">
                          {p.title} · {p.scoreText} ({p.percent}%)
                        </p>
                        <p>{p.gainText}</p>
                        <p>Prep · {formatDuration(p.prepMs)}</p>
                        <p className="tip-friction">{p.verdict}</p>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="percent"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="chart-unit">percent</p>
          </div>
        </section>
      )}

      {selected && (
        <TestDetailSheet
          test={selected}
          data={data}
          subjectName={
            data.subjects.find((s) => s.id === selected.subjectId)?.name ?? 'Unknown subject'
          }
          onSave={onUpdateTest}
          onSaveReading={(reading) => onSaveReading(selected.id, reading)}
          onApplyNextMode={onApplyNextMode}
          onDelete={(id) => {
            onDeleteTest(id);
            setSelectedId(null);
          }}
          onClose={() => setSelectedId(null)}
        />
      )}

      {logOpen && (
        <LogTestSheet
          data={data}
          initialSubjectId={logSubject}
          onSave={(fields) => {
            onSaveTest(fields);
            setLogOpen(false);
          }}
          onClose={() => setLogOpen(false)}
        />
      )}
    </div>
  );
}

function GainBadge({ analysis }: { analysis: TestAnalysis }) {
  if (analysis.gainPercent === null) {
    return <span className="test-gain gain-muted">first</span>;
  }
  const rounded = Math.round(analysis.gainPercent);
  if (rounded === 0) return <span className="test-gain gain-muted">±0pp</span>;
  return (
    <span className={rounded > 0 ? 'test-gain gain-up' : 'test-gain gain-down'}>
      {rounded > 0 ? `+${rounded}pp` : `−${Math.abs(rounded)}pp`}
    </span>
  );
}
