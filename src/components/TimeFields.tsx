import type { DurationValue } from '../utils';
export type { DurationValue };

interface Props {
  id: string;
  focus: DurationValue;
  pause: DurationValue;
  onFocus: (next: DurationValue) => void;
  onPause: (next: DurationValue) => void;
  valid: boolean;
}

/**
 * The shared Time block: helper line plus Focused and Paused rows of h / m / s
 * fields. Used identically by the end-session log sheet and the session
 * detail editor.
 */
export function TimeFields({ id, focus, pause, onFocus, onPause, valid }: Props) {
  const row = (
    rowId: string,
    label: string,
    value: DurationValue,
    onChange: (next: DurationValue) => void,
  ) => (
    <div className="duration-row">
      <span className="duration-label">{label}</span>
      {(['h', 'm', 's'] as const).map((part) => (
        <span key={part} className="duration-part">
          <label className="sr-only" htmlFor={`${id}-${rowId}-${part}`}>
            {label} {part === 'h' ? 'hours' : part === 'm' ? 'minutes' : 'seconds'}
          </label>
          <input
            id={`${id}-${rowId}-${part}`}
            className="input input-qty"
            inputMode="numeric"
            value={value[part]}
            onChange={(e) => onChange({ ...value, [part]: e.target.value })}
            aria-label={`${label} ${part === 'h' ? 'hours' : part === 'm' ? 'minutes' : 'seconds'}`}
          />
          <span className="duration-unit" aria-hidden="true">
            {part}
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <fieldset className="sheet-section">
      <legend className="field-label">Time</legend>
      <p className="helper">Correct the clock if you forgot to pause or left it running.</p>
      {row('focus', 'Focused', focus, onFocus)}
      {row('pause', 'Paused', pause, onPause)}
      {!valid && <p className="eff-preview-label">Hours, minutes, and seconds must be zero or more.</p>}
    </fieldset>
  );
}
