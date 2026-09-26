// Port of Forms/frmSettings.frm (decimal places), plus the angle step. Every
// field applies live as you change it; Cancel reverts everything back to how
// it was when the dialog was opened. Standard vs arc lives on the panel
// itself, since it changes how every row there reads.

import { useRef } from 'react';
import type { CalculatorApi } from '../../state/useCalculatorState';
import { DEFAULT_SETTINGS } from '../../state/persistence';
import Modal from '../Modal';
import SteppedNumberInput from './SteppedNumberInput';
import './SettingsDialog.css';

export default function FunctionSettingsDialog({ api, onClose }: { api: CalculatorApi; onClose: () => void }) {
  const initial = useRef({
    anglePlaces: api.anglePlaces,
    resultPlaces: api.resultPlaces,
    angleStepDegrees: api.angleStepDegrees,
    inverseMode: api.inverseMode,
    angleMode: api.angleMode,
    functionMode: api.functionMode,
    degrees: api.degrees,
  });

  /** Puts the panel back the way it was opened - including what Reset changed
   *  beyond this dialog's own fields. */
  function cancel() {
    const s = initial.current;
    api.setDecimalPlaces(s.anglePlaces, s.resultPlaces);
    api.setAngleStep(s.angleStepDegrees);
    api.setInverseMode(s.inverseMode);
    api.setAngleMode(s.angleMode);
    api.setFunctionMode(s.functionMode);
    api.setDegrees(s.degrees);
    onClose();
  }

  /** The whole panel as the app first opens it, not just the two or three
   *  numbers this dialog holds: standard functions, degrees, sine selected, at
   *  the angle it starts on. The mode goes back before the angle does, since
   *  an arc function would pull an angle outside its range back in on the way
   *  past. */
  function reset() {
    api.setDecimalPlaces(DEFAULT_SETTINGS.anglePlaces, DEFAULT_SETTINGS.resultPlaces);
    api.setAngleStep(DEFAULT_SETTINGS.angleStepDegrees);
    api.setInverseMode(DEFAULT_SETTINGS.inverseMode);
    api.setAngleMode(DEFAULT_SETTINGS.angleMode);
    api.setFunctionMode(DEFAULT_SETTINGS.functionMode);
    api.setDegrees(DEFAULT_SETTINGS.degrees);
  }

  const row = (label: string, value: number, onChange: (n: number) => void) => (
    <div className="settings-dialog__row">
      <label>{label}</label>
      <SteppedNumberInput value={value} min={0} max={8} onChange={onChange} />
    </div>
  );

  return (
    <Modal title="Function Settings" onClose={cancel}>
      <div className="settings-dialog">
        <div className="settings-dialog__row">
          <label htmlFor="settings-angle-step">Angle step (degrees)</label>
          <SteppedNumberInput id="settings-angle-step" value={api.angleStepDegrees} min={1} max={15} onChange={api.setAngleStep} />
        </div>
        <hr className="settings-dialog__divider" />
        {row('Angle decimal places', api.anglePlaces, (v) =>
          api.setDecimalPlaces(v, api.resultPlaces),
        )}
        {row('Result decimal places', api.resultPlaces, (v) =>
          api.setDecimalPlaces(api.anglePlaces, v),
        )}
        <hr className="settings-dialog__divider" />
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
