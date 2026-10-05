// The path the play button's sweep takes, as angles.
//
// A sweep runs at a fixed speed round the circle - so many seconds per
// revolution - rather than taking a fixed time to cross the graph. That keeps
// the circle turning at the same pace however the graph is zoomed, and in arc
// mode too, where the graph's horizontal axis is a ratio: equal steps of ratio
// are not equal steps of angle, so there the point on the graph speeds up and
// slows down while the circle turns evenly.
//
// Every frame gets its own angle, so the motion is as smooth as the screen
// can draw it. Each one is worked out afresh from where the sweep started and
// how far it has come, never by adding to the last angle, so no rounding error
// builds up along the way. It starts and ends on whole degrees, and a sweep
// that is stopped partway snaps to one, so it always comes to rest on a clean
// angle.

import { AngleMode, clampToArcDomain, getRadians, PI, TrigFunction } from './trigMath';

/** A stretch of the sweep, walked from start to end in degrees - which may be
 *  downhill, since arccosine and friends fall as the ratio rises. */
export interface SweepSegment {
  start: number;
  end: number;
}

export interface Sweep {
  /** how far the sweep turns, in degrees, all its stretches together */
  length: number;
  /** the angle a given distance into the sweep, in degrees */
  angleAt: (distance: number) => number;
}

const DEGREES_PER_RADIAN = 180 / PI;

/** Close enough to a whole degree is a whole degree - otherwise an angle that
 *  comes back from the radians as 89.99999999999999 would round down to 89. */
function tidy(degrees: number): number {
  return Math.round(degrees * 1e9) / 1e9;
}

/** Where the arc function is defined, piece by piece. Arcsecant and
 *  arccosecant skip the gap between -1 and 1, and their angle jumps across it. */
function arcDomainPieces(fn: TrigFunction): [number, number][] {
  switch (fn) {
    case TrigFunction.Sine:
    case TrigFunction.Cosine:
      return [[-1, 1]];
    case TrigFunction.Secant:
    case TrigFunction.Cosecant:
      return [
        [-Infinity, -1],
        [1, Infinity],
      ];
    default:
      return [[-Infinity, Infinity]];
  }
}

/** The angles a sweep across the graph window passes through, in order, left
 *  to right across the graph. One stretch for the standard functions, where the
 *  angle is the horizontal axis; for the arc ones, one per piece of the
 *  function's domain the window takes in, each running between the angles at
 *  its two ends - each arc function is monotonic on each piece, so the angle
 *  covers everything between them on the way. */
export function sweepSegments({
  fn,
  inverseMode,
  angleMode,
  xMin,
  xMax,
}: {
  fn: TrigFunction;
  inverseMode: boolean;
  angleMode: AngleMode;
  xMin: number;
  xMax: number;
}): SweepSegment[] {
  if (!inverseMode) {
    const scale = angleMode === AngleMode.Degrees ? 1 : DEGREES_PER_RADIAN;
    return xMax > xMin ? [{ start: tidy(xMin * scale), end: tidy(xMax * scale) }] : [];
  }
  const from = clampToArcDomain(fn, xMin);
  const to = clampToArcDomain(fn, xMax);
  const segments: SweepSegment[] = [];
  for (const [lo, hi] of arcDomainPieces(fn)) {
    const a = Math.max(lo, from);
    const b = Math.min(hi, to);
    if (!(b > a)) continue;
    segments.push({
      start: tidy(getRadians(fn, a).radians * DEGREES_PER_RADIAN),
      end: tidy(getRadians(fn, b).radians * DEGREES_PER_RADIAN),
    });
  }
  return segments;
}

/** The sweep, with each stretch trimmed to the whole degrees just inside it,
 *  so a window that starts at -537.4 starts the sweep at -537, and arcsecant
 *  from a ratio of -20 starts at 93 rather than 92.87. */
export function wholeDegreeSweep(segments: SweepSegment[]): Sweep {
  const trimmed: SweepSegment[] = [];
  for (const { start, end } of segments) {
    const up = end >= start;
    const first = up ? Math.ceil(start) : Math.floor(start);
    const last = up ? Math.floor(end) : Math.ceil(end);
    if (up ? last > first : last < first) trimmed.push({ start: first, end: last });
  }
  const length = trimmed.reduce((sum, s) => sum + Math.abs(s.end - s.start), 0);

  function angleAt(distance: number): number {
    let left = Math.max(0, Math.min(length, distance));
    for (const s of trimmed) {
      const span = Math.abs(s.end - s.start);
      if (left <= span) return s.start + Math.sign(s.end - s.start) * left;
      left -= span;
    }
    return NaN;
  }

  return { length, angleAt };
}
