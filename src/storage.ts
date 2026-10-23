import type { AppData, StudyMode, Subject, Track } from './types';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const STORAGE_KEY = 'lamp.data.v1';

export function seedData(): AppData {
  const now = Date.now();
  const subjects = [
    { id: 'sub-econ', name: 'IGCSE Economics', color: 'slate' as const, track: 'igcse' as const, createdAt: now },
    { id: 'sub-amc', name: 'AMC 10', color: 'moss' as const, track: 'igcse' as const, createdAt: now },
    { id: 'sub-adh', name: "A Doll's House", color: 'plum' as const, track: 'igcse' as const, createdAt: now },
  ];
  const modes = [
    { id: 'mode-econ-map', subjectId: 'sub-econ', label: 'Map step-by-step logic' },
    { id: 'mode-econ-def', subjectId: 'sub-econ', label: 'Drill definition precision' },
    { id: 'mode-amc-tables', subjectId: 'sub-amc', label: 'Build structural macro tables' },
    { id: 'mode-amc-mod', subjectId: 'sub-amc', label: 'Timed modular arithmetic' },
    { id: 'mode-adh-empathic', subjectId: 'sub-adh', label: 'Draft empathic character responses' },
    { id: 'mode-adh-motif', subjectId: 'sub-adh', label: 'Annotate motif recurrence' },
  ];
  return {
    subjects,
    modes,
    sessions: [],
    tests: [],
    activeSession: null,
    lastUsed: { subjectId: subjects[0].id, modeLabel: '' },
    activeTrack: 'igcse',
    eyecareEnabled: false,
  };
}

/** Distinct IB desk subjects with two modes each; added only when the IB track has none. */
function ibSeedSubjects(now: number): { subjects: Subject[]; modes: StudyMode[] } {
  const spec: { id: string; name: string; color: Subject['color']; modes: [string, string] }[] = [
    {
      id: 'sub-ib-math',
      name: 'IB Math AA',
      color: 'teal',
      modes: ['Drill past-paper problems', 'Rewrite weak derivations'],
    },
    {
      id: 'sub-ib-phys',
      name: 'IB Physics',
      color: 'rust',
      modes: ['Timed data-analysis questions', 'Practice long-response structure'],
    },
    {
      id: 'sub-ib-eng',
      name: 'IB English A',
      color: 'plum',
      modes: ['Close-read passage annotations', 'Timed essay planning'],
    },
    {
      id: 'sub-ib-econ',
      name: 'IB Economics',
      color: 'slate',
      modes: ['Build evaluation chains', 'Drill definitions and diagrams'],
    },
  ];
  return {
    subjects: spec.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      track: 'ib' as const,
      createdAt: now,
    })),
    modes: spec.flatMap((s) =>
      s.modes.map((label, i) => ({ id: `mode-${s.id}-${i}`, subjectId: s.id, label })),
    ),
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrate(seedData());
    const parsed = JSON.parse(raw) as AppData;
    if (!Array.isArray(parsed.subjects) || !Array.isArray(parsed.sessions)) return migrate(seedData());
    const merged = { ...seedData(), ...parsed };
    // migrate older saves: tests were added after sessions
    if (!Array.isArray(merged.tests)) merged.tests = [];
    // notes and friction are separate now; never merge or invent a split —
    // old saves that only have one of them simply keep it as-is
    merged.sessions = merged.sessions.map((s) => ({
      ...s,
      notes: s.notes ?? null,
      friction: s.friction ?? null,
    }));
    merged.tests = merged.tests.map((t) => ({ ...t, reading: t.reading ?? null }));
    return migrate(merged);
  } catch {
    return migrate(seedData());
  }
}

/**
 * One-time shape migrations, idempotent. Adds `track` to subjects saved
 * before tracks existed (everything old is IGCSE), defaults the active
 * track, adopts the user's existing "Optimization" subject (never creates
 * a second one), and seeds IB subjects only when that track has none.
 */
function migrate(data: AppData): AppData {
  const now = Date.now();

  const activeTrack: Track = data.activeTrack === 'ib' ? 'ib' : 'igcse';
  const subjects: Subject[] = data.subjects.map((s) => ({
    ...s,
    track: s.track === 'ib' ? 'ib' : 'igcse',
  }));
  const modes = [...data.modes];

  // Canonical Optimization: adopt a subject the user already named
  // Optimization/Optimisation; only create sub-opt when none exists.
  const namedOpt = subjects.find((s) => /^optimi[sz]ation$/i.test(s.name.trim()));
  if (!namedOpt && !subjects.some((s) => s.id === 'sub-opt')) {
    subjects.push({
      id: 'sub-opt',
      name: 'Optimization',
      color: 'teal',
      track: 'igcse',
      createdAt: now,
    });
    modes.push({ id: 'mode-sub-opt-0', subjectId: 'sub-opt', label: 'Review test feedback' });
  }

  // IB desk gets seed subjects only if the track has none.
  if (!subjects.some((s) => s.track === 'ib')) {
    const ib = ibSeedSubjects(now);
    subjects.push(...ib.subjects);
    modes.push(...ib.modes);
  }

  return { ...data, subjects, modes, activeTrack, eyecareEnabled: data.eyecareEnabled === true };
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — fail quietly, app keeps working in memory
  }
}
