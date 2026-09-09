// A whole-number settings field with the app's own up/down arrows.
//
// These were plain type="number" inputs, which meant the browser drew its
// native spinner - a completely different control from the arrows on the angle
// fields, and jarring next to them in the same dialog. The input stays a
// number for the sake of its keyboard and validation; only the native spinner
// is suppressed, in SettingsDialog.css.

import { useRef } from 'react';
import Stepper from '../Stepper';

export default function SteppedNumberInput({
  id,
  value,
  min,
  max,
  onChange,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  // clicks land faster than React re-renders, so a second one would otherwise
  // still read the prop the first has already replaced and its step be lost
  const latest = useRef(value);
  latest.current = value;

  function clamp(n: number): number {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function commit(n: number) {
    const next = clamp(n);
    latest.current = next;
    onChange(next);
  }

  return (
    <div className="settings-dialog__stepped">
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => commit(Number(e.target.value))}
      />
      <Stepper onUp={() => commit(latest.current + 1)} onDown={() => commit(latest.current - 1)} />
    </div>
  );
}
