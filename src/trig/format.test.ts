import { describe, expect, it } from 'vitest';
import { displayAngle, formatNumber } from './format';
import { AngleMode, PI } from './trigMath';

describe('formatNumber', () => {
  it('never returns a negative zero', () => {
    // sine of 180 degrees is -1.2e-16, which toFixed renders as "-0.0000"
    expect(formatNumber(Math.sin(PI), 4)).toBe('0.0000');
    expect(formatNumber(-0, 4)).toBe('0.0000');
    expect(formatNumber(-1e-9, 4)).toBe('0.0000');
    expect(formatNumber(-0.00004, 4)).toBe('0.0000');
  });

  it('leaves every other value to toFixed', () => {
    expect(formatNumber(0.5, 4)).toBe('0.5000');
    expect(formatNumber(-0.5, 4)).toBe('-0.5000');
    expect(formatNumber(-1, 4)).toBe('-1.0000');
    expect(formatNumber(-0.00006, 4)).toBe('-0.0001');
    expect(formatNumber(2, 0)).toBe('2');
  });
});

describe('displayAngle', () => {
  it('marks degrees with the degree sign', () => {
    expect(displayAngle(30, AngleMode.Degrees, 2)).toBe('30.00°');
    expect(displayAngle(-7.5, AngleMode.Degrees, 1)).toBe('-7.5°');
  });

  it('prefers the exact multiple of pi in radians', () => {
    expect(displayAngle(30, AngleMode.Radians, 2)).toBe('π/6');
    expect(displayAngle(-60, AngleMode.Radians, 2)).toBe('-π/3');
    expect(displayAngle(1140, AngleMode.Radians, 2)).toBe('19π/3');
  });

  it('falls back to the decimal off the special angles', () => {
    expect(displayAngle(37, AngleMode.Radians, 2)).toBe(((37 * PI) / 180).toFixed(2));
  });
});
