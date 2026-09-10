// Port of the global state + behavior spread across modSettings.bas,
// modCircle.bas and frmCalc.frm's UpdateResults chain.

import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  AngleMode,
  getInverseFunctionRange,
  getRadians,
  getRatio,
  PI,
  periodLength,
  TrigFunction,
} from '../trig/trigMath';
import {
  DEFAULT_SETTINGS,
  defaultGraphWindow,
  type GraphKind,
  graphKindOf,
  loadSettings,
  type PersistedSettings,
  saveSettings,
} from './persistence';

export interface GraphWindow {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** The angle is stored in degrees, not radians. Repeatedly nudging an angle
 *  held in radians accumulates floating point error (and leaves it landing
 *  just shy of the exact multiples the symbolic values key off), whereas the
 *  interesting angles are all whole degrees. Radians are derived for display
 *  and for feeding Math.sin and friends. */
const DEGREES_PER_RADIAN = 180 / PI;

/** Converting an entered radian value to degrees leaves float noise in the
 *  low bits; round it away. Nine decimal places of a degree is ~1.7e-11
 *  radians - orders of magnitude finer than the smallest digit the radians
 *  field can show (1e-8 at the maximum of 8 decimal places), so the value the
 *  user typed is never altered on screen. */
function degreesFromRadians(radians: number): number {
  const factor = 1e9;
  return Math.round(radians * DEGREES_PER_RADIAN * factor) / factor;
}

interface State {
  degrees: number;
  functionMode: TrigFunction;
  angleMode: AngleMode;
  inverseMode: boolean;
  anglePlaces: number;
  resultPlaces: number;
  angleStepDegrees: number;
  sweepSeconds: number;
  /** one window per graph kind - see GraphKind in persistence.ts. The active
   *  one follows from inverseMode and functionMode, so switching between them
   *  never disturbs a window you set up for another. */
  graphWindows: Record<GraphKind, GraphWindow>;
  showTangent: boolean;
  /** snapshot of the angle taken the instant inverse mode is turned on, so
   *  turning it back off restores the angle the user actually had (fixes
   *  the VB6 bug where switching to/from the arc functions lost the angle) */
  savedDegrees: number | null;
}

type Action =
  | { type: 'SET_DEGREES'; degrees: number }
  | { type: 'SET_FUNCTION_MODE'; mode: TrigFunction }
  | { type: 'SET_ANGLE_MODE'; mode: AngleMode }
  | { type: 'SET_RATIO'; ratio: number }
  | { type: 'ADD_PERIOD'; sign: 1 | -1 }
  | { type: 'NUDGE_ANGLE'; sign: 1 | -1 }
  | { type: 'SET_INVERSE_MODE'; enabled: boolean }
  | { type: 'SET_GRAPH_WINDOW'; window: GraphWindow }
  | { type: 'SET_SHOW_TANGENT'; show: boolean }
  | { type: 'SET_DECIMAL_PLACES'; anglePlaces: number; resultPlaces: number }
  | { type: 'SET_ANGLE_STEP'; degrees: number }
  | { type: 'SET_SWEEP_SECONDS'; seconds: number }
  | { type: 'RESTORE_GRAPH_WINDOW_DEFAULTS' }
  | { type: 'RESTORE_MASK_DEFAULTS' };

function clampToInverseRange(degrees: number, mode: TrigFunction): number {
  const { lower, upper } = getInverseFunctionRange(mode);
  const lowerDeg = lower * DEGREES_PER_RADIAN;
  const upperDeg = upper * DEGREES_PER_RADIAN;
  if (degrees < lowerDeg) return lowerDeg;
  if (degrees > upperDeg) return upperDeg;
  return degrees;
}

function init(): State {
  const s = loadSettings();
  return {
    degrees: s.degrees,
    functionMode: s.functionMode,
    angleMode: s.angleMode,
    inverseMode: s.inverseMode,
    anglePlaces: s.anglePlaces,
    resultPlaces: s.resultPlaces,
    angleStepDegrees: s.angleStepDegrees,
    sweepSeconds: s.sweepSeconds,
    graphWindows: s.graphWindows,
    showTangent: s.showTangent,
    savedDegrees: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_DEGREES': {
      let degrees = action.degrees;
      if (state.inverseMode) degrees = clampToInverseRange(degrees, state.functionMode);
      return { ...state, degrees };
    }
    case 'SET_FUNCTION_MODE': {
      let degrees = state.degrees;
      if (state.inverseMode) degrees = clampToInverseRange(degrees, action.mode);
      // no window juggling here: the active window follows from the kind, and
      // the kind follows from the function
      return { ...state, functionMode: action.mode, degrees };
    }
    case 'SET_ANGLE_MODE': {
      if (action.mode === state.angleMode) return state;
      // the bounds are plain numbers interpreted as whichever unit is on the
      // angle axis - x for the standard functions, y for the arc ones. Rescale
      // every kind, not just the one on screen, so the others are still right
      // when you come back to them.
      const factor = action.mode === AngleMode.Degrees ? DEGREES_PER_RADIAN : 1 / DEGREES_PER_RADIAN;
      const graphWindows = {} as Record<GraphKind, GraphWindow>;
      for (const [kind, w] of Object.entries(state.graphWindows) as [GraphKind, GraphWindow][]) {
        graphWindows[kind] =
          kind === 'standard'
            ? { ...w, xMin: w.xMin * factor, xMax: w.xMax * factor }
            : { ...w, yMin: w.yMin * factor, yMax: w.yMax * factor };
      }
      return { ...state, angleMode: action.mode, graphWindows };
    }
    case 'SET_RATIO': {
      const { radians, ok } = getRadians(state.functionMode, action.ratio);
      if (!ok) return state;
      const degrees = degreesFromRadians(radians);
      return { ...state, degrees: state.inverseMode ? clampToInverseRange(degrees, state.functionMode) : degrees };
    }
    case 'ADD_PERIOD': {
      // exact in degrees: 360 for sine and friends, 180 for tangent/cotangent
      const delta = action.sign * periodLength(state.functionMode) * DEGREES_PER_RADIAN;
      let degrees = state.degrees + Math.round(delta);
      if (state.inverseMode) degrees = clampToInverseRange(degrees, state.functionMode);
      return { ...state, degrees };
    }
    case 'NUDGE_ANGLE': {
      let degrees = state.degrees + action.sign * state.angleStepDegrees;
      if (state.inverseMode) degrees = clampToInverseRange(degrees, state.functionMode);
      return { ...state, degrees };
    }
    case 'SET_INVERSE_MODE': {
      if (action.enabled === state.inverseMode) return state;
      if (action.enabled) {
        return {
          ...state,
          inverseMode: true,
          savedDegrees: state.degrees,
          degrees: clampToInverseRange(state.degrees, state.functionMode),
        };
      }
      return {
        ...state,
        inverseMode: false,
        degrees: state.savedDegrees ?? state.degrees,
        savedDegrees: null,
      };
    }
    case 'SET_GRAPH_WINDOW':
      return {
        ...state,
        graphWindows: {
          ...state.graphWindows,
          [graphKindOf(state.inverseMode, state.functionMode)]: action.window,
        },
      };
    case 'SET_SHOW_TANGENT':
      return { ...state, showTangent: action.show };
    case 'SET_DECIMAL_PLACES':
      return {
        ...state,
        anglePlaces: action.anglePlaces,
        resultPlaces: action.resultPlaces,
      };
    case 'SET_ANGLE_STEP':
      return { ...state, angleStepDegrees: action.degrees };
    case 'SET_SWEEP_SECONDS':
      return { ...state, sweepSeconds: action.seconds };
    case 'RESTORE_GRAPH_WINDOW_DEFAULTS': {
      const kind = graphKindOf(state.inverseMode, state.functionMode);
      return {
        ...state,
        graphWindows: { ...state.graphWindows, [kind]: defaultGraphWindow(kind, state.angleMode) },
      };
    }
    case 'RESTORE_MASK_DEFAULTS':
      return {
        ...state,
        anglePlaces: DEFAULT_SETTINGS.anglePlaces,
        resultPlaces: DEFAULT_SETTINGS.resultPlaces,
      };
  }
}

export function useCalculatorState() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    const toSave: PersistedSettings = {
      degrees: state.degrees,
      functionMode: state.functionMode,
      angleMode: state.angleMode,
      inverseMode: state.inverseMode,
      anglePlaces: state.anglePlaces,
      resultPlaces: state.resultPlaces,
      angleStepDegrees: state.angleStepDegrees,
      sweepSeconds: state.sweepSeconds,
      graphWindows: state.graphWindows,
      showTangent: state.showTangent,
    };
    saveSettings(toSave);
  }, [state]);

  const radians = state.degrees / DEGREES_PER_RADIAN;
  const graphKind = graphKindOf(state.inverseMode, state.functionMode);
  const graphWindow = state.graphWindows[graphKind];

  const ratios = useMemo(
    () => ({
      [TrigFunction.Sine]: getRatio(TrigFunction.Sine, radians),
      [TrigFunction.Cosine]: getRatio(TrigFunction.Cosine, radians),
      [TrigFunction.Tangent]: getRatio(TrigFunction.Tangent, radians),
      [TrigFunction.Cotangent]: getRatio(TrigFunction.Cotangent, radians),
      [TrigFunction.Secant]: getRatio(TrigFunction.Secant, radians),
      [TrigFunction.Cosecant]: getRatio(TrigFunction.Cosecant, radians),
    }),
    [radians],
  );

  const selectedRatio = ratios[state.functionMode];
  // the circle is the unit circle, so these are the ratios themselves
  const x = Math.cos(radians);
  const y = Math.sin(radians);

  const setDegrees = useCallback((degrees: number) => dispatch({ type: 'SET_DEGREES', degrees }), []);
  /** Entry point for anything that produces an angle in radians (the radians
   *  field, arc-function results). Converted to degrees for storage. */
  const setRadians = useCallback(
    (value: number) => dispatch({ type: 'SET_DEGREES', degrees: degreesFromRadians(value) }),
    [],
  );
  /** For the graph and circle, where a drag lands on an arbitrary angle -
   *  snap to a whole degree so repeated dragging can't drift. */
  const setDegreesSnapped = useCallback(
    (degrees: number) => dispatch({ type: 'SET_DEGREES', degrees: Math.round(degrees) }),
    [],
  );
  const setFunctionMode = useCallback((mode: TrigFunction) => dispatch({ type: 'SET_FUNCTION_MODE', mode }), []);
  const setAngleMode = useCallback((mode: AngleMode) => dispatch({ type: 'SET_ANGLE_MODE', mode }), []);
  const setRatio = useCallback((ratio: number) => dispatch({ type: 'SET_RATIO', ratio }), []);
  const addPeriod = useCallback((sign: 1 | -1) => dispatch({ type: 'ADD_PERIOD', sign }), []);
  const nudgeAngle = useCallback((sign: 1 | -1) => dispatch({ type: 'NUDGE_ANGLE', sign }), []);
  const setInverseMode = useCallback((enabled: boolean) => dispatch({ type: 'SET_INVERSE_MODE', enabled }), []);
  const setGraphWindow = useCallback((window: GraphWindow) => dispatch({ type: 'SET_GRAPH_WINDOW', window }), []);
  const setShowTangent = useCallback((show: boolean) => dispatch({ type: 'SET_SHOW_TANGENT', show }), []);
  const setDecimalPlaces = useCallback(
    (anglePlaces: number, resultPlaces: number) =>
      dispatch({ type: 'SET_DECIMAL_PLACES', anglePlaces, resultPlaces }),
    [],
  );
  const setAngleStep = useCallback((degrees: number) => dispatch({ type: 'SET_ANGLE_STEP', degrees }), []);
  const setSweepSeconds = useCallback((seconds: number) => dispatch({ type: 'SET_SWEEP_SECONDS', seconds }), []);
  const restoreGraphWindowDefaults = useCallback(() => dispatch({ type: 'RESTORE_GRAPH_WINDOW_DEFAULTS' }), []);
  const restoreMaskDefaults = useCallback(() => dispatch({ type: 'RESTORE_MASK_DEFAULTS' }), []);

  return {
    ...state,
    radians,
    graphKind,
    graphWindow,
    ratios,
    selectedRatio,
    x,
    y,
    setDegrees,
    setDegreesSnapped,
    setRadians,
    setFunctionMode,
    setAngleMode,
    setRatio,
    addPeriod,
    nudgeAngle,
    setInverseMode,
    setGraphWindow,
    setShowTangent,
    setDecimalPlaces,
    setAngleStep,
    setSweepSeconds,
    restoreGraphWindowDefaults,
    restoreMaskDefaults,
  };
}

export type CalculatorApi = ReturnType<typeof useCalculatorState>;
