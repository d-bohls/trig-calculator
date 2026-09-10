// The circle's own settings: currently just the radius. Applies live; Cancel
// reverts back to whatever it was when the dialog was opened. The readout's
// decimal places come from the Function settings, so there is only one place
// to set them.

import { useRef, useState } from 'react';
import type { CalculatorApi } from '../../state/useCalculatorState';
import { DEFAULT_SETTINGS } from '../../state/persistence';
import Modal from '../Modal';
import Stepper from '../Stepper';
import './SettingsDialog.css';

export default function CircleSettingsDialog({ api, onClose }: { api: CalculatorApi; onClose: () => void }) {
  const initial = useRef({ radius: api.radius });
  // two quick clicks on the stepper land in the same render, so the delta has
  // to come off a ref - read from state, the second click would still see the
  // value the first one replaced and the step would be lost
  const latestRadius = useRef(api.radius);
  const [radius, setRadius] = useState(String(api.radius));
  const [error, setError] = useState<string | null>(null);

  function update(value: string) {
    setRadius(value);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return; // still mid-edit
    if (parsed <= 0) {
      setError('Radius must be greater than 0.');
      return;
    }
    setError(null);
    latestRadius.current = parsed;
    api.setRadius(parsed);
  }

  /* A whole unit per click: radius is a plain scale factor, and 1, 2, 3 are
     the values anyone actually reaches for. It can't be stepped to zero or
     below, which the field would reject anyway. */
  function step(delta: number) {
    const next = Math.round((latestRadius.current + delta) * 1e6) / 1e6;
    if (next <= 0) return;
    latestRadius.current = next;
    setRadius(String(next));
    setError(null);
    api.setRadius(next);
  }

  function cancel() {
    latestRadius.current = initial.current.radius;
    api.setRadius(initial.current.radius);
    onClose();
  }

  function reset() {
    setRadius(String(DEFAULT_SETTINGS.radius));
    setError(null);
    latestRadius.current = DEFAULT_SETTINGS.radius;
    api.setRadius(DEFAULT_SETTINGS.radius);
  }

  return (
    <Modal title="Circle Settings" onClose={cancel}>
      <div className="settings-dialog">
        <div className="settings-dialog__row">
          <label>Radius</label>
          <div className="settings-dialog__stepped">
            <input type="text" inputMode="decimal" value={radius} onChange={(e) => update(e.target.value)} />
            <Stepper onUp={() => step(1)} onDown={() => step(-1)} />
          </div>
        </div>
        {error && <p className="settings-dialog__error">{error}</p>}
        <div className="settings-dialog__actions">
          <button type="button" onClick={onClose}>
            OK
          </button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
          <button type="button" onClick={reset}>
            Reset
          </button>
        </div>
      </div>
    </Modal>
  );
}
