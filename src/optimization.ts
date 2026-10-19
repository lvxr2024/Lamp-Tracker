import type { AppData } from './types';

/** Default mode for Optimization sessions started from Results. */
export const OPTIMIZATION_MODE = 'Review test feedback';

/**
 * Id of the canonical Optimization subject. Resolved once per app load and
 * cached so a later rename doesn't lose it. Falls back to the seeded
 * 'sub-opt' row; storage migration guarantees one of the two exists.
 */
let cachedId: string | null = null;

export function optimizationSubjectId(data: AppData): string {
  if (cachedId && data.subjects.some((s) => s.id === cachedId)) return cachedId;
  const named = data.subjects.find((s) => /^optimi[sz]ation$/i.test(s.name.trim()));
  const subject = named ?? data.subjects.find((s) => s.id === 'sub-opt');
  cachedId = subject?.id ?? null;
  return cachedId ?? '';
}
