// The identities and edge cases the graph and the readout depend on. These are
// the places where a wrong answer is quiet: a curve drawn through an asymptote,
// or a tangent line at an angle nobody happens to look at.

import { describe, expect, it } from 'vitest';
import {
  AngleMode,
  asymptoteAngles,
  clampToArcDomain,
  getInverseFunctionRange,
  getRadians,
  getRatio,
  periodLength,
  PI,
  slopeAt,
  TrigFunction,
} from './trigMath';

const ALL = [
  TrigFunction.Sine,
  TrigFunction.Cosine,
  TrigFunction.Tangent,
  TrigFunction.Cotangent,
  TrigFunction.Secant,
  TrigFunction.Cosecant,
];

const rad = (degrees: number) => (degrees * PI) / 180;

describe('getRatio', () => {
  it('gives the textbook values at 30, 45 and 60 degrees', () => {
    expect(getRatio(TrigFunction.Sine, rad(30)).value).toBeCloseTo(0.5, 12);
    expect(getRatio(TrigFunction.Cosine, rad(60)).value).toBeCloseTo(0.5, 12);
    expect(getRatio(TrigFunction.Tangent, rad(45)).value).toBeCloseTo(1, 12);
    expect(getRatio(TrigFunction.Cotangent, rad(45)).value).toBeCloseTo(1, 12);
    expect(getRatio(TrigFunction.Secant, rad(60)).value).toBeCloseTo(2, 12);
    expect(getRatio(TrigFunction.Cosecant, rad(30)).value).toBeCloseTo(2, 12);
  });

  it.each([
    ['tangent', TrigFunction.Tangent, [90, 270, -90, 450]],
    ['secant', TrigFunction.Secant, [90, 270, -90, 450]],
    ['cotangent', TrigFunction.Cotangent, [0, 180, 360, -180]],
    ['cosecant', TrigFunction.Cosecant, [0, 180, 360, -180]],
  ])('marks %s undefined exactly at its asymptotes', (_name, fn, degrees) => {
    for (const d of degrees) expect(getRatio(fn, rad(d)).isUndefined).toBe(true);
    // and defined a degree either side, so the test isn't passing by accident
    for (const d of degrees) {
      expect(getRatio(fn, rad(d - 1)).isUndefined).toBe(false);
      expect(getRatio(fn, rad(d + 1)).isUndefined).toBe(false);
    }
  });

  it('never reports sine or cosine as undefined', () => {
    for (let d = -720; d <= 720; d += 1) {
      expect(getRatio(TrigFunction.Sine, rad(d)).isUndefined).toBe(false);
      expect(getRatio(TrigFunction.Cosine, rad(d)).isUndefined).toBe(false);
    }
  });
});

describe('getRadians', () => {
  it('rejects ratios outside each function’s domain', () => {
    expect(getRadians(TrigFunction.Sine, 1.5).ok).toBe(false);
    expect(getRadians(TrigFunction.Cosine, -1.5).ok).toBe(false);
    expect(getRadians(TrigFunction.Secant, 0.5).ok).toBe(false);
    expect(getRadians(TrigFunction.Cosecant, -0.5).ok).toBe(false);
    // tangent and cotangent take anything
    expect(getRadians(TrigFunction.Tangent, 1e6).ok).toBe(true);
    expect(getRadians(TrigFunction.Cotangent, -1e6).ok).toBe(true);
  });

  it('accepts the domain edges themselves, which is where the curve ends', () => {
    for (const fn of [TrigFunction.Sine, TrigFunction.Cosine, TrigFunction.Secant, TrigFunction.Cosecant]) {
      for (const edge of [-1, 1]) {
        const { ok, radians } = getRadians(fn, edge);
        expect(ok).toBe(true);
        expect(Number.isFinite(radians)).toBe(true);
      }
    }
  });

  it('returns an angle inside the principal range', () => {
    for (const fn of ALL) {
      const { lower, upper } = getInverseFunctionRange(fn);
      for (const ratio of [-8, -1, -0.3, 0.3, 1, 8]) {
        const { radians, ok } = getRadians(fn, ratio);
        if (!ok) continue;
        expect(radians).toBeGreaterThanOrEqual(lower - 1e-12);
        expect(radians).toBeLessThanOrEqual(upper + 1e-12);
      }
    }
  });
});

describe('clampToArcDomain', () => {
  it('pulls a ratio onto the domain so a click past the curve lands on its end', () => {
    expect(clampToArcDomain(TrigFunction.Sine, -4)).toBe(-1);
    expect(clampToArcDomain(TrigFunction.Cosine, 4)).toBe(1);
    expect(clampToArcDomain(TrigFunction.Sine, 0.25)).toBe(0.25);
  });

  it('snaps out of the gap secant and cosecant leave in the middle', () => {
    expect(clampToArcDomain(TrigFunction.Secant, -0.4)).toBe(-1);
    expect(clampToArcDomain(TrigFunction.Secant, 0.4)).toBe(1);
    expect(clampToArcDomain(TrigFunction.Cosecant, 0)).toBe(1);
    expect(clampToArcDomain(TrigFunction.Cosecant, -3)).toBe(-3);
  });

  it('leaves tangent and cotangent alone, which accept everything', () => {
    expect(clampToArcDomain(TrigFunction.Tangent, -99)).toBe(-99);
    expect(clampToArcDomain(TrigFunction.Cotangent, 99)).toBe(99);
  });
});

describe('slopeAt', () => {
  // the derivative is what the tangent line is drawn from, so check it against
  // a central difference rather than against itself
  const numeric = (fn: TrigFunction, inverse: boolean, mode: AngleMode, x: number, h: number) => {
    const at = (v: number) => {
      if (!inverse) return getRatio(fn, mode === AngleMode.Degrees ? rad(v) : v).value;
      const { radians } = getRadians(fn, v);
      return mode === AngleMode.Degrees ? (radians * 180) / PI : radians;
    };
    return (at(x + h) - at(x - h)) / (2 * h);
  };

  it('matches a central difference for every standard function', () => {
    for (const fn of ALL) {
      for (const d of [10, 37, 80, 100, 143, 200, 250, 310, -47]) {
        const exact = slopeAt(fn, false, AngleMode.Degrees, d);
        const approx = numeric(fn, false, AngleMode.Degrees, d, 1e-3);
        expect(exact).toBeCloseTo(approx, 5);
      }
    }
  });

  it('matches a central difference for every arc function', () => {
    const samples: Record<number, number[]> = {
      [TrigFunction.Sine]: [-0.9, -0.3, 0.2, 0.8],
      [TrigFunction.Cosine]: [-0.9, -0.3, 0.2, 0.8],
      [TrigFunction.Tangent]: [-3, -0.7, 0, 0.5, 4],
      [TrigFunction.Cotangent]: [-3, -0.7, 0, 0.5, 4],
      [TrigFunction.Secant]: [-6, -1.4, 1.4, 6],
      [TrigFunction.Cosecant]: [-6, -1.4, 1.4, 6],
    };
    for (const fn of ALL) {
      for (const x of samples[fn]) {
        const exact = slopeAt(fn, true, AngleMode.Radians, x);
        const approx = numeric(fn, true, AngleMode.Radians, x, 1e-6);
        expect(exact).toBeCloseTo(approx, 4);
      }
    }
  });

  it('is infinite where the arc curve turns vertical, so the caller draws a vertical line', () => {
    for (const fn of [TrigFunction.Sine, TrigFunction.Cosine, TrigFunction.Secant, TrigFunction.Cosecant]) {
      for (const edge of [-1, 1]) {
        expect(Number.isFinite(slopeAt(fn, true, AngleMode.Degrees, edge))).toBe(false);
      }
    }
  });

  it('scales with the unit on the angle axis', () => {
    const inDegrees = slopeAt(TrigFunction.Sine, false, AngleMode.Degrees, 30);
    const inRadians = slopeAt(TrigFunction.Sine, false, AngleMode.Radians, rad(30));
    expect(inDegrees).toBeCloseTo((inRadians * PI) / 180, 12);
  });
});

describe('asymptoteAngles', () => {
  it('places them where the function is actually undefined', () => {
    for (const fn of ALL) {
      const spec = asymptoteAngles(fn);
      if (!spec) {
        // sine and cosine have none, and are defined everywhere
        expect(getRatio(fn, rad(90)).isUndefined).toBe(false);
        continue;
      }
      for (let k = -4; k <= 4; k += 1) {
        const degrees = spec.offset + k * spec.period;
        expect(getRatio(fn, rad(degrees)).isUndefined).toBe(true);
      }
    }
  });
});

describe('periodLength', () => {
  it('repeats the function exactly, and is the shortest such gap', () => {
    for (const fn of ALL) {
      const p = periodLength(fn);
      for (const d of [17, 63, 128]) {
        const here = getRatio(fn, rad(d));
        const later = getRatio(fn, rad(d) + p);
        expect(later.value).toBeCloseTo(here.value, 9);
      }
      // half a period is not a period for any of them
      const half = getRatio(fn, rad(17) + p / 2).value;
      expect(Math.abs(half - getRatio(fn, rad(17)).value)).toBeGreaterThan(1e-6);
    }
  });
});
