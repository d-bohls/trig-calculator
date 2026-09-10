import { useState } from 'react';
import { valOf } from '../trig/valOf';

interface NumberFieldProps {
  value: number;
  places?: number;
  onCommit: (raw: string, parsed: number) => void;
  className?: string;
  title?: string;
  highlighted?: boolean;
}

/** A textbox that shows a formatted number and commits on Enter or blur,
 *  mirroring the txtAngles/txtFunctions/txtRadius KeyPress(13)/LostFocus pattern. */
function format(value: number, places: number): string {
  return Number.isNaN(value) ? 'Undefined' : value.toFixed(places);
}

export default function NumberField({ value, places = 2, onCommit, className, title, highlighted }: NumberFieldProps) {
  // Only what's being typed is state. The rest of the time the box simply shows
  // the current value, formatted - derived on the spot rather than copied into
  // state and then kept in step with an effect.
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const shown = editing ? draft : format(value, places);

  function commit() {
    if (editing) onCommit(draft, valOf(draft));
    setEditing(false);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
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
        }
      }}
    />
  );
}
