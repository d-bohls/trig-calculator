import { describe, expect, it } from 'vitest';
import { defaultGraphWindow, GraphKind, graphKindOf } from './persistence';
import { AngleMode, PI, TrigFunction } from '../trig/trigMath';

describe('graphKindOf', () => {
  it('separates the three pictures the graph can be', () => {
    expect(graphKindOf(false, TrigFunction.Sine)).toBe(GraphKind.Standard);
    expect(graphKindOf(false, TrigFunction.Tangent)).toBe(GraphKind.Standard);
    // arcsine and arccosine take a ratio confined to [-1, 1]
    expect(graphKindOf(true, TrigFunction.Sine)).toBe(GraphKind.ArcBounded);
    expect(graphKindOf(true, TrigFunction.Cosine)).toBe(GraphKind.ArcBounded);
    // the other four take any ratio at all
    for (const fn of [
      TrigFunction.Tangent,
      TrigFunction.Cotangent,
      TrigFunction.Secant,
      TrigFunction.Cosecant,
    ]) {
      expect(graphKindOf(true, fn)).toBe(GraphKind.ArcUnbounded);
    }
  });
});

describe('defaultGraphWindow', () => {
  it('puts the angle on x for the standard functions and y for the arc ones', () => {
    const standard = defaultGraphWindow(GraphKind.Standard, AngleMode.Degrees);
    expect([standard.xMin, standard.xMax]).toEqual([-540, 540]);
    expect([standard.yMin, standard.yMax]).toEqual([-10, 10]);

    const arc = defaultGraphWindow(GraphKind.ArcBounded, AngleMode.Degrees);
    expect([arc.xMin, arc.xMax]).toEqual([-1.5, 1.5]);
    expect([arc.yMin, arc.yMax]).toEqual([-105, 195]);
  });

  it('converts only the angle axis when radians are showing', () => {
    const standard = defaultGraphWindow(GraphKind.Standard, AngleMode.Radians);
    expect(standard.xMax).toBeCloseTo((540 * PI) / 180, 12);
    expect(standard.yMax).toBe(10); // the ratio axis has no unit to convert

    const arc = defaultGraphWindow(GraphKind.ArcUnbounded, AngleMode.Radians);
    expect(arc.xMax).toBe(20); // the ratio axis, unchanged
    expect(arc.yMax).toBeCloseTo((195 * PI) / 180, 12);
  });

  it('gives the unbounded arc group room to show its asymptotes', () => {
    const w = defaultGraphWindow(GraphKind.ArcUnbounded, AngleMode.Degrees);
    expect([w.xMin, w.xMax]).toEqual([-20, 20]);
  });
});
