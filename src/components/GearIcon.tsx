/** Builds an N-tooth gear outline as alternating outer/inner radius points,
 *  computed rather than hand-typed so the shape is easy to verify by eye. */
function gearOutline(cx: number, cy: number, outerR: number, innerR: number, teeth: number): string {
  const step = Math.PI / teeth;
  const points: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

function circleOutline(cx: number, cy: number, r: number): string {
  return `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
}

export default function GearIcon() {
  // fewer, deeper teeth than a "realistic" gear so the shape still reads
  // clearly at the small size this renders at (an accurate gear's fine
  // teeth just blur into a circle at 18-20px)
  const d = `${gearOutline(12, 12, 11, 6.5, 6)} ${circleOutline(12, 12, 4)}`;
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d={d} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
