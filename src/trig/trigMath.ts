// Port of Modules/modTrigFuncs.bas

export const PI = Math.PI;
export const TWO_PI = 2 * PI;
export const SMALL_PI = PI / 1000;

export const TrigFunction = {
  Sine: 0,
  Cosine: 1,
  Tangent: 2,
  Cotangent: 3,
  Secant: 4,
  Cosecant: 5,
} as const;
export type TrigFunction = (typeof TrigFunction)[keyof typeof TrigFunction];

export const AngleMode = {
  Radians: 0,
  Degrees: 1,
} as const;
export type AngleMode = (typeof AngleMode)[keyof typeof AngleMode];

/** "Sin" -> "Arcsin". All six come out six characters wide, so rows written
 *  with them still line up in a monospace face. */
export function arcFunctionName(fn: TrigFunction): string {
  return `Arc${TRIG_FUNCTION_LABELS[fn].toLowerCase()}`;
}

export const TRIG_FUNCTION_LABELS: Record<TrigFunction, string> = {
  [TrigFunction.Sine]: 'Sin',
  [TrigFunction.Cosine]: 'Cos',
  [TrigFunction.Tangent]: 'Tan',
  [TrigFunction.Cotangent]: 'Cot',
  [TrigFunction.Secant]: 'Sec',
  [TrigFunction.Cosecant]: 'Csc',
};

export const TRIG_FUNCTION_NAMES: Record<TrigFunction, string> = {
  [TrigFunction.Sine]: 'Sine',
  [TrigFunction.Cosine]: 'Cosine',
  [TrigFunction.Tangent]: 'Tangent',
  [TrigFunction.Cotangent]: 'Cotangent',
  [TrigFunction.Secant]: 'Secant',
  [TrigFunction.Cosecant]: 'Cosecant',
};

// fraction label, e.g. "y / r", matching the original form's legend
export const TRIG_FUNCTION_FRACTIONS: Record<TrigFunction, string> = {
  [TrigFunction.Sine]: 'y/r',
  [TrigFunction.Cosine]: 'x/r',
  [TrigFunction.Tangent]: 'y/x',
  [TrigFunction.Cotangent]: 'x/y',
  [TrigFunction.Secant]: 'r/x',
  [TrigFunction.Cosecant]: 'r/y',
};

const ROUND_CHECK = 10;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface Ratio {
  value: number;
  isUndefined: boolean;
}

function fromDenominator(numerator: number, denominator: number): Ratio {
  if (roundTo(denominator, ROUND_CHECK) === 0) {
    return { value: NaN, isUndefined: true };
  }
  return { value: numerator / denominator, isUndefined: false };
}

/** ratio = TrigFunction(radians) */
export function getRatio(fn: TrigFunction, radians: number): Ratio {
  switch (fn) {
    case TrigFunction.Sine:
      return { value: Math.sin(radians), isUndefined: false };
    case TrigFunction.Cosine:
      return { value: Math.cos(radians), isUndefined: false };
    case TrigFunction.Tangent:
      return fromDenominator(Math.sin(radians), Math.cos(radians));
    case TrigFunction.Cotangent:
      return fromDenominator(Math.cos(radians), Math.sin(radians));
    case TrigFunction.Secant:
      return fromDenominator(1, Math.cos(radians));
    case TrigFunction.Cosecant:
      return fromDenominator(1, Math.sin(radians));
  }
}

export interface ArcResult {
  radians: number;
  ok: boolean;
}

function arcSine(ratio: number): number {
  if (ratio === 1) return PI / 2;
  if (ratio === -1) return -PI / 2;
  return Math.atan(ratio / Math.sqrt(-ratio * ratio + 1));
}

function arcCosine(ratio: number): number {
  if (ratio === 1) return 0;
  if (ratio === -1) return PI;
  return Math.atan(-ratio / Math.sqrt(-ratio * ratio + 1)) + PI / 2;
}

function arcTangent(ratio: number): number {
  return Math.atan(ratio);
}

function arcCotangent(ratio: number): number {
  return Math.atan(-ratio) + PI / 2;
}

function arcSecant(ratio: number): number {
  if (ratio === 1) return 0;
  if (ratio === -1) return PI;
  return PI / 2 - Math.atan(Math.sign(ratio) / Math.sqrt(ratio * ratio - 1));
}

function arcCosecant(ratio: number): number {
  if (ratio === 1) return PI / 2;
  if (ratio === -1) return -PI / 2;
  return Math.atan(Math.sign(ratio) / Math.sqrt(ratio * ratio - 1));
}

/** radians = InverseTrigFunction(ratio) */
export function getRadians(fn: TrigFunction, ratio: number): ArcResult {
  switch (fn) {
    case TrigFunction.Sine:
    case TrigFunction.Cosine:
      if (ratio < -1 || ratio > 1) return { radians: NaN, ok: false };
      break;
    case TrigFunction.Secant:
    case TrigFunction.Cosecant:
      if (ratio > -1 && ratio < 1) return { radians: NaN, ok: false };
      break;
  }
  let radians: number;
  switch (fn) {
    case TrigFunction.Sine:
      radians = arcSine(ratio);
      break;
    case TrigFunction.Cosine:
      radians = arcCosine(ratio);
      break;
    case TrigFunction.Tangent:
      radians = arcTangent(ratio);
      break;
    case TrigFunction.Cotangent:
      radians = arcCotangent(ratio);
      break;
    case TrigFunction.Secant:
      radians = arcSecant(ratio);
      break;
    case TrigFunction.Cosecant:
      radians = arcCosecant(ratio);
      break;
  }
  return { radians, ok: Number.isFinite(radians) };
}

/** Principal-value domain (in radians) of the selected inverse trig function. */
export function getInverseFunctionRange(fn: TrigFunction): { lower: number; upper: number } {
  switch (fn) {
    case TrigFunction.Sine:
      return { lower: -PI / 2, upper: PI / 2 };
    case TrigFunction.Cosine:
      return { lower: 0, upper: PI };
    case TrigFunction.Tangent:
      return { lower: -PI / 2, upper: PI / 2 };
    case TrigFunction.Cotangent:
      return { lower: 0, upper: PI };
    case TrigFunction.Secant:
      return { lower: 0, upper: PI };
    case TrigFunction.Cosecant:
      return { lower: -PI / 2, upper: PI / 2 };
  }
}

/** true if the function has a vertical asymptote in the middle of its usual graphed range */
export function periodLength(fn: TrigFunction): number {
  switch (fn) {
    case TrigFunction.Tangent:
    case TrigFunction.Cotangent:
      return PI;
    default:
      return TWO_PI;
  }
}

/** Where the standard function is undefined, as angles in degrees: odd
 *  multiples of 90 for tangent and secant, multiples of 180 for cotangent and
 *  cosecant, and nowhere at all for sine and cosine. Null means no asymptotes.
 *
 *  Given as angles rather than positions on an axis because they are both: in
 *  standard mode the angle is the x-axis and these are vertical asymptotes, in
 *  arc mode it is the y-axis and the very same angles are the horizontal limits
 *  the arc curve runs up against. */
export function asymptoteAngles(fn: TrigFunction): { offset: number; period: number } | null {
  switch (fn) {
    case TrigFunction.Tangent:
    case TrigFunction.Secant:
      return { offset: 90, period: 180 };
    case TrigFunction.Cotangent:
    case TrigFunction.Cosecant:
      return { offset: 0, period: 180 };
    default:
      return null;
  }
}

/** Pulls a ratio onto the arc function's domain, so a click past the end of
 *  the curve lands on its endpoint instead of nowhere at all. Arctangent and
 *  arccotangent accept everything, so they pass straight through. */
export function clampToArcDomain(fn: TrigFunction, ratio: number): number {
  switch (fn) {
    case TrigFunction.Sine:
    case TrigFunction.Cosine:
      return Math.min(1, Math.max(-1, ratio));
    case TrigFunction.Secant:
    case TrigFunction.Cosecant:
      // the domain is |ratio| >= 1, so the gap in the middle snaps outward to
      // whichever end of it is nearer
      if (ratio > -1 && ratio < 1) return ratio < 0 ? -1 : 1;
      return ratio;
    default:
      return ratio;
  }
}

/** The slope of the plotted curve at a point: dy/dx in whatever units the axes
 *  are showing. Worked out from the derivative rather than sampled either side
 *  of the point, because the interesting cases are exactly where sampling
 *  fails - at the ends of arcsine and friends the tangent is vertical, and a
 *  finite difference there returns a large arbitrary number or NaN.
 *
 *  Returns +/-Infinity for a vertical tangent and NaN where the function is
 *  undefined; callers should check before drawing a line through it. */
export function slopeAt(fn: TrigFunction, inverse: boolean, mode: AngleMode, x: number): number {
  let d = NaN;
  if (!inverse) {
    // x is the angle, y the ratio
    const t = mode === AngleMode.Degrees ? (x * PI) / 180 : x;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    switch (fn) {
      case TrigFunction.Sine:
        d = cos;
        break;
      case TrigFunction.Cosine:
        d = -sin;
        break;
      case TrigFunction.Tangent:
        d = 1 / (cos * cos);
        break;
      case TrigFunction.Cotangent:
        d = -1 / (sin * sin);
        break;
      case TrigFunction.Secant:
        d = sin / (cos * cos);
        break;
      case TrigFunction.Cosecant:
        d = -cos / (sin * sin);
        break;
    }
    // a degree of angle is PI/180 of the radians the derivative assumes
    return mode === AngleMode.Degrees ? (d * PI) / 180 : d;
  }

  // x is the ratio, y the angle
  switch (fn) {
    case TrigFunction.Sine:
      d = 1 / Math.sqrt(1 - x * x);
      break;
    case TrigFunction.Cosine:
      d = -1 / Math.sqrt(1 - x * x);
      break;
    case TrigFunction.Tangent:
      d = 1 / (1 + x * x);
      break;
    case TrigFunction.Cotangent:
      d = -1 / (1 + x * x);
      break;
    case TrigFunction.Secant:
      d = 1 / (Math.abs(x) * Math.sqrt(x * x - 1));
      break;
    case TrigFunction.Cosecant:
      d = -1 / (Math.abs(x) * Math.sqrt(x * x - 1));
      break;
  }
  return mode === AngleMode.Degrees ? (d * 180) / PI : d;
}
