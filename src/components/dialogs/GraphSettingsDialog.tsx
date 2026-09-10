// The graph window size (formerly Forms/frmZoom.frm) and how long the play
// button's sweep takes. Every field applies
// live; Cancel reverts everything back to how it was when the dialog was
// opened. The tangent-line toggle sits on the panel's own toolbar, next to
// the button that opens this dialog.

import { useRef, useState } from 'react';
import type { CalculatorApi } from '../../state/useCalculatorState';
import { DEFAULT_SETTINGS, defaultGraphWindow } from '../../state/persistence';
import Modal from '../Modal';
import './SettingsDialog.css';

type FieldKey = 'xMin' | 'xMax' | 'yMin' | 'yMax';

export default function GraphSettingsDialog({ api, onClose }: { api: CalculatorApi; onClose: () => void }) {
  const initial = useRef({ window: api.graphWindow, sweepSeconds: api.sweepSeconds });

  const [xMin, setXMin] = useState(String(api.graphWindow.xMin));
  const [xMax, setXMax] = useState(String(api.graphWindow.xMax));
  const [yMin, setYMin] = useState(String(api.graphWindow.yMin));
  const [yMax, setYMax] = useState(String(api.graphWindow.yMax));
  const [error, setError] = useState<string | null>(null);

  const xLabel = api.inverseMode ? 'Ratio' : 'X';
  const yLabel = api.inverseMode ? 'Angle' : 'Y';

  function tryApply(next: Record<FieldKey, string>) {
    const minX = Number(next.xMin);
    const maxX = Number(next.xMax);
    const minY = Number(next.yMin);
    const maxY = Number(next.yMax);
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
      // still mid-edit (e.g. just typed "-"), not an error yet
      return;
    }
    if (maxX <= minX) {
      setError(`Max ${xLabel} must be greater than Min ${xLabel}.`);
      return;
    }
    if (maxY <= minY) {
      setError(`Max ${yLabel} must be greater than Min ${yLabel}.`);
      return;
    }
    setError(null);
    api.setGraphWindow({ xMin: minX, xMax: maxX, yMin: minY, yMax: maxY });
  }

  function update(key: FieldKey, value: string) {
    const next = { xMin, xMax, yMin, yMax, [key]: value };
    if (key === 'xMin') setXMin(value);
    else if (key === 'xMax') setXMax(value);
    else if (key === 'yMin') setYMin(value);
    else setYMax(value);
    tryApply(next);
  }

  function cancel() {
    api.setGraphWindow(initial.current.window);
    api.setSweepSeconds(initial.current.sweepSeconds);
    onClose();
  }

  function reset() {
    // per graph kind, since a window that suits the standard functions suits
    // neither arc group. The angle axis of the stored defaults is in degrees,
    // so it needs converting when the calculator is showing radians -
    // otherwise "reset" hands back 540 radians of curve, a solid block of ink.
    const d = defaultGraphWindow(api.graphKind, api.angleMode);
    setXMin(String(d.xMin));
    setXMax(String(d.xMax));
    setYMin(String(d.yMin));
    setYMax(String(d.yMax));
    setError(null);
    api.setGraphWindow(d);
    api.setSweepSeconds(DEFAULT_SETTINGS.sweepSeconds);
  }

  const field = (label: string, value: string, key: FieldKey) => (
    <div className="settings-dialog__row">
      <label>{label}</label>
      <input type="text" inputMode="decimal" value={value} onChange={(e) => update(key, e.target.value)} />
    </div>
  );

  return (
    <Modal title="Graph Settings" onClose={cancel}>
      <div className="settings-dialog">
        {api.inverseMode && (
          <p className="settings-dialog__hint">
            Function Type is set to Arc, so the axes are swapped: the horizontal axis is the input ratio and the
            vertical axis is the resulting angle.
          </p>
        )}
        {field(`Min ${xLabel}`, xMin, 'xMin')}
        {field(`Max ${xLabel}`, xMax, 'xMax')}
        {field(`Min ${yLabel}`, yMin, 'yMin')}
        {field(`Max ${yLabel}`, yMax, 'yMax')}
        {error && <p className="settings-dialog__error">{error}</p>}
        <hr className="settings-dialog__divider" />
        <div className="settings-dialog__row">
          <label htmlFor="graph-settings-sweep">Sweep time</label>
          <div className="settings-dialog__slider">
            <input
              id="graph-settings-sweep"
              type="range"
              min={2}
              max={60}
              step={1}
              value={api.sweepSeconds}
              onChange={(e) => api.setSweepSeconds(Number(e.target.value))}
            />
            <span className="settings-dialog__slider-value">{api.sweepSeconds}s</span>
          </div>
        </div>
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
