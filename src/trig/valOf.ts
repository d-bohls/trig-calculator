/** Loosely mirrors VB's Val(): parse the leading numeric portion, default 0. */
export function valOf(text: string): number {
  const match = text.trim().match(/^[+-]?\d*\.?\d+(e[+-]?\d+)?/i);
  if (!match) return 0;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) ? n : 0;
}
