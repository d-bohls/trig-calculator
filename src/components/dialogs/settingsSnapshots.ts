// What each settings tab has to put back when the dialog is cancelled -
// including what that tab's Reset changes beyond its own fields - and how to
// put it back. Kept apart from the tabs so those files export only components.

import type { CalculatorApi } from '../../state/useCalculatorState';

/** What Cancel has to put back for the Functions tab - including what Reset changes
 *  beyond the tab's own fields. */
export function snapshotFunctionSettings(api: CalculatorApi) {
  const { anglePlaces, resultPlaces, angleStepDegrees, inverseMode, angleMode, functionMode, degrees } = api;
  return { anglePlaces, resultPlaces, angleStepDegrees, inverseMode, angleMode, functionMode, degrees };
}

export function restoreFunctionSettings(api: CalculatorApi, s: ReturnType<typeof snapshotFunctionSettings>) {
  api.setDecimalPlaces(s.anglePlaces, s.resultPlaces);
  api.setAngleStep(s.angleStepDegrees);
  // the mode goes back before the angle does, since an arc function would
  // pull an angle outside its range back in on the way past
  api.setInverseMode(s.inverseMode);
  api.setAngleMode(s.angleMode);
  api.setFunctionMode(s.functionMode);
  api.setDegrees(s.degrees);
}

/** What Cancel has to put back for the Graph tab - including what Reset changes
 *  beyond the tab's own fields. */
export function snapshotGraphSettings(api: CalculatorApi) {
  return { window: api.graphWindow, sweepSeconds: api.sweepSeconds, showTangent: api.showTangent };
}

export function restoreGraphSettings(api: CalculatorApi, s: ReturnType<typeof snapshotGraphSettings>) {
  api.setGraphWindow(s.window);
  api.setSweepSeconds(s.sweepSeconds);
  api.setShowTangent(s.showTangent);
}
