// Port of Modules/modGraph.bas: PlotGraphPoints

import { AngleMode, getRadians, getRatio, PI, TrigFunction } from './trigMath';
import type { GraphWindow } from '../state/useCalculatorState';

export interface GraphPoint {
  x: number;
  y: number;
  isUndefined: boolean;
}

export interface PlotOptions {
  fn: TrigFunction;
  inverseMode: boolean;
  angleMode: AngleMode;
  window: GraphWindow;
  /** approximate number of horizontal pixels available, used to pick a sample spacing */
  pixelWidth: number;
}

/** A window far enough from sane that sampling it would lock up the tab. */
const MAX_SAMPLES = 1_000_000;

/** Returns the sampling step (dx) and the plotted points across the window. */
export function plotGraphPoints({ fn, inverseMode, angleMode, window, pixelWidth }: PlotOptions): {
  dx: number;
  points: GraphPoint[];
} {
  const { xMin, xMax } = window;
  const graphWidth = xMax - xMin;
  const desiredPoints = Math.max(1, Math.round(pixelWidth));
  let dx = graphWidth / desiredPoints;

  // Everything interesting on this axis happens at an exact value, and nothing
  // finds those values for us: a discontinuity is only spotted when a sample
  // lands on it (getRatio flags a point undefined when its denominator rounds
  // to zero), and a branch only reaches its endpoint when a sample lands there.
  // Step over one and the curve either runs straight through the asymptote or
  // stops short of the endpoint. So snap the spacing to a grid those values are
  // guaranteed to sit on.
  //
  // Samples per unit of the horizontal axis, or 0 when the grid is a fraction
  // of PI instead.
  let perUnit = 0;
  if (dx > 0) {
    if (inverseMode) {
      // the axis is a ratio here, and every arc function's domain ends on a
      // whole one: -1 and 1 for all four of arcsin, arccos, arcsec, arccsc
      perUnit = Math.max(1, Math.ceil(desiredPoints / graphWidth));
      dx = 1 / perUnit;
    } else if (angleMode === AngleMode.Degrees) {
      // every asymptote falls on a whole degree - odd multiples of 90 for
      // tangent and secant, multiples of 180 for cotangent and cosecant
      perUnit = Math.max(1, Math.ceil(desiredPoints / graphWidth));
      dx = 1 / perUnit;
    } else {
      // the same trick in radians: dividing PI an even number of times keeps
      // every multiple of PI/2 on the grid
      let divisions = Math.floor(PI / dx) + 1;
      if (divisions % 2 === 1) divisions += 1;
      dx = PI / divisions;
    }
  }

  if (!(dx > 0)) return { dx: 0, points: [] };

  const firstStep = Math.floor(xMin / dx) - 1;
  const lastStep = Math.floor(xMax / dx) + 1;
  // A degenerate window - a span far wider than anything readable, or one so
  // far from the origin that the step index runs out of integer precision -
  // would mean a runaway loop and a frozen tab. There's nothing legible to draw
  // at that scale anyway.
  if (!Number.isSafeInteger(firstStep) || !Number.isSafeInteger(lastStep) || lastStep - firstStep > MAX_SAMPLES) {
    return { dx, points: [] };
  }

  const points: GraphPoint[] = [];
  // Positions come from the step index rather than an accumulated cx += dx, so
  // rounding error can't build up across the sweep and nudge samples off the
  // grid. The division is what makes each whole unit land exactly:
  // step * (1 / perUnit) would not.
  for (let step = firstStep; step <= lastStep; step += 1) {
    const cx = perUnit > 0 ? step / perUnit : step * dx;
    if (!inverseMode) {
      const radians = angleMode === AngleMode.Degrees ? (cx * PI) / 180 : cx;
      const ratio = getRatio(fn, radians);
      points.push({ x: cx, y: ratio.value, isUndefined: ratio.isUndefined });
    } else {
      const { radians, ok } = getRadians(fn, cx);
      const y = angleMode === AngleMode.Degrees ? (radians * 180) / PI : radians;
      points.push({ x: cx, y, isUndefined: !ok });
    }
  }

  return { dx, points };
}
