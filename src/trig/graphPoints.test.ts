// The bug this guards against: a discontinuity is only ever found numerically,
// when a sample lands on it. Step over one and the two enormous values either
// side get joined by a line straight through the asymptote. Nothing in the
// output looks wrong; the picture does.

import { describe, expect, it } from 'vitest';
import { plotGraphPoints } from './graphPoints';
import { AngleMode, asymptoteAngles, getInverseFunctionRange, PI, TrigFunction } from './trigMath';

const DISCONTINUOUS = [
  TrigFunction.Tangent,
  TrigFunction.Cotangent,
  TrigFunction.Secant,
  TrigFunction.Cosecant,
];
const EDGED = [TrigFunction.Sine, TrigFunction.Cosine, TrigFunction.Secant, TrigFunction.Cosecant];

const WINDOWS: [number, number][] = [
  [-572.9577951308232, 572.9577951308232],
  [-360, 360],
  [-1000, 1000],
  [-45.5, 45.5],
  [0.25, 12.75],
  [-89.9, 90.1],
  [100, 640],
  [-7.5, 7.5],
];
const WIDTHS = [740, 300, 1024, 61];

/** An asymptote strictly between two sampled angles, or null. */
function crossedBetween(a: number, b: number, spec: { offset: number; period: number }) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const v = spec.offset + Math.ceil((lo - spec.offset) / spec.period) * spec.period;
  return v > lo && v < hi ? v : null;
}

describe('plotGraphPoints, standard functions', () => {
  it('never joins two points across an asymptote, in degrees', () => {
    let configs = 0;
    for (const fn of DISCONTINUOUS) {
      const spec = asymptoteAngles(fn)!;
      for (const [xMin, xMax] of WINDOWS) {
        for (const pixelWidth of WIDTHS) {
          const { points } = plotGraphPoints({
            fn,
            inverseMode: false,
            angleMode: AngleMode.Degrees,
            window: { xMin, xMax, yMin: -10, yMax: 10 },
            pixelWidth,
          });
          configs += 1;
          for (let i = 1; i < points.length; i += 1) {
            const p = points[i - 1];
            const q = points[i];
            if (p.isUndefined || q.isUndefined) continue;
            expect(crossedBetween(p.x, q.x, spec), `${fn} in [${xMin}, ${xMax}] at ${pixelWidth}px`).toBeNull();
          }
        }
      }
    }
    expect(configs).toBe(DISCONTINUOUS.length * WINDOWS.length * WIDTHS.length);
  });

  it('lands a sample exactly on every asymptote inside the window', () => {
    for (const fn of DISCONTINUOUS) {
      const spec = asymptoteAngles(fn)!;
      for (const [xMin, xMax] of WINDOWS) {
        for (const pixelWidth of WIDTHS) {
          const { points } = plotGraphPoints({
            fn,
            inverseMode: false,
            angleMode: AngleMode.Degrees,
            window: { xMin, xMax, yMin: -10, yMax: 10 },
            pixelWidth,
          });
          const first = Math.ceil((xMin - spec.offset) / spec.period);
          const last = Math.floor((xMax - spec.offset) / spec.period);
          for (let k = first; k <= last; k += 1) {
            const at = points.find((p) => p.x === spec.offset + k * spec.period);
            expect(at, `${fn} asymptote at ${spec.offset + k * spec.period}`).toBeDefined();
            expect(at!.isUndefined).toBe(true);
          }
        }
      }
    }
  });

  it('never joins two points across an asymptote, in radians', () => {
    for (const fn of DISCONTINUOUS) {
      const spec = asymptoteAngles(fn)!;
      for (const [xMin, xMax] of [[-10, 10], [-PI, PI], [0, 6.5], [-1.6, 1.6], [-100, 100]] as [number, number][]) {
        for (const pixelWidth of WIDTHS) {
          const { points } = plotGraphPoints({
            fn,
            inverseMode: false,
            angleMode: AngleMode.Radians,
            window: { xMin, xMax, yMin: -10, yMax: 10 },
            pixelWidth,
          });
          for (let i = 1; i < points.length; i += 1) {
            const p = points[i - 1];
            const q = points[i];
            if (p.isUndefined || q.isUndefined) continue;
            const inDegrees = (v: number) => (v * 180) / PI;
            expect(crossedBetween(inDegrees(p.x), inDegrees(q.x), spec)).toBeNull();
          }
        }
      }
    }
  });

  it('keeps every sample for the two continuous functions', () => {
    for (const fn of [TrigFunction.Sine, TrigFunction.Cosine]) {
      const { points } = plotGraphPoints({
        fn,
        inverseMode: false,
        angleMode: AngleMode.Degrees,
        window: { xMin: -360, xMax: 360, yMin: -2, yMax: 2 },
        pixelWidth: 740,
      });
      expect(points.length).toBeGreaterThan(700);
      expect(points.some((p) => p.isUndefined)).toBe(false);
    }
  });
});

describe('plotGraphPoints, arc functions', () => {
  it('samples the domain edge, so the branch reaches its endpoint', () => {
    for (const fn of EDGED) {
      for (const [xMin, xMax] of [[-4, 4], [-1.5, 1.5], [-2, 6], [-10, 10], [0.5, 3.25], [-1, 1]] as [
        number,
        number,
      ][]) {
        for (const pixelWidth of WIDTHS) {
          for (const angleMode of [AngleMode.Degrees, AngleMode.Radians]) {
            const { points } = plotGraphPoints({
              fn,
              inverseMode: true,
              angleMode,
              window: { xMin, xMax, yMin: -200, yMax: 200 },
              pixelWidth,
            });
            for (const edge of [-1, 1]) {
              if (edge < xMin || edge > xMax) continue;
              const at = points.find((p) => p.x === edge);
              expect(at, `arc ${fn} edge ${edge}`).toBeDefined();
              expect(at!.isUndefined).toBe(false);
              expect(Number.isFinite(at!.y)).toBe(true);
            }
          }
        }
      }
    }
  });

  it('reaches the ends of the principal range', () => {
    const { points } = plotGraphPoints({
      fn: TrigFunction.Sine,
      inverseMode: true,
      angleMode: AngleMode.Degrees,
      window: { xMin: -4, xMax: 4, yMin: -117, yMax: 117 },
      pixelWidth: 740,
    });
    const defined = points.filter((p) => !p.isUndefined);
    const { lower, upper } = getInverseFunctionRange(TrigFunction.Sine);
    expect(Math.min(...defined.map((p) => p.y))).toBeCloseTo((lower * 180) / PI, 9);
    expect(Math.max(...defined.map((p) => p.y))).toBeCloseTo((upper * 180) / PI, 9);
  });
});

describe('plotGraphPoints, degenerate windows', () => {
  it('returns nothing rather than looping for an unreadable span', () => {
    for (const [xMin, xMax] of [
      [-1e9, 1e9],
      [1e12, 1e12 + 1e-9],
      [-1e300, 1e300],
    ] as [number, number][]) {
      const started = Date.now();
      const { points } = plotGraphPoints({
        fn: TrigFunction.Tangent,
        inverseMode: false,
        angleMode: AngleMode.Degrees,
        window: { xMin, xMax, yMin: -10, yMax: 10 },
        pixelWidth: 740,
      });
      expect(points).toHaveLength(0);
      expect(Date.now() - started).toBeLessThan(1000);
    }
  });
});
