// Port of Modules/modCircle.bas (PaintCircleScreen + ChangeAngleFromMouse)

import { useRef } from 'react';
import type { CalculatorApi } from '../state/useCalculatorState';
import type { ReactNode } from 'react';
import { formatNumber } from '../trig/format';
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

// How far past the drawn circle a touch still counts as aiming at the angle.
// A fingertip lands wide of the edge often enough that the strict circle felt
// unresponsive there. In screen pixels rather than the drawing's own units,
// through a stroke that doesn't scale with the rest: on a phone the drawing is
// half size, and a ring measured in its units would shrink with it, which is
// the opposite of what a finger needs.
const HIT_RING_PX = 36;

// room to leave between the theta and each of the two lines that meet at the
// angle it names - about half the letter's height, plus a little air
const THETA_CLEARANCE = 11;
// Under this the wedge is narrower than the letter is tall the whole way to
// the rim, so there is nowhere inside it the label can sit and be read. The
// arc still shows; it just goes unnamed.
const THETA_MIN_SWEEP = (12 * PI) / 180;
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
function Fraction({ top, bottom, values }: { top: ReactNode; bottom: ReactNode; values?: boolean }) {
  return (
    <span className={values ? 'circle-panel__fraction circle-panel__fraction--values' : 'circle-panel__fraction'}>
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
  const hitRef = useRef<SVGCircleElement>(null);
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

  // The arc sweeps the way the angle was measured: counterclockwise from the
  // positive x-axis for a positive angle, clockwise for a negative one. Drawn
  // from the normalized angle instead, -60 degrees came out as a 300 degree
  // sweep the other way round - a picture that disagreed with both the number
  // in the field and the sign's whole meaning.
  //
  // Past a full turn only the remainder is drawn, so -400 degrees shows the
  // same 40 degrees clockwise that -40 does. A single arc can't say "and one
  // more turn", and a spiral would crowd a diagram this size.
  const swept = radians % TWO_PI;
  const arcLarge = Math.abs(swept) > PI ? 1 : 0;
  // y grows downward here, so a counterclockwise sweep is the 0 flag
  const arcSweep = swept < 0 ? 1 : 0;
  const ARC_R = CIRCLE_R / 5;
  const arcStartX = CENTER_X + ARC_R;
  const arcStartY = CENTER_Y;
  const arcEndX = CENTER_X + ARC_R * Math.cos(swept);
  const arcEndY = CENTER_Y - ARC_R * Math.sin(swept);
  // Below a few degrees the arc is a smudge against the axis it starts from.
  // Only the small end is ruled out: a sweep a few degrees short of a full
  // turn is an arc all the way round, which is worth drawing - it is what
  // tells -715 degrees apart from -5.
  const showArc = Math.abs(swept) > 0.1;
  // Named on the line that halves the angle, so it reads as belonging to the
  // arc from either side of it. How far out depends on how thin the wedge is:
  // the label sits THETA_CLEARANCE from the axis and from the radius, which
  // for a narrow angle means walking out towards the rim, where the two lines
  // have drawn apart far enough to fit it between them. Sitting at a fixed
  // distance it was crushed between them at anything under about 25 degrees.
  // Half the sweep is the angle from the bisector to each line, and the sine
  // of it turns a distance from the center into a distance from those lines -
  // but only while that half is a quarter turn or less. Past it the lines fall
  // behind the label and the center itself is the nearest point of them, so
  // the label is clear wherever it sits. Without the clamp the sine came back
  // down again as the sweep approached a full turn, and a 345 degree angle -
  // as wide open as a wedge gets - sent the theta out to the rim.
  const halfSweep = Math.min(Math.abs(swept) / 2, PI / 2);
  const thetaR = Math.min(
    CIRCLE_R * 0.78,
    Math.max(ARC_R + 16, THETA_CLEARANCE / Math.sin(halfSweep)),
  );
  const thetaX = CENTER_X + thetaR * Math.cos(swept / 2);
  const thetaY = CENTER_Y - thetaR * Math.sin(swept / 2);
  const showTheta = showArc && Math.abs(swept) >= THETA_MIN_SWEEP;

  // The four quarter turns, in the unit the panel is showing: a circle
  // labelled in radians while every number under it reads in degrees makes the
  // reader do the conversion to place themselves.
  const isRadians = angleMode === AngleMode.Radians;
  const QUARTER_IN_RADIANS: Record<number, string> = { 0: '0', 90: 'π/2', 180: 'π', 270: '3π/2' };
  const quarterLabel = (degrees: number) =>
    isRadians ? QUARTER_IN_RADIANS[degrees] : `${degrees}°`;

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

  /** Whole degrees, or the settings' own step while shift is held - the same
   *  bargain the graph offers, and this is where it is most wanted: 30 and 45
   *  are hard to hit with a finger on a circle this size. */
  function turnTo(e: React.PointerEvent<SVGSVGElement>) {
    const degrees = shortestPathUpdate(radians, angleFromPointer(e.clientX, e.clientY));
    const step = api.angleStepDegrees;
    api.setDegreesSnapped(e.shiftKey ? Math.round(degrees / step) * step : degrees);
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // The hit target answers for itself: a drag has to start on it, which is
    // the disc plus its ring. Everywhere else in the panel - the side labels,
    // the margins, the lengths below - scrolls the page instead, which on a
    // phone is what a touch there almost always means.
    if (e.target !== hitRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    turnTo(e);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging.current) return;
    turnTo(e);
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const fmt = formatNumber;

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
  // undefined, which the bare word does not
  const valueFraction = (
    <Fraction
      values
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
  // The exact ratio sits immediately before the decimal it equals, so the line
  // reads from the two lengths to what they come to, exactly and then rounded.
  // Only where that adds something: a radical or a fraction does, a whole
  // number doesn't, since "0 = 0.0000" says the same thing twice running. The
  // Functions panel keeps its whole numbers, because there they fill a column
  // that would otherwise develop holes at 90 and 180 degrees.
  const ratioExact = symbolicForFunction(lookupSymbolic(degrees), functionMode);
  const worthShowing = !!ratioExact && ratioExact !== 'undefined' && !/^-?\d+$/.test(ratioExact);
  const exactNode = worthShowing ? <Exact value={ratioExact as string} /> : null;
  const ratioNode = selectedRatio.isUndefined ? 'undefined' : fmt(selectedRatio.value, resultPlaces);

  return (
    <div className="circle-panel">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="circle-panel__svg"
        role="img"
        aria-label={`Unit circle at ${fmt(degrees, anglePlaces)} degrees, with ${numerator} over ${denominator} drawn as lengths. The equation below states the same thing in words.`}
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

        {/* All four quarter turns, inside the disc where the near-black reads
            on the cream in either theme. Outside it they had to take the
            theme's text color, and the two at the sides had to be reached
            around - and the word Radians with them, which the numbers in the
            equation below already settle. Each sits just clear of the axis it
            marks, so it names the end of the axis without lying on it - and
            the two on the horizontal go below it, where a first-quadrant
            angle, which is most of them, doesn't draw its triangle. */}
        <text
          className="circle-panel__axis-label"
          x={CENTER_X + CIRCLE_R - 6}
          y={CENTER_Y + 14}
          fontSize="11"
          fill="#111827"
          textAnchor="end"
        >
          {quarterLabel(0)}
        </text>
        <text
          className="circle-panel__axis-label"
          x={CENTER_X - CIRCLE_R + 6}
          y={CENTER_Y + 14}
          fontSize="11"
          fill="#111827"
        >
          {quarterLabel(180)}
        </text>
        <text
          className="circle-panel__axis-label"
          x={CENTER_X + 6}
          y={CENTER_Y - CIRCLE_R + 14}
          fontSize="11"
          fill="#111827"
        >
          {quarterLabel(90)}
        </text>
        <text
          className="circle-panel__axis-label"
          x={CENTER_X + 6}
          y={CENTER_Y + CIRCLE_R - 6}
          fontSize="11"
          fill="#111827"
        >
          {quarterLabel(270)}
        </text>

        {showArc && (
          <>
            <path
              d={`M ${arcStartX} ${arcStartY} A ${ARC_R} ${ARC_R} 0 ${arcLarge} ${arcSweep} ${arcEndX} ${arcEndY}`}
              fill="none"
              stroke="#111827"
              strokeWidth={1.5}
            />
            {showTheta && (
              <text
                className="circle-panel__theta"
                x={thetaX}
                y={thetaY}
                fontSize="13"
                fontStyle="italic"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#111827"
              >
                θ
              </text>
            )}
          </>
        )}

        {segmentOrder.map((part) => (
          <line
            key={part}
            className="circle-panel__segment"
            {...SEGMENTS[part](px, py)}
            stroke={colors[part]}
            strokeWidth={2.5}
          />
        ))}

        {/* The point sits on the circle's edge, so half of it is out on the
            panel's own background - which in the dark theme swallowed that
            half. A ring in the disc's cream outlines it in either theme, and
            in the light one is all but invisible. Painted beneath the fill, so
            the ring adds to the dot rather than eating into it. */}
        <circle
          className="circle-panel__point"
          cx={px}
          cy={py}
          r={5}
          fill="#111827"
          stroke="#fffcf0"
          strokeWidth={3}
          paintOrder="stroke"
        />

        <line
          x1={CENTER_X}
          y1={BAR_NUMERATOR_Y - BAR_TICK}
          x2={CENTER_X}
          y2={BAR_DENOMINATOR_Y + BAR_TICK}
          stroke="var(--text-color)"
          strokeWidth={1}
        />
        <line
          x1={CENTER_X}
          y1={BAR_NUMERATOR_Y}
          className="circle-panel__bar"
          x2={CENTER_X + partValue[numerator] * CIRCLE_R}
          y2={BAR_NUMERATOR_Y}
          stroke={colors[numerator]}
          strokeWidth={3}
        />
        <line
          x1={CENTER_X}
          y1={BAR_DENOMINATOR_Y}
          className="circle-panel__bar"
          x2={CENTER_X + partValue[denominator] * CIRCLE_R}
          y2={BAR_DENOMINATOR_Y}
          stroke={colors[denominator]}
          strokeWidth={3}
        />

        {/* Which length each bar is, in the color it is drawn in - the colors
            alone said it only to someone who can tell the red from the blue,
            and only by looking back up at the fraction. At the far end of each
            bar, on the side it grew towards, so the letter travels with the
            length it names rather than sitting apart from it. */}
        {([numerator, denominator] as Part[]).map((part, index) => {
          const end = CENTER_X + partValue[part] * CIRCLE_R;
          const outward = partValue[part] < 0 ? -1 : 1;
          return (
            <text
              key={part}
              className="circle-panel__axis-label"
              x={end + outward * 7}
              y={(index === 0 ? BAR_NUMERATOR_Y : BAR_DENOMINATOR_Y) + 4}
              fontSize="11"
              textAnchor={outward < 0 ? 'end' : 'start'}
              fill={readoutColor(colors[part])}
            >
              {part}
            </text>
          );
        })}

        {/* One invisible hit target over the whole disc, on top of everything.
            touch-action is settled per element, and the segments and the marker
            beneath this each answered for themselves - so a touch that landed
            on a line panned the page while the drag was also turning the angle.
            With this on top, every touch inside the circle hits one element,
            which says no. Last in the drawing, so it covers the lengths below
            the circle too: they reach into the ring, and a press that starts on
            one is still a press near the circle's bottom edge.

            It reaches past the circle by a transparent stroke, half of which
            lies outside the edge - hence the doubled width. pointer-events
            counts that stroke despite it painting nothing. Clipped to the
            drawing so the ring can't cover the panel's header, which sits
            directly above the circle's top edge. */}
        <clipPath id="circle-hit-clip">
          <rect x={0} y={0} width={WIDTH} height={HEIGHT} />
        </clipPath>
        <circle
          ref={hitRef}
          className="circle-panel__hit"
          clipPath="url(#circle-hit-clip)"
          cx={CENTER_X}
          cy={CENTER_Y}
          r={CIRCLE_R}
          fill="transparent"
          stroke="transparent"
          strokeWidth={HIT_RING_PX * 2}
          vectorEffect="non-scaling-stroke"
          pointerEvents="all"
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
