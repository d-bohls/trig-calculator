// Exact symbolic values of the six trig functions at the "special angles"
// (multiples of 15 degrees). The original VB6 app (Forms/frmSymbolic.frm)
// had this feature stubbed out - every case in its Select block was empty,
// so it always fell through to "N/A". This table fills in the real values.

import { TrigFunction } from './trigMath';

export interface SymbolicEntry {
  degrees: number;
  radiansLabel: string;
  sin: string;
  cos: string;
  tan: string;
  cot: string;
  sec: string;
  csc: string;
}

const U = 'undefined';

// the 15-degree family (15, 75 and their reflections) needs the half-angle
// forms, which are longer than anything in the 30/45 family. Named here so
// each row below stays readable and the signs are easy to check by eye.
const A = '(√6-√2)/4'; // sin 15
const nA = '-(√6-√2)/4';
const B = '(√6+√2)/4'; // cos 15
const nB = '-(√6+√2)/4';
const T = '2-√3'; // tan 15
const nT = '-(2-√3)';
const C = '2+√3'; // cot 15
const nC = '-(2+√3)';
const S = '√6-√2'; // sec 15
const nS = '-(√6-√2)';
const K = '√6+√2'; // csc 15
const nK = '-(√6+√2)';

export const SYMBOLIC_TABLE: SymbolicEntry[] = [
  { degrees: 0, radiansLabel: '0', sin: '0', cos: '1', tan: '0', cot: U, sec: '1', csc: U },
  { degrees: 15, radiansLabel: 'π/12', sin: A, cos: B, tan: T, cot: C, sec: S, csc: K },
  { degrees: 30, radiansLabel: 'π/6', sin: '1/2', cos: '√3/2', tan: '√3/3', cot: '√3', sec: '2√3/3', csc: '2' },
  { degrees: 45, radiansLabel: 'π/4', sin: '√2/2', cos: '√2/2', tan: '1', cot: '1', sec: '√2', csc: '√2' },
  { degrees: 60, radiansLabel: 'π/3', sin: '√3/2', cos: '1/2', tan: '√3', cot: '√3/3', sec: '2', csc: '2√3/3' },
  { degrees: 75, radiansLabel: '5π/12', sin: B, cos: A, tan: C, cot: T, sec: K, csc: S },
  { degrees: 90, radiansLabel: 'π/2', sin: '1', cos: '0', tan: U, cot: '0', sec: U, csc: '1' },
  { degrees: 105, radiansLabel: '7π/12', sin: B, cos: nA, tan: nC, cot: nT, sec: nK, csc: S },
  { degrees: 120, radiansLabel: '2π/3', sin: '√3/2', cos: '-1/2', tan: '-√3', cot: '-√3/3', sec: '-2', csc: '2√3/3' },
  { degrees: 135, radiansLabel: '3π/4', sin: '√2/2', cos: '-√2/2', tan: '-1', cot: '-1', sec: '-√2', csc: '√2' },
  { degrees: 150, radiansLabel: '5π/6', sin: '1/2', cos: '-√3/2', tan: '-√3/3', cot: '-√3', sec: '-2√3/3', csc: '2' },
  { degrees: 165, radiansLabel: '11π/12', sin: A, cos: nB, tan: nT, cot: nC, sec: nS, csc: K },
  { degrees: 180, radiansLabel: 'π', sin: '0', cos: '-1', tan: '0', cot: U, sec: '-1', csc: U },
  { degrees: 195, radiansLabel: '13π/12', sin: nA, cos: nB, tan: T, cot: C, sec: nS, csc: nK },
  { degrees: 210, radiansLabel: '7π/6', sin: '-1/2', cos: '-√3/2', tan: '√3/3', cot: '√3', sec: '-2√3/3', csc: '-2' },
  { degrees: 225, radiansLabel: '5π/4', sin: '-√2/2', cos: '-√2/2', tan: '1', cot: '1', sec: '-√2', csc: '-√2' },
  { degrees: 240, radiansLabel: '4π/3', sin: '-√3/2', cos: '-1/2', tan: '√3', cot: '√3/3', sec: '-2', csc: '-2√3/3' },
  { degrees: 255, radiansLabel: '17π/12', sin: nB, cos: nA, tan: C, cot: T, sec: nK, csc: nS },
  { degrees: 270, radiansLabel: '3π/2', sin: '-1', cos: '0', tan: U, cot: '0', sec: U, csc: '-1' },
  { degrees: 285, radiansLabel: '19π/12', sin: nB, cos: A, tan: nC, cot: nT, sec: K, csc: nS },
  { degrees: 300, radiansLabel: '5π/3', sin: '-√3/2', cos: '1/2', tan: '-√3', cot: '-√3/3', sec: '2', csc: '-2√3/3' },
  { degrees: 315, radiansLabel: '7π/4', sin: '-√2/2', cos: '√2/2', tan: '-1', cot: '-1', sec: '√2', csc: '-√2' },
  { degrees: 330, radiansLabel: '11π/6', sin: '-1/2', cos: '√3/2', tan: '-√3/3', cot: '-√3', sec: '2√3/3', csc: '-2' },
  { degrees: 345, radiansLabel: '23π/12', sin: nA, cos: B, tan: nT, cot: nC, sec: S, csc: nK },
];

/** Looks up the exact symbolic values for the given angle in degrees, if it lands on a 15-degree step. */
export function lookupSymbolic(degrees: number): SymbolicEntry | null {
  const rounded = Math.round(degrees * 1e6) / 1e6;
  if (Math.abs(rounded % 15) > 1e-6 && Math.abs((rounded % 15) - 15) > 1e-6) {
    return null;
  }
  let normalized = Math.round(rounded) % 360;
  if (normalized < 0) normalized += 360;
  return SYMBOLIC_TABLE.find((e) => e.degrees === normalized) ?? null;
}

const KEY_BY_FUNCTION: Record<TrigFunction, 'sin' | 'cos' | 'tan' | 'cot' | 'sec' | 'csc'> = {
  [TrigFunction.Sine]: 'sin',
  [TrigFunction.Cosine]: 'cos',
  [TrigFunction.Tangent]: 'tan',
  [TrigFunction.Cotangent]: 'cot',
  [TrigFunction.Secant]: 'sec',
  [TrigFunction.Cosecant]: 'csc',
};

/** The exact value for one function at this angle, or null when the angle
 *  isn't a special one. Plain values like "1" and "undefined" are shown along
 *  with the radicals: they say nothing the decimal field doesn't, but a column
 *  that's filled in for every special angle beats one with holes in it. */
export function symbolicForFunction(entry: SymbolicEntry | null, fn: TrigFunction): string | null {
  if (!entry) return null;
  return entry[KEY_BY_FUNCTION[fn]];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** The angle itself as an exact multiple of pi - 60 gives "π/3", 1140 gives
 *  "19π/3", -60 gives "-π/3". Derived from the angle rather than looked up in
 *  the table, because the table is keyed on the angle reduced to 0-360: the
 *  trig values there are the same for every coterminal angle, but the angle's
 *  own name is not. Null for anything off the 15-degree steps. */
export function symbolicRadians(degrees: number): string | null {
  if (!Number.isInteger(degrees) || degrees % 15 !== 0) return null;
  if (degrees === 0) return '0';
  const sign = degrees < 0 ? '-' : '';
  const divisor = gcd(Math.abs(degrees), 180);
  const numerator = Math.abs(degrees) / divisor;
  const denominator = 180 / divisor;
  const top = numerator === 1 ? 'π' : `${numerator}π`;
  return denominator === 1 ? `${sign}${top}` : `${sign}${top}/${denominator}`;
}
