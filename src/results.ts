import type { AppData, Session, Test } from './types';
import type { BlockPayload } from './gemini';
import { formatTestDate } from './utils';

export const FIRST_VERDICT =
  'First checkpoint for this subject. Log the next test to see gain and whether speed is worth it.';
export const NO_DATA_VERDICT = 'Not enough matched efficiency data to judge speed.';

/** Shape a prep block (and optionally its paper) into the Gemini payload. */
export function blockPayload(opts: {
  subjectName: string;
  test: Test | null;
  previousTest: Test | null;
  sessions: Session[];
}): BlockPayload {
  return {
    subject: opts.subjectName,
    test: opts.test
      ? {
          title: opts.test.title,
          date: formatTestDate(opts.test.takenAt),
          score: opts.test.score,
          maxScore: opts.test.maxScore,
        }
      : null,
    previousTest: opts.previousTest
      ? { title: opts.previousTest.title, score: opts.previousTest.score }
      : null,
    sessions: opts.sessions.map((s) => {
      const entry: BlockPayload['sessions'][number] = {
        date: formatTestDate(s.endedAt),
        mode: s.modeLabel,
        focusedMinutes: Math.max(1, Math.round(s.focusedMs / 60_000)),
        notes: s.notes ?? '',
        friction: s.friction ?? '',
      };
      if (s.outputQuantity !== null && s.outputUnit && s.focusedMs > 0) {
        entry.qty = s.outputQuantity;
        entry.unit = s.outputUnit;
        entry.ratePerHour = Math.round((s.outputQuantity / (s.focusedMs / 3_600_000)) * 10) / 10;
      }
      return entry;
    }),
  };
}

export interface TestFields {
  subjectId: string;
  title: string;
  takenAt: number;
  score: number;
  maxScore: number;
  feedback: string;
  sessionIds: string[];
}

/** Aggregates over one prep block. */
export interface BlockStats {
  sessionCount: number;
  focusedMs: number;
  pausedMs: number;
  /** the block's single output unit, or null when zero or several units are present */
  unit: string | null;
  outputCount: number;
  /** total output / total focused hours, when the block has one shared unit */
  avgEfficiency: number | null;
}

export function percentOf(test: Pick<Test, 'score' | 'maxScore'>): number {
  return test.maxScore > 0 ? (test.score / test.maxScore) * 100 : 0;
}

/** Most recent earlier test in the same subject (excluding `excludeId`). */
export function previousTest(
  subjectId: string,
  takenAt: number,
  data: AppData,
  excludeId?: string,
): Test | null {
  return (
    data.tests
      .filter(
        (t) =>
          t.subjectId === subjectId && t.id !== excludeId && t.takenAt < takenAt,
      )
      .sort((a, b) => b.takenAt - a.takenAt)[0] ?? null
  );
}

/** Sessions a test links to, in endedAt order (newest first), skipping deleted ids. */
export function blockSessions(test: Test, data: AppData): Session[] {
  const byId = new Map(data.sessions.map((s) => [s.id, s]));
  return test.sessionIds
    .map((id) => byId.get(id))
    .filter((s): s is Session => !!s)
    .sort((a, b) => b.endedAt - a.endedAt);
}

/**
 * Default prep block for a test taken at `takenAt` in `subjectId`.
 *
 * The cutoff is the latest endedAt among the sessions attached to the most
 * recent OTHER test in the same subject — including one taken the same
 * calendar day, so end-of-day takenAt values never hide the previous test.
 * Selected: this subject's sessions with endedAt > cutoff and
 * endedAt <= takenAt. A first test in the subject has no cutoff, so every
 * session up to takenAt qualifies. Other subjects are never included.
 */
export function defaultBlockSessions(
  subjectId: string,
  takenAt: number,
  data: AppData,
  excludeTestId?: string,
): Session[] {
  const prev = data.tests
    .filter((t) => t.subjectId === subjectId && t.id !== excludeTestId)
    .sort((a, b) => b.takenAt - a.takenAt || b.createdAt - a.createdAt)[0];
  let cutoff = 0;
  if (prev) {
    const byId = new Map(data.sessions.map((s) => [s.id, s]));
    for (const id of prev.sessionIds) {
      const s = byId.get(id);
      if (s && s.subjectId === subjectId && s.endedAt > cutoff) cutoff = s.endedAt;
    }
  }
  return data.sessions
    .filter(
      (s) =>
        s.subjectId === subjectId && s.endedAt > cutoff && s.endedAt <= takenAt,
    )
    .sort((a, b) => b.endedAt - a.endedAt);
}

export function blockStats(sessions: Session[]): BlockStats {
  const focusedMs = sessions.reduce((sum, s) => sum + s.focusedMs, 0);
  const pausedMs = sessions.reduce((sum, s) => sum + s.pausedMs, 0);
  const withOutput = sessions.filter(
    (s) => s.outputQuantity !== null && s.outputUnit && s.focusedMs > 0,
  );
  const units = Array.from(new Set(withOutput.map((s) => s.outputUnit as string)));
  const unit = units.length === 1 ? units[0] : null;
  let avgEfficiency: number | null = null;
  if (unit !== null && withOutput.length > 0) {
    const qty = withOutput.reduce((sum, s) => sum + (s.outputQuantity as number), 0);
    const hours = withOutput.reduce((sum, s) => sum + s.focusedMs, 0) / 3_600_000;
    if (hours > 0) avgEfficiency = qty / hours;
  }
  return {
    sessionCount: sessions.length,
    focusedMs,
    pausedMs,
    unit,
    outputCount: withOutput.length,
    avgEfficiency,
  };
}

export interface TestAnalysis {
  percent: number;
  sessions: Session[];
  block: BlockStats;
  previous: Test | null;
  previousPercent: number | null;
  /** score minus previous score, in points */
  gainPoints: number | null;
  /** percent minus previous percent, in percentage points */
  gainPercent: number | null;
  prevBlock: BlockStats | null;
  /** percent change in avgEfficiency vs the previous block; null when not comparable */
  speedDeltaPct: number | null;
  verdict: string;
}

/** pp gain vs the previous test in the same subject; null when there is none. */
export function gainPercentFor(test: Test, data: AppData): number | null {
  const prev = previousTest(test.subjectId, test.takenAt, data, test.id);
  return prev ? percentOf(test) - percentOf(prev) : null;
}

function verdictFor(gain: number, speed: number): string {
  const up = gain >= 3;
  const down = gain <= -3;
  if (speed >= 10) {
    if (up) return 'Faster prep, higher score. Speed is paying off.';
    if (down) return 'Faster, lower score. The extra speed looks like rushing.';
    return "Faster prep, score unchanged. Throughput rose; understanding didn't.";
  }
  if (speed <= -10) {
    if (up) return 'Slower prep, higher score. The extra care was worth it.';
    if (down) return "Slower and lower. This block didn't convert.";
    return "Slower prep, score unchanged. The extra time hasn't shown a return yet.";
  }
  if (up) return 'Similar pace, higher score. The work is landing.';
  return 'Similar pace, little movement. Change the mode, not just the hours.';
}

/** Everything the UI needs about a test, derived on read. */
export function analyzeTest(test: Test, data: AppData): TestAnalysis {
  const percent = percentOf(test);
  const sessions = blockSessions(test, data);
  const block = blockStats(sessions);
  const prev = previousTest(test.subjectId, test.takenAt, data, test.id);
  const previousPercent = prev ? percentOf(prev) : null;
  const gainPercent = prev ? percent - previousPercent! : null;
  const gainPoints = prev ? test.score - prev.score : null;

  let prevBlock: BlockStats | null = null;
  let speedDeltaPct: number | null = null;
  let verdict: string;

  if (!prev) {
    verdict = FIRST_VERDICT;
  } else {
    prevBlock = blockStats(blockSessions(prev, data));
    const comparable =
      block.unit !== null &&
      prevBlock !== null &&
      prevBlock.unit === block.unit &&
      block.outputCount >= 2 &&
      prevBlock.outputCount >= 2 &&
      block.avgEfficiency !== null &&
      prevBlock.avgEfficiency !== null &&
      prevBlock.avgEfficiency > 0;
    if (!comparable) {
      verdict = NO_DATA_VERDICT;
    } else {
      speedDeltaPct =
        ((block.avgEfficiency as number) - (prevBlock.avgEfficiency as number)) /
        (prevBlock.avgEfficiency as number) *
        100;
      verdict = verdictFor(gainPercent as number, speedDeltaPct);
    }
  }

  return {
    percent,
    sessions,
    block,
    previous: prev,
    previousPercent,
    gainPoints,
    gainPercent,
    prevBlock,
    speedDeltaPct,
    verdict,
  };
}
