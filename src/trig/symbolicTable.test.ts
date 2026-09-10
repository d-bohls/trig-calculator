// The exact values are hand-written data, so nothing but arithmetic can tell
// you a sign is wrong. Every entry is parsed back into a number here and
// compared against the function it claims to be.

import { describe, expect, it } from 'vitest';
import { lookupSymbolic, symbolicForFunction, SYMBOLIC_TABLE, symbolicRadians } from './symbolicTable';
import { getRatio, PI, TrigFunction } from './trigMath';

/** "2√3/3" -> 1.1547..., "(√6-√2)/4" -> 0.2588... */
function evaluate(expression: string): number {
  const js = expression.replace(/(\d)√/g, '$1*√').replace(/√(\d+)/g, 'Math.sqrt($1)');
  return Function(`"use strict"; return (${js});`)() as number;
}

/** "19π/3" -> 19.896..., "0" -> 0 */
function evaluatePi(expression: string): number {
  const js = expression.replace(/(\d)π/g, '$1*π').replace(/π/g, 'Math.PI');
  return Function(`"use strict"; return (${js});`)() as number;
}

const KEYS = [
  ['sin', TrigFunction.Sine],
  ['cos', TrigFunction.Cosine],
  ['tan', TrigFunction.Tangent],
  ['cot', TrigFunction.Cotangent],
  ['sec', TrigFunction.Secant],
  ['csc', TrigFunction.Cosecant],
] as const;

describe('the exact value table', () => {
  it('covers every 15 degree step once, from 0 to 345', () => {
    expect(SYMBOLIC_TABLE.map((e) => e.degrees)).toEqual(
      Array.from({ length: 24 }, (_, i) => i * 15),
    );
  });

  it('states the true value of every function at every special angle', () => {
    let checked = 0;
    for (const entry of SYMBOLIC_TABLE) {
      const radians = (entry.degrees * PI) / 180;
      for (const [key, fn] of KEYS) {
        const written = entry[key];
        const actual = getRatio(fn, radians);
        if (written === 'undefined') {
          expect(actual.isUndefined, `${key} at ${entry.degrees}deg`).toBe(true);
        } else {
          expect(actual.isUndefined, `${key} at ${entry.degrees}deg`).toBe(false);
          expect(evaluate(written), `${key} at ${entry.degrees}deg is "${written}"`).toBeCloseTo(
            actual.value,
            9,
          );
        }
        checked += 1;
      }
    }
    expect(checked).toBe(144);
  });

  it('names the radians of each angle correctly, whichever turn it is on', () => {
    for (let degrees = -720; degrees <= 1440; degrees += 15) {
      const label = symbolicRadians(degrees);
      expect(label, `${degrees} degrees`).not.toBeNull();
      expect(evaluatePi(label as string), `${degrees} degrees is "${label}"`).toBeCloseTo(
        (degrees * PI) / 180,
        9,
      );
    }
  });

  it('has no name for an angle off the 15 degree steps', () => {
    for (const degrees of [1, 7, 37, 44, 91, -23, 30.5]) {
      expect(symbolicRadians(degrees)).toBeNull();
    }
  });
});

describe('lookupSymbolic', () => {
  it('finds the same entry for every coterminal angle', () => {
    for (const degrees of [30, 390, 750, -330, -690]) {
      expect(lookupSymbolic(degrees)?.degrees).toBe(30);
    }
  });

  it('returns nothing between the special angles', () => {
    for (const degrees of [1, 29, 31, 44, 100.5]) {
      expect(lookupSymbolic(degrees)).toBeNull();
    }
  });
});

describe('symbolicForFunction', () => {
  it('gives the entry’s value for the function asked for', () => {
    const entry = lookupSymbolic(30);
    expect(symbolicForFunction(entry, TrigFunction.Sine)).toBe('1/2');
    expect(symbolicForFunction(entry, TrigFunction.Cosecant)).toBe('2');
    expect(symbolicForFunction(null, TrigFunction.Sine)).toBeNull();
  });
});
