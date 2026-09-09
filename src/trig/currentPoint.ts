// Shared logic for "where is the current angle/ratio on the graph", used by
// both the FunctionGraph canvas and the Automation dialog. Mirrors the
// xval/yval computation in modGraph.bas's MoveGraphPoint.

import { AngleMode, type Ratio } from './trigMath';

export function getCurrentGraphPoint(opts: {
  radians: number;
  degrees: number;
  angleMode: AngleMode;
  inverseMode: boolean;
  ratio: Ratio;
}): { xval: number; yval: number } {
  const { radians, degrees, angleMode, inverseMode, ratio } = opts;
  const angleInUnit = angleMode === AngleMode.Degrees ? degrees : radians;
  if (!inverseMode) {
    return { xval: angleInUnit, yval: ratio.value };
  }
  return { xval: ratio.value, yval: angleInUnit };
}
