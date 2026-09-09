// Port of the lower control section of Forms/frmCalc.frm, plus the exact
// values that used to live in the separate frmSymbolic.frm dialog - they're
// shown inline beside each field now, whenever the angle lands on one of the
// 15-degree "special angles".
//
// Each trig row is written as the call it actually represents, so the panel
// reads as six equations rather than six labelled boxes. In arc mode the call
// turns inside out: the ratio becomes the argument and the angle the result.

import type { ReactNode } from 'react';
import type { CalculatorApi } from '../state/useCalculatorState';
import { displayAngle } from '../trig/format';
import { lookupSymbolic, symbolicForFunction, symbolicRadians } from '../trig/symbolicTable';
import {
  AngleMode,
  getInverseFunctionRange,
  getRadians,
  PI,
  periodLength,
  TrigFunction,
  TRIG_FUNCTION_LABELS,
} from '../trig/trigMath';
import GearIcon from './GearIcon';
import NumberField from './NumberField';
import Stepper from './Stepper';
import './FunctionPanel.css';

const FUNCTIONS = [
  TrigFunction.Sine,
  TrigFunction.Cosine,
  TrigFunction.Tangent,
  TrigFunction.Cotangent,
  TrigFunction.Secant,
  TrigFunction.Cosecant,
];

/** "Sin" -> "Arcsin". All six come out six characters wide, so the rows still
 *  line up in the monospace face. */
function arcName(fn: TrigFunction): string {
  return `Arc${TRIG_FUNCTION_LABELS[fn].toLowerCase()}`;
}

/** Tangent and cotangent never reach their bounds, so those get open brackets. */
function isOpenRange(fn: TrigFunction): boolean {
  return fn === TrigFunction.Tangent || fn === TrigFunction.Cotangent;
}

/** The principal range of an arc function, e.g. "[0°, 180°]" or "[0, π]". */
function displayRange(fn: TrigFunction, angleMode: AngleMode): string {
  const { lower, upper } = getInverseFunctionRange(fn);
  const bound = (radians: number) => {
    const degrees = Math.round((radians * 180) / PI);
    if (angleMode === AngleMode.Degrees) return `${degrees}°`;
    return degrees === 0 ? '0' : (symbolicRadians(degrees) ?? String(degrees));
  };
  const [open, close] = isOpenRange(fn) ? ['(', ')'] : ['[', ']'];
  return `${open}${bound(lower)}, ${bound(upper)}${close}`;
}

export default function FunctionPanel({ api, onOpenSettings }: { api: CalculatorApi; onOpenSettings: () => void }) {
  const { radians, degrees, angleMode, functionMode, inverseMode, ratios, anglePlaces, resultPlaces } = api;
  const symbolic = lookupSymbolic(degrees);
  const angleText = displayAngle(degrees, angleMode, anglePlaces);

  // the period is function-dependent (180 degrees for tangent and cotangent,
  // 360 for the rest), which isn't obvious from a bare +/- pair - so name the
  // amount, in whichever unit is being shown
  const periodInRadians = periodLength(functionMode);
  const periodLabel =
    angleMode === AngleMode.Degrees
      ? `${Math.round((periodInRadians * 180) / PI)}°`
      : periodInRadians === PI
        ? 'π'
        : '2π';

  function handleRatioCommit(fn: TrigFunction, raw: string) {
    const upper = raw.trim().toUpperCase();
    if (upper === 'UNDEFINED') {
      switch (fn) {
        case TrigFunction.Tangent:
        case TrigFunction.Secant:
          api.setRadians(PI / 2);
          break;
        case TrigFunction.Cotangent:
        case TrigFunction.Cosecant:
          api.setRadians(0);
          break;
      }
      return;
    }
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) api.setRatio(parsed);
  }

  function renderTrigRow(fn: TrigFunction) {
    const ratio = ratios[fn];
    const selected = functionMode === fn;
    const field = (
      <Field>
        <NumberField
          value={ratio.isUndefined ? NaN : ratio.value}
          places={resultPlaces}
          highlighted={selected}
          onCommit={(raw) => handleRatioCommit(fn, raw)}
        />
      </Field>
    );
    const radio = <input type="radio" checked={selected} onChange={() => api.setFunctionMode(fn)} />;

    if (!inverseMode) {
      return (
        <div className="function-panel__row function-panel__row--trig" key={fn}>
          <label className="function-panel__call">
            {radio}
            <span>
              {TRIG_FUNCTION_LABELS[fn]}({angleText}) =
            </span>
          </label>
          {field}
          <Symbolic value={symbolicForFunction(symbolic, fn) ?? undefined} />
        </div>
      );
    }

    // The angle is clamped to the *selected* function's principal range, so on
    // the other five rows the arc function may not be able to return it at all
    // - arccos can never yield -60 degrees. Show what the function really gives
    // and say why it differs, rather than printing an equation that's false.
    const arc = ratio.isUndefined ? null : getRadians(fn, ratio.value);
    const arcDegrees = arc && arc.ok ? Math.round(((arc.radians * 180) / PI) * 1e9) / 1e9 : NaN;
    const known = Number.isFinite(arcDegrees);
    const diverges = known && Math.abs(arcDegrees - degrees) > 1e-9;

    return (
      <div className="function-panel__row function-panel__row--trig function-panel__row--arc" key={fn}>
        <label className="function-panel__call function-panel__call--arc">
          {radio}
          <span>{arcName(fn)}(</span>
        </label>
        {field}
        <span className="function-panel__arc-result">
          ) = {known ? displayAngle(arcDegrees, angleMode, anglePlaces) : '—'}
        </span>
        <span className="function-panel__note">
          {diverges ? `${angleText} ∉ ${displayRange(fn, angleMode)}` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="function-panel">
      <div className="function-panel__header">
        {/* this one decides how every row below reads, so it belongs on the
            panel rather than buried in the settings dialog */}
        <label className="function-panel__type">
          Function Type:
          <select value={inverseMode ? 'arc' : 'standard'} onChange={(e) => api.setInverseMode(e.target.value === 'arc')}>
            <option value="standard">Standard</option>
            <option value="arc">Inverse/Arc</option>
          </select>
        </label>
        <button
          type="button"
          className="icon-button"
          onClick={onOpenSettings}
          aria-label="Function settings"
          title="Function settings"
        >
          <GearIcon />
        </button>
      </div>

      <div className="function-panel__columns">
        <div className="function-panel__group">
          <h4>Angle</h4>
          <div className="function-panel__row">
            <label>
              <input
                type="radio"
                checked={angleMode === AngleMode.Degrees}
                onChange={() => api.setAngleMode(AngleMode.Degrees)}
              />
              Degrees
            </label>
            <Field stepper={<Stepper onUp={() => api.nudgeAngle(1)} onDown={() => api.nudgeAngle(-1)} />}>
              <NumberField
                value={degrees}
                places={anglePlaces}
                highlighted={angleMode === AngleMode.Degrees}
                onCommit={(_raw, parsed) => api.setDegrees(parsed)}
              />
            </Field>
            <Symbolic />
          </div>
          <div className="function-panel__row">
            <label>
              <input
                type="radio"
                checked={angleMode === AngleMode.Radians}
                onChange={() => api.setAngleMode(AngleMode.Radians)}
              />
              Radians
            </label>
            <Field stepper={<Stepper onUp={() => api.nudgeAngle(1)} onDown={() => api.nudgeAngle(-1)} />}>
              <NumberField
                value={radians}
                places={anglePlaces}
                highlighted={angleMode === AngleMode.Radians}
                onCommit={(_raw, parsed) => api.setRadians(parsed)}
              />
            </Field>
            <Symbolic value={symbolicRadians(degrees) ?? undefined} />
          </div>
          <div className="function-panel__row function-panel__period">
            <span>
              Add/subtract 1 period <span className="function-panel__period-amount">({periodLabel})</span>
            </span>
            <div className="function-panel__period-buttons">
              <button type="button" onClick={() => api.addPeriod(-1)} aria-label={`Subtract ${periodLabel}`}>
                &minus;
              </button>
              <button type="button" onClick={() => api.addPeriod(1)} aria-label={`Add ${periodLabel}`}>
                +
              </button>
            </div>
          </div>
        </div>

        <div className="function-panel__group function-panel__group--trig">
          <h4>Trig Functions</h4>
          {FUNCTIONS.map(renderTrigRow)}
        </div>
      </div>
    </div>
  );
}

/** Wraps a number field so a stepper can sit against its inner right edge. */
function Field({ children, stepper }: { children: ReactNode; stepper?: ReactNode }) {
  return (
    <div className={stepper ? 'function-panel__field function-panel__field--stepped' : 'function-panel__field'}>
      {children}
      {stepper}
    </div>
  );
}

/** Always rendered, even when empty, so the column keeps its width and the
 *  rows don't shift as the angle moves on and off a special angle. */
function Symbolic({ value }: { value?: string }) {
  return <span className="function-panel__symbolic">{value ?? ''}</span>;
}
