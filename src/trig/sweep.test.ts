import { describe, expect, it } from 'vitest';
import { sweepSegments, wholeDegreeSweep } from './sweep';
import { AngleMode, PI, TrigFunction } from './trigMath';

describe('sweepSegments', () => {
  it('runs straight across the window for the standard functions', () => {
    const s = sweepSegments({ fn: TrigFunction.Sine, inverseMode: false, angleMode: AngleMode.Degrees, xMin: -540, xMax: 540 });
    expect(s).toEqual([{ start: -540, end: 540 }]);
  });

  it('turns a window in radians into degrees, landing on whole ones', () => {
    const s = sweepSegments({ fn: TrigFunction.Sine, inverseMode: false, angleMode: AngleMode.Radians, xMin: -3 * PI, xMax: 3 * PI });
    expect(s).toEqual([{ start: -540, end: 540 }]);
  });

  it('turns arcsine through its whole range, clamped to its domain', () => {
    const s = sweepSegments({ fn: TrigFunction.Sine, inverseMode: true, angleMode: AngleMode.Degrees, xMin: -1.5, xMax: 1.5 });
    expect(s).toEqual([{ start: -90, end: 90 }]);
  });

  it('runs arccosine downhill, left to right across the graph', () => {
    const s = sweepSegments({ fn: TrigFunction.Cosine, inverseMode: true, angleMode: AngleMode.Degrees, xMin: -1, xMax: 1 });
    expect(s).toEqual([{ start: 180, end: 0 }]);
  });

  it('jumps the gap in arcsecant, one stretch per side of it', () => {
    const s = sweepSegments({ fn: TrigFunction.Secant, inverseMode: true, angleMode: AngleMode.Degrees, xMin: -20, xMax: 20 });
    expect(s).toHaveLength(2);
    expect(s[0].end).toBe(180); // ratio -1
    expect(s[1].start).toBe(0); // ratio 1
  });

  it('has nothing to sweep for a window wholly inside the gap', () => {
    const s = sweepSegments({ fn: TrigFunction.Cosecant, inverseMode: true, angleMode: AngleMode.Degrees, xMin: -0.5, xMax: 0.5 });
    expect(wholeDegreeSweep(s).length).toBe(0);
  });
});

describe('wholeDegreeSweep', () => {
  it('runs edge to edge, ending exactly on the last degree', () => {
    const sweep = wholeDegreeSweep([{ start: -540, end: 540 }]);
    expect(sweep.length).toBe(1080);
    expect(sweep.angleAt(0)).toBe(-540);
    expect(sweep.angleAt(1080)).toBe(540);
  });

  it('lands anywhere in between, for a frame to draw', () => {
    const sweep = wholeDegreeSweep([{ start: -540, end: 540 }]);
    expect(sweep.angleAt(569.6)).toBeCloseTo(29.6, 9);
  });

  it('starts and ends on the whole degrees inside the window', () => {
    const sweep = wholeDegreeSweep([{ start: -537.4, end: 12.6 }]);
    expect(sweep.angleAt(0)).toBe(-537);
    expect(sweep.angleAt(sweep.length)).toBe(12);
  });

  it('walks each stretch the way it runs, and carries on into the next', () => {
    // arcsecant from a ratio of -20 to 20: up to 180, then across the gap
    const sweep = wholeDegreeSweep([
      { start: 92.87, end: 180 },
      { start: 0, end: 87.13 },
    ]);
    expect(sweep.angleAt(0)).toBe(93);
    expect(sweep.angleAt(87)).toBe(180);
    expect(sweep.angleAt(87.5)).toBe(0.5);
    expect(sweep.angleAt(sweep.length)).toBe(87);
  });

  it('runs downhill as well as up', () => {
    const sweep = wholeDegreeSweep([{ start: 180, end: 0 }]);
    expect(sweep.length).toBe(180);
    expect(sweep.angleAt(45.5)).toBe(134.5);
  });

  it('holds at the ends rather than running past them', () => {
    const sweep = wholeDegreeSweep([{ start: 0, end: 10 }]);
    expect(sweep.angleAt(-5)).toBe(0);
    expect(sweep.angleAt(50)).toBe(10);
  });
});
