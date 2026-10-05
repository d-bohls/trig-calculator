// The graph window size (formerly Forms/frmZoom.frm) and how fast the play
// button's sweep turns. Every field applies live; the dialog's Cancel puts it
// back. The tangent-line toggle sits on the panel's own toolbar, next to the
// button that opens these settings.

import { useState } from 'react';
import type { CalculatorApi } from '../../state/useCalculatorState';
import { DEFAULT_SETTINGS, defaultGraphWindow } from '../../state/persistence';
import { AngleMode } from '../../trig/trigMath';
import { restoreGraphSettings } from './settingsSnapshots';

type FieldKey = 'xMin' | 'xMax' | 'yMin' | 'yMax';

export default function GraphSettingsTab({ api }: { api: CalculatorApi }) {
  const [xMin, setXMin] = useState(String(api.graphWindow.xMin));
  const [xMax, setXMax] = useState(String(api.graphWindow.xMax));
  const [yMin, setYMin] = useState(String(api.graphWindow.yMin));
  const [yMax, setYMax] = useState(String(api.graphWindow.yMax));
  const [error, setError] = useState<string | null>(null);

  // named for what the axis measures rather than as x and y, which in arc mode
  // would mean the opposite of what they mean everywhere else in the app
  const angleLabel = api.angleMode === AngleMode.Degrees ? 'Degrees' : 'Radians';
  const xLabel = api.inverseMode ? 'Ratio' : angleLabel;
  const yLabel = api.inverseMode ? angleLabel : 'Ratio';

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

  /** The whole panel as the app first opens it, not just the bounds: the
   *  tangent line goes away with them. */
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
    restoreGraphSettings(api, { window: d, revolutionSeconds: DEFAULT_SETTINGS.revolutionSeconds, showTangent: DEFAULT_SETTINGS.showTangent });
  }

  const field = (label: string, value: string, key: FieldKey) => (
    <div className="settings-dialog__row">
      <label>{label}</label>
      <input type="text" inputMode="decimal" value={value} onChange={(e) => update(key, e.target.value)} />
    </div>
  );

  return (
    <>
      {api.inverseMode && (
        <p className="settings-dialog__hint">
          Function Type is set to Arc, so the axes are swapped: the horizontal axis is the input ratio and the
          vertical axis is the resulting angle.
        </p>
      )}
      {field(`Min ${xLabel}`, xMin, 'xMin')}
      {field(`Max ${xLabel}`, xMax, 'xMax')}
      {/* the two axes measure different things, so they read as two pairs
          rather than four numbers in a column */}
      <hr className="settings-dialog__divider" />
      {field(`Min ${yLabel}`, yMin, 'yMin')}
      {field(`Max ${yLabel}`, yMax, 'yMax')}
      {error && <p className="settings-dialog__error">{error}</p>}
      <hr className="settings-dialog__divider" />
      <div className="settings-dialog__row">
        <label htmlFor="graph-settings-sweep">Time per revolution</label>
        <div className="settings-dialog__slider">
          <input
            id="graph-settings-sweep"
            type="range"
            min={2}
            max={60}
            step={1}
            value={api.revolutionSeconds}
            onChange={(e) => api.setRevolutionSeconds(Number(e.target.value))}
          />
          <span className="settings-dialog__slider-value">{api.revolutionSeconds}s</span>
        </div>
      </div>
      <div className="settings-dialog__reset">
        <button type="button" aria-label="Reset Graph" onClick={reset}>
          Reset
        </button>
      </div>
    </>
  );
}
