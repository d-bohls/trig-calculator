import { describe, expect, it } from 'vitest';
import { parseNumber } from './parseNumber';

describe('parseNumber', () => {
  it('takes a number in the forms people actually type', () => {
    expect(parseNumber('30')).toBe(30);
    expect(parseNumber('-7.5')).toBe(-7.5);
    expect(parseNumber('  42  ')).toBe(42);
    expect(parseNumber('+5')).toBe(5);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('5.')).toBe(5);
    expect(parseNumber('1e3')).toBe(1000);
    expect(parseNumber('0')).toBe(0);
  });

  it('declines anything that is not a number, rather than guessing at one', () => {
    // the VB6 original read the leading portion and defaulted to zero, so
    // "abc" silently set the angle to 0 and "12abc" set it to 12
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('12abc')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('   ')).toBeNull();
    expect(parseNumber('-')).toBeNull();
    expect(parseNumber('undefined')).toBeNull();
    expect(parseNumber('Infinity')).toBeNull();
    expect(parseNumber('NaN')).toBeNull();
  });
});
