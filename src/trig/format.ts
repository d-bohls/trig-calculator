// Shared display formatting for angles, used by both the Functions panel and
// the circle's readout so the two never disagree about how an angle reads.

import { symbolicRadians } from './symbolicTable';
import { AngleMode, PI } from './trigMath';

/** An angle as it should read in the current unit: the exact multiple of pi
 *  when we have one, otherwise the decimal. Degrees carry the degree sign,
 *  since a bare "30.00" inside Sin(...) doesn't say which unit it's in. */
export function displayAngle(degrees: number, angleMode: AngleMode, places: number): string {
  if (angleMode === AngleMode.Degrees) return `${degrees.toFixed(places)}°`;
  return symbolicRadians(degrees) ?? ((degrees * PI) / 180).toFixed(places);
}
