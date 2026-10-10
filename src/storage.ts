import type { AppData } from './types';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const STORAGE_KEY = 'lamp.data.v1';

export function seedData(): AppData {
  const now = Date.now();
  const subjects = [
    { id: 'sub-econ', name: 'IGCSE Economics', color: 'slate' as const, createdAt: now },
    { id: 'sub-amc', name: 'AMC 10', color: 'moss' as const, createdAt: now },
    { id: 'sub-adh', name: "A Doll's House", color: 'plum' as const, createdAt: now },
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
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedData();
    const parsed = JSON.parse(raw) as AppData;
    if (!Array.isArray(parsed.subjects) || !Array.isArray(parsed.sessions)) return seedData();
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
    return merged;
  } catch {
    return seedData();
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — fail quietly, app keeps working in memory
  }
}
