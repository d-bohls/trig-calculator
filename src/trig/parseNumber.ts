/** A number the user typed, or null if what they typed isn't one.
 *
 *  The original leaned on VB's Val(), which reads the leading numeric portion
 *  and defaults to zero: "abc" became 0 and silently set the angle there, and
 *  "12abc" became 12. Taking half of what someone typed, or none of it, and
 *  acting as though they meant it is worse than declining. Null lets the caller
 *  leave the value alone, and the field snaps back to what it was. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}
