// Port of Modules/modCircle.bas (PaintCircleScreen + ChangeAngleFromMouse)

import { useRef } from 'react';
import type { CalculatorApi } from '../state/useCalculatorState';
import type { ReactNode } from 'react';
import { lookupSymbolic, symbolicForFunction, symbolicRadians } from '../trig/symbolicTable';
import {
  AngleMode,
  PI,
  TrigFunction,
  TRIG_FUNCTION_FRACTIONS,
  TRIG_FUNCTION_LABELS,
  TWO_PI,
} from '../trig/trigMath';
import './CirclePanel.css';

// the viewBox hugs the drawing: the circle plus room either side for the
// "0 / pi radians" labels, so the panel doesn't reserve height it never draws
// into. Nothing sits above the circle at all, which puts its top edge exactly
// level with the settings button in the panel's corner. The outline's stroke
// and the point marker at 90 degrees both reach past that edge, so the SVG is
// set to overflow visible and paints them into the panel's padding rather than
// slicing them off.
const CIRCLE_R = 130;
const SIDE_LABEL_ROOM = 68;
const TOP_ROOM = 0;
const MARGIN = 8;
const WIDTH = CIRCLE_R * 2 + (SIDE_LABEL_ROOM + MARGIN) * 2;
const CENTER_X = WIDTH / 2;
const CENTER_Y = TOP_ROOM + CIRCLE_R;

// The two lengths the ratio is made of, laid flat below the circle: same
// scale as the circle itself, and starting from its center, so they read as
// the segments above dropped straight down and turned on their side. A tick
// through both marks the zero they share, which is what makes their lengths
// directly comparable - and which a negative length extends to the left of.
// Restored from the original (modCircle.bas, "draw length indicators").
const BAR_GAP = 22;
const BAR_SPACING = 12;
const BAR_NUMERATOR_Y = CENTER_Y + CIRCLE_R + BAR_GAP;
const BAR_DENOMINATOR_Y = BAR_NUMERATOR_Y + BAR_SPACING;
const BAR_TICK = 6;
const HEIGHT = BAR_DENOMINATOR_Y + BAR_TICK + MARGIN;

type Part = 'x' | 'y' | 'r';

/** Colors go by role rather than by letter: whichever length is on top of the
 *  ratio is red, whichever is underneath is blue, and the one this function
 *  doesn't use stays neutral. */
const COLORS: Record<TrigFunction, Record<Part, string>> = {
  [TrigFunction.Sine]: { r: '#2563eb', x: '#111827', y: '#dc2626' },
  [TrigFunction.Cosine]: { r: '#2563eb', x: '#dc2626', y: '#111827' },
  [TrigFunction.Tangent]: { r: '#111827', x: '#2563eb', y: '#dc2626' },
  [TrigFunction.Cotangent]: { r: '#111827', x: '#dc2626', y: '#2563eb' },
  [TrigFunction.Secant]: { r: '#dc2626', x: '#2563eb', y: '#111827' },
  [TrigFunction.Cosecant]: { r: '#dc2626', x: '#111827', y: '#2563eb' },
};

/** Splits an exact value like "√3/2" into its two halves so it can be stacked.
 *  Nothing in the table carries more than one division. */
function splitFraction(value: string): [string, string] | null {
  const at = value.indexOf('/');
  return at === -1 ? null : [value.slice(0, at), value.slice(at + 1)];
}

/** A stacked fraction - numerator over denominator with a rule between. Laid
 *  out as a one-column grid so both halves fill the wider of the two and the
 *  rule spans the whole thing. */
function Fraction({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <span className="circle-panel__fraction">
      <span>{top}</span>
      <span className="circle-panel__fraction-bottom">{bottom}</span>
    </span>
  );
}

/** An exact value, stacked when it is a fraction and plain when it isn't. */
function Exact({ value }: { value: string }) {
  const halves = splitFraction(value);
  return halves ? <Fraction top={halves[0]} bottom={halves[1]} /> : <>{value}</>;
}

/** Where each length is drawn: x along the axis, y up to the point, r straight
 *  out to it. */
const SEGMENTS: Record<Part, (px: number, py: number) => { x1: number; y1: number; x2: number; y2: number }> = {
  x: (px) => ({ x1: CENTER_X, y1: CENTER_Y, x2: px, y2: CENTER_Y }),
  y: (px, py) => ({ x1: px, y1: CENTER_Y, x2: px, y2: py }),
  r: (px, py) => ({ x1: CENTER_X, y1: CENTER_Y, x2: px, y2: py }),
};

function normalizeAngle(radians: number): number {
  let a = radians % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
}

/** Given the current stored angle and a new raw pointer angle, take the shortest
 *  path so the total (unbounded) angle moves continuously rather than snapping
 *  across the 0/2pi seam. Mirrors ChangeAngleFromMouse in modCircle.bas.
 *  Returns degrees - the caller snaps to a whole one. */
function shortestPathUpdate(currentRadians: number, pointerRadians: number): number {
  const oldNormalized = normalizeAngle(currentRadians);
  let delta = pointerRadians - oldNormalized;
  if (delta < -PI) delta += TWO_PI;
  else if (delta > PI) delta -= TWO_PI;
  return ((currentRadians + delta) * 180) / PI;
}

export default function CirclePanel({ api }: { api: CalculatorApi }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const {
    radians,
    degrees,
    angleMode,
    inverseMode,
    functionMode,
    x,
    y,
    selectedRatio,
    anglePlaces,
    resultPlaces,
  } = api;

  // It is the unit circle, so the radius is 1 and the two lengths are the
  // ratios themselves. There was a radius setting once; it changed neither the
  // drawing nor any answer, because a ratio of two lengths is the same whatever
  // the circle's size - which is the whole reason the unit circle is the unit
  // one.
  const px = CENTER_X + Math.cos(radians) * CIRCLE_R;
  const py = CENTER_Y - Math.sin(radians) * CIRCLE_R;

  const normalized = normalizeAngle(radians);
  const arcLarge = normalized > PI ? 1 : 0;
  const arcStartX = CENTER_X + CIRCLE_R / 5;
  const arcStartY = CENTER_Y;
  const arcEndX = CENTER_X + (CIRCLE_R / 5) * Math.cos(normalized);
  const arcEndY = CENTER_Y - (CIRCLE_R / 5) * Math.sin(normalized);
  const showArc = normalized > 0.1 && normalized < TWO_PI - 0.1;

  const colors = COLORS[functionMode];
  // the SVG lines are drawn on the circle's own light background, where a
  // literal near-black reads fine - but the readout below sits on the app's
  // themed panel, where it would vanish in dark mode
  const readoutColor = (hex: string) => (hex === '#111827' ? 'var(--text-color)' : hex);

  function angleFromPointer(clientX: number, clientY: number): number {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * WIDTH;
    const localY = ((clientY - rect.top) / rect.height) * HEIGHT;
    const dx = localX - CENTER_X;
    const dy = -(localY - CENTER_Y);
    if (dx === 0 && dy === 0) return normalizeAngle(radians);
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += TWO_PI;
    return angle;
  }

  /** Is the pointer within the drawn circle? A drag has to start inside it.
   *  Outside is the side labels and empty margin, and on a phone a touch there
   *  is far more likely to be someone scrolling the page than aiming at the
   *  angle - which used to jump instead of the page moving. */
  function isInsideCircle(clientX: number, clientY: number): boolean {
    const svg = svgRef.current;
    if (!svg) return false;
    const rect = svg.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * WIDTH;
    const localY = ((clientY - rect.top) / rect.height) * HEIGHT;
    return Math.hypot(localX - CENTER_X, localY - CENTER_Y) <= CIRCLE_R;
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!isInsideCircle(e.clientX, e.clientY)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    api.setDegreesSnapped(shortestPathUpdate(radians, angleFromPointer(e.clientX, e.clientY)));
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging.current) return;
    api.setDegreesSnapped(shortestPathUpdate(radians, angleFromPointer(e.clientX, e.clientY)));
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const fmt = (v: number, places: number) => v.toFixed(places);

  // Everything here is formatted by the Function settings: the angle to its
  // decimal places, and every other number - the two lengths and what they come
  // to - to the result places. The circle had its own third setting for these,
  // which only ever meant one line could disagree with another about how
  // precise the same quantity was.
  //
  // The readout is the selected call written out in full: the angle in both
  // units, which two lengths the ratio is, what this angle makes them, and what
  // they come to. Each letter and its value carry the color of the line it
  // names in the diagram above, so the fraction can be read straight off the
  // picture. Sine is y/r, cosine x/r, and so on - the pairing comes from
  // TRIG_FUNCTION_FRACTIONS rather than being spelled out here.
  const [numerator, denominator] = TRIG_FUNCTION_FRACTIONS[functionMode].split('/') as Part[];
  const partValue: Record<Part, number> = { x, y, r: 1 };

  // The three segments overlap: at 180 degrees the radius lies exactly along
  // x, and at 90 exactly along y. Whichever is drawn last wins, so draw the one
  // this ratio doesn't use first - it's the neutral-colored one - then the
  // denominator, then the numerator on top. The two lengths the answer is made
  // of are then never hidden by the one that isn't.
  const unusedPart = (['x', 'y', 'r'] as Part[]).find((p) => p !== numerator && p !== denominator)!;
  const segmentOrder: Part[] = [unusedPart, denominator, numerator];
  const part = (p: Part, text: string) => <span style={{ color: readoutColor(colors[p]) }}>{text}</span>;
  const letterFraction = <Fraction top={part(numerator, numerator)} bottom={part(denominator, denominator)} />;
  // shown even where the ratio is undefined: 1.00 over 0.00 says why it's
  // undefined, which a bare "Undefined" does not
  const valueFraction = (
    <Fraction
      top={part(numerator, fmt(partValue[numerator], resultPlaces))}
      bottom={part(denominator, fmt(partValue[denominator], resultPlaces))}
    />
  );

  const label = TRIG_FUNCTION_LABELS[functionMode];
  const arcLabel = `Arc${label.toLowerCase()}`;
  // just the unit the Functions panel has selected - showing both made the
  // line say the same thing twice
  const angleNode =
    angleMode === AngleMode.Degrees ? (
      <>{fmt(degrees, anglePlaces)}°</>
    ) : symbolicRadians(degrees) ? (
      <Exact value={symbolicRadians(degrees) as string} />
    ) : (
      <>{fmt(radians, anglePlaces)}</>
    );
  // the exact ratio sits immediately before the decimal it equals, so the line
  // reads from the two lengths to what they come to, exactly and then rounded.
  // Only at the angles that have an exact form - most don't.
  const ratioExact = symbolicForFunction(lookupSymbolic(degrees), functionMode);
  const exactNode = ratioExact && ratioExact !== 'undefined' ? <Exact value={ratioExact} /> : null;
  const ratioNode = selectedRatio.isUndefined ? 'Undefined' : fmt(selectedRatio.value, resultPlaces);

  return (
    <div className="circle-panel">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="circle-panel__svg"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <circle
          className="circle-panel__disc"
          cx={CENTER_X}
          cy={CENTER_Y}
          r={CIRCLE_R}
          fill="#fffcf0"
          stroke="#111827"
          strokeWidth={1}
        />
        <line
          x1={CENTER_X}
          y1={CENTER_Y - CIRCLE_R}
          x2={CENTER_X}
          y2={CENTER_Y + CIRCLE_R}
          stroke="#94a3b8"
          strokeWidth={1}
        />
        <line
          x1={CENTER_X - CIRCLE_R}
          y1={CENTER_Y}
          x2={CENTER_X + CIRCLE_R}
          y2={CENTER_Y}
          stroke="#94a3b8"
          strokeWidth={1}
        />

        <text x={CENTER_X + CIRCLE_R + 8} y={CENTER_Y + 4} fontSize="11" fill="#111827">
          &lt; 0 Radians
        </text>
        <text x={CENTER_X - CIRCLE_R - 8} y={CENTER_Y + 4} fontSize="11" fill="#111827" textAnchor="end">
          π Radians &gt;
        </text>

        {showArc && (
          <path
            d={`M ${arcStartX} ${arcStartY} A ${CIRCLE_R / 5} ${CIRCLE_R / 5} 0 ${arcLarge} 0 ${arcEndX} ${arcEndY}`}
            fill="none"
            stroke="#111827"
            strokeWidth={1.5}
          />
        )}

        {segmentOrder.map((part) => (
          <line key={part} {...SEGMENTS[part](px, py)} stroke={colors[part]} strokeWidth={2.5} />
        ))}

        <circle cx={px} cy={py} r={5} fill="#111827" />

        <line
          x1={CENTER_X}
          y1={BAR_NUMERATOR_Y - BAR_TICK}
          x2={CENTER_X}
          y2={BAR_DENOMINATOR_Y + BAR_TICK}
          stroke="#111827"
          strokeWidth={1}
        />
        <line
          x1={CENTER_X}
          y1={BAR_NUMERATOR_Y}
          x2={CENTER_X + partValue[numerator] * CIRCLE_R}
          y2={BAR_NUMERATOR_Y}
          stroke={colors[numerator]}
          strokeWidth={3}
        />
        <line
          x1={CENTER_X}
          y1={BAR_DENOMINATOR_Y}
          x2={CENTER_X + partValue[denominator] * CIRCLE_R}
          y2={BAR_DENOMINATOR_Y}
          stroke={colors[denominator]}
          strokeWidth={3}
        />
      </svg>

      <div className="circle-panel__readout">
        {inverseMode ? (
          <>
            <span>
              {arcLabel}({letterFraction})
            </span>
            <span>=</span>
            <span>
              {arcLabel}({valueFraction})
            </span>
            <span>=</span>
            <span>{angleNode}</span>
          </>
        ) : (
          <>
            <span>
              {label}({angleNode})
            </span>
            <span>=</span>
            {letterFraction}
            <span>=</span>
            {valueFraction}
            <span>=</span>
            {exactNode && (
              <>
                <span>{exactNode}</span>
                <span>=</span>
              </>
            )}
            <span>{ratioNode}</span>
          </>
        )}
      </div>

    </div>
  );
}
