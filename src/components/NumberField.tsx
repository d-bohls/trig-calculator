import { useEffect, useState } from 'react';
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
  const [text, setText] = useState(format(value, places));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(format(value, places));
  }, [value, places, editing]);

  function commit() {
    onCommit(text, valOf(text));
    setEditing(false);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      title={title}
      style={highlighted ? { background: '#fffbcc', color: '#111827' } : undefined}
      value={text}
      onFocus={() => setEditing(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
    />
  );
}
