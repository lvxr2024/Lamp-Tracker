import { GoogleGenerativeAI } from '@google/generative-ai';
import type { BlockReading } from './types';

/** Try current Flash ids first; skip a model after REQUEST_MS so Reading… cannot hang. */
const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
] as const;

const REQUEST_MS = 20_000;

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

const SYSTEM_INSTRUCTION = `You are a ruthless, analytical diagnostic engine reviewing a student's qualitative friction logs alongside their past paper performance. Zero fluff, zero encouragement, zero generic study tips. Focus strictly on mechanical breakdown, mark scheme alignment, and cognitive difficulties. 

Return JSON only, with exactly these keys:
- "pattern": Using the session data and test feedback, summarize in a few sentences concisely the key problems I encountered during the studying process, and what I lost marks on during the test because of that. 
- "gap": Use 3 sentences to suggest 3 improvements that can be done to the way I study for the next test of the same subject. If the subject is IGCSE, you should refer to data from past year paper mark schemes as well as the syllabus for that IGCSE subject to help suggest more targetted improvements. 
- "nextMode": An imperative mode name. Verb + precise mechanical constraint (e.g., "Drill Paper 1 Q4 synthesis under 15-minute time pressure", "Look at Shinji's character development without notes"). 

Do not wrap the output in markdown code blocks. Output raw JSON only. Each value must be one concise sentence of plain text.`;

/** Same instruction, for when no paper exists yet: gap is a forecast. */
const LOOSE_SYSTEM_INSTRUCTION = `You are a ruthless, analytical diagnostic engine reviewing a student's qualitative friction logs alongside their past paper performance. Zero fluff, zero encouragement, zero generic study tips. Focus strictly on mechanical breakdown, mark scheme alignment, and cognitive difficulties. 

Return JSON only, with exactly these keys:
- "pattern": Using the session data and test feedback, summarize in a few sentences concisely the key problems I encountered during the studying process, and what I lost marks on during the test because of that. 
- "gap": Use 3 sentences to suggest 3 improvements that can be done to the way I study for the next test of the same subject. If the subject is IGCSE, you should refer to data from past year paper mark schemes as well as the syllabus for that IGCSE subject to help suggest more targetted improvements. 
- "nextMode": An imperative mode name. Verb + precise mechanical constraint (e.g., "Drill Paper 1 Q4 synthesis under 15-minute time pressure", "Look at Shinji's character development without notes"). 

Do not wrap the output in markdown code blocks. Output raw JSON only. Each value must be one concise sentence of plain text.`;

export function geminiKey(): string {
  return ((import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? '').trim();
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function str(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** Coerce model output into a BlockReading; throws when the shape is wrong. */
function normalizeReading(raw: unknown): BlockReading {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pattern = str(r, 'pattern', 'friction_pattern');
  const gap = str(r, 'gap', 'mark_scheme_gap');
  const nextMode = str(r, 'nextMode', 'next_mode');
  if (!pattern || !gap || !nextMode) {
    throw new Error('Gemini returned an incomplete reading');
  }
  return { pattern, gap, nextMode, generatedAt: Date.now() };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
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
      const result = await withTimeout(
        model.generateContent({
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        REQUEST_MS,
        modelName,
      );
      const text = result.response.text().trim();
      const jsonText = text.startsWith('{') ? text : text.replace(/^```(?:json)?\s*|\s*```$/g, '');
      return normalizeReading(JSON.parse(jsonText));
    } catch (err) {
      lastError = errorMessage(err);
      console.warn('Gemini read failed', { modelName, lastError });
    }
  }

  throw new Error(lastError);
}
