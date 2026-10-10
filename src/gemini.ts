import { GoogleGenerativeAI } from '@google/generative-ai';
import type { BlockReading } from './types';

/** GA Flash first; aliases last. Same order as Tennichess. */
const MODEL_CANDIDATES = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
] as const;

export const MISSING_KEY_MESSAGE =
  'Add VITE_GEMINI_API_KEY to lamp/.env (same key as Tennichess) and restart Vite.';

export interface BlockPayload {
  subject: string;
  /** null when there is no paper yet — the reading is speculative */
  test: { title: string; date: string; score: number; maxScore: number } | null;
  previousTest: { title: string; score: number } | null;
  sessions: {
    date: string;
    mode: string;
    focusedMinutes: number;
    notes: string;
    friction: string;
    /** present only when the session had countable output */
    qty?: number;
    unit?: string;
    ratePerHour?: number;
  }[];
}

const SYSTEM_INSTRUCTION = `You are a quiet academic coach reading a student's session notes alongside a paper they sat. No scores, no praise, no percentages, no study-tips list. Return JSON only, with exactly these keys:
- pattern: one sentence about what kept showing up in the notes.
- gap: one sentence about what the paper punished that the notes never mentioned, or the reverse.
- nextMode: a Lamp-style mode name — imperative and specific, verb plus a precise task, like "Map circular-flow shocks without notes". Never generic advice like "study harder".
Each value is one short sentence of plain text.`;

/** Same instruction, for when no paper exists yet: gap is a forecast. */
const LOOSE_SYSTEM_INSTRUCTION = `You are a quiet academic coach reading a student's session notes for a subject, before any paper has been sat. No scores, no praise, no percentages, no study-tips list. Return JSON only, with exactly these keys:
- pattern: one sentence about what kept showing up in the notes.
- gap: one sentence about what a paper in this subject would most likely punish, given that these notes never mention it.
- nextMode: a Lamp-style mode name — imperative and specific, verb plus a precise task, like "Map circular-flow shocks without notes". Never generic advice like "study harder".
Each value is one short sentence of plain text.`;

export function geminiKey(): string {
  return ((import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? '').trim();
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Coerce model output into a BlockReading; throws when the shape is wrong. */
function normalizeReading(raw: unknown): BlockReading {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pattern = typeof r.pattern === 'string' ? r.pattern.trim() : '';
  const gap = typeof r.gap === 'string' ? r.gap.trim() : '';
  const nextMode = typeof r.nextMode === 'string' ? r.nextMode.trim() : '';
  if (!pattern || !gap || !nextMode) {
    throw new Error('Gemini returned an incomplete reading');
  }
  return { pattern, gap, nextMode, generatedAt: Date.now() };
}

/**
 * Read a prep block (and optionally its paper) with Gemini.
 * Throws with a readable message when the key is missing or every model fails.
 */
export async function readBlock(payload: BlockPayload): Promise<BlockReading> {
  const apiKey = geminiKey();
  if (!apiKey) {
    throw new Error(MISSING_KEY_MESSAGE);
  }

  const instruction = payload.test ? SYSTEM_INSTRUCTION : LOOSE_SYSTEM_INSTRUCTION;
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError = 'Gemini request failed';

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: instruction,
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      });
      return normalizeReading(JSON.parse(result.response.text()));
    } catch (err) {
      lastError = errorMessage(err);
      console.warn('Gemini read failed', { modelName, lastError });
    }
  }

  throw new Error(lastError);
}
