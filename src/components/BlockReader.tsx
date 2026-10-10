import { useState } from 'react';
import type { BlockReading } from '../types';
import { readBlock, type BlockPayload } from '../gemini';

interface Props {
  payload: BlockPayload;
  subjectId: string;
  /** a reading previously saved on the test, shown until a new one arrives */
  initialReading?: BlockReading | null;
  /** when provided, a fresh reading is persisted through this callback */
  onSave?: (reading: BlockReading) => void;
  onNextMode: (subjectId: string, modeLabel: string) => void;
}

/**
 * The "Read this block" button and its three-line result (Pattern / Gap /
 * Next mode). Never fires on its own — only when pressed.
 */
export function BlockReader({ payload, subjectId, initialReading, onSave, onNextMode }: Props) {
  const [reading, setReading] = useState<BlockReading | null>(initialReading ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await readBlock(payload);
      setReading(result);
      onSave?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sheet-section reading">
      <div className="reading-head">
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={read}
          disabled={loading}
        >
          {loading ? 'Reading…' : 'Read this block'}
        </button>
        <span className="reading-footer">Notes leave this device only when you press Read this block.</span>
      </div>

      {error && (
        <p className="reading-error" role="alert">
          {error}
        </p>
      )}

      {reading && !error && (
        <dl className="reading-lines">
          <div>
            <dt>Pattern</dt>
            <dd>{reading.pattern}</dd>
          </div>
          <div>
            <dt>Gap</dt>
            <dd>{reading.gap}</dd>
          </div>
          <div>
            <dt>Next mode</dt>
            <dd>
              <button
                type="button"
                className="reading-next"
                onClick={() => onNextMode(subjectId, reading.nextMode)}
              >
                {reading.nextMode}
              </button>
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
