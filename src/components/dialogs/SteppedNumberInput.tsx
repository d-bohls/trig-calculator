// A whole-number settings field with the app's own up/down arrows.
//
// These were plain type="number" inputs, which meant the browser drew its
// native spinner - a completely different control from the arrows on the angle
// fields, and jarring next to them in the same dialog. The input stays a
// number for the sake of its keyboard and validation; only the native spinner
// is suppressed, in SettingsDialog.css.

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
  function clamp(n: number): number {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  // Reading the prop is enough for the arrows to accumulate: a click is a
  // discrete event, so React has already re-rendered with the new value before
  // the next one arrives, however fast the clicking.
  function commit(n: number) {
    onChange(clamp(n));
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
      <Stepper onUp={() => commit(value + 1)} onDown={() => commit(value - 1)} />
    </div>
  );
}
