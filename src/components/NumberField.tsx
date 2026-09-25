import { useState } from 'react';
import { formatNumber } from '../trig/format';
import { parseNumber } from '../trig/parseNumber';

interface NumberFieldProps {
  value: number;
  places?: number;
  /** parsed is null when the text isn't a number; leave the value alone */
  onCommit: (raw: string, parsed: number | null) => void;
  className?: string;
  title?: string;
  highlighted?: boolean;
  /** what this box holds. The visible text that says so is in a sibling label
   *  that belongs to the radio button beside it, so it names nothing here. */
  ariaLabel: string;
  /** what the up and down arrows should do, if anything: the same step the
   *  buttons beside the box take */
  onStep?: (sign: 1 | -1) => void;
}

/** A textbox that shows a formatted number and commits on Enter or blur,
 *  mirroring the txtAngles/txtFunctions/txtRadius KeyPress(13)/LostFocus
 *  pattern - and stepping on the arrow keys, where a hand already is after
 *  typing into it. */
function format(value: number, places: number): string {
  return Number.isNaN(value) ? 'Undefined' : formatNumber(value, places);
}

export default function NumberField({
  value,
  places = 2,
  onCommit,
  className,
  title,
  highlighted,
  ariaLabel,
  onStep,
}: NumberFieldProps) {
  // Only what's being typed is state. The rest of the time the box simply shows
  // the current value, formatted - derived on the spot rather than copied into
  // state and then kept in step with an effect.
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const shown = editing ? draft : format(value, places);

  function commit() {
    if (editing) onCommit(draft, parseNumber(draft));
    setEditing(false);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      className={className}
      title={title}
      style={highlighted ? { background: '#fffbcc', color: '#111827' } : undefined}
      value={shown}
      onFocus={() => {
        setDraft(format(value, places));
        setEditing(true);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
          return;
        }
        if (!onStep || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        // the browser would otherwise run the caret to one end of the text
        e.preventDefault();
        // anything half-typed is taken first, so the step is from what the box
        // says rather than from the value it was about to stop showing
        commit();
        onStep(e.key === 'ArrowUp' ? 1 : -1);
      }}
    />
  );
}
