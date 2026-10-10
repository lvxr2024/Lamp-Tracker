export type SubjectColor = 'slate' | 'moss' | 'rust' | 'plum' | 'teal';

export interface Subject {
  id: string;
  name: string;
  color: SubjectColor;
  createdAt: number;
}

export interface StudyMode {
  id: string;
  subjectId: string;
  label: string;
}

export type SessionStatus = 'running' | 'paused' | 'completed' | 'discarded';

/** Editable session fields: notes, friction, optional output, optional clock corrections. */
export interface SessionPatch {
  notes: string | null;
  friction: string | null;
  qty: number | null;
  unit: string | null;
  /** when omitted, the existing focused clock is left alone */
  focusedMs?: number;
  /** when omitted, the existing paused clock is left alone */
  pausedMs?: number;
}

export interface Session {
  id: string;
  subjectId: string;
  modeId: string;
  modeLabel: string;
  startedAt: number;
  endedAt: number;
  focusedMs: number;
  pausedMs: number;
  status: 'completed'; // only completed sessions are kept in history
  /** qualitative note written in the log sheet; null when skipped */
  notes: string | null;
  /** what slowed the session down, kept separate from notes */
  friction: string | null;
  outputQuantity: number | null;
  outputUnit: string | null;
  efficiencyPerHour: number | null;
}

/** Live session that survives reloads. */
export interface ActiveSession {
  id: string;
  subjectId: string;
  modeId: string;
  modeLabel: string;
  startedAt: number;
  /** focused ms accumulated before the current running stretch */
  accumulatedMs: number;
  /** ms accumulated while paused, before the current pause stretch */
  accumulatedPausedMs: number;
  /** timestamp the current running stretch began; null while paused */
  runningSince: number | null;
  /** timestamp the current pause stretch began; null while running */
  pausedSince: number | null;
  status: 'running' | 'paused';
}

export interface LastUsed {
  subjectId: string | null;
  modeLabel: string;
}

/** Gemini's three-line reading of a prep block. Not a rating. */
export interface BlockReading {
  pattern: string;
  gap: string;
  nextMode: string;
  generatedAt: number;
}

/** A logged test / past paper, with the prep block that led up to it. */
export interface Test {
  id: string;
  subjectId: string;
  title: string;
  /** timestamp the test was taken; stored as end-of-day of the chosen date */
  takenAt: number;
  score: number;
  maxScore: number;
  feedback: string;
  sessionIds: string[];
  reading: BlockReading | null;
  createdAt: number;
}

export interface AppData {
  subjects: Subject[];
  modes: StudyMode[];
  sessions: Session[];
  tests: Test[];
  activeSession: ActiveSession | null;
  lastUsed: LastUsed;
}

export type Screen = 'focus' | 'sessions' | 'stats' | 'results';

export const SUBJECT_COLORS: SubjectColor[] = ['slate', 'moss', 'rust', 'plum', 'teal'];

export const FRICTION_CHIPS = [
  'Distracted',
  'Stuck on a concept',
  'Tired',
  'Unclear question',
  'Notes messy',
];
