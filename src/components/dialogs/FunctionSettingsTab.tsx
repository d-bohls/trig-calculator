// Port of Forms/frmSettings.frm (decimal places), plus the angle step. Every
// field applies live as you change it; the dialog's Cancel puts it back.
// Standard vs arc lives on the panel itself, since it changes how every row
// there reads.

import type { CalculatorApi } from '../../state/useCalculatorState';
import { DEFAULT_SETTINGS } from '../../state/persistence';
import { restoreFunctionSettings } from './settingsSnapshots';
import SteppedNumberInput from './SteppedNumberInput';

export default function FunctionSettingsTab({ api }: { api: CalculatorApi }) {
  /** The whole panel as the app first opens it, not just the two or three
   *  numbers this tab holds: standard functions, degrees, sine selected, at
   *  the angle it starts on. */
  function reset() {
    restoreFunctionSettings(api, DEFAULT_SETTINGS);
  }

  const row = (label: string, value: number, onChange: (n: number) => void) => (
    <div className="settings-dialog__row">
      <label>{label}</label>
      <SteppedNumberInput value={value} min={0} max={8} onChange={onChange} />
    </div>
  );

  return (
    <>
      <div className="settings-dialog__row">
        <label htmlFor="settings-angle-step">Angle step (degrees)</label>
        <SteppedNumberInput id="settings-angle-step" value={api.angleStepDegrees} min={1} max={15} onChange={api.setAngleStep} />
      </div>
      <hr className="settings-dialog__divider" />
      {row('Angle decimal places', api.anglePlaces, (v) => api.setDecimalPlaces(v, api.resultPlaces))}
      {row('Result decimal places', api.resultPlaces, (v) => api.setDecimalPlaces(api.anglePlaces, v))}
      <div className="settings-dialog__reset">
        <button type="button" aria-label="Reset Functions" onClick={reset}>
          Reset
        </button>
      </div>
    </>
  );
}
