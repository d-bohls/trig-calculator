// Everything the plot is made of, drawn in one pass: axes, ticks, the curve,
// the asymptotes it must break across, the current point and its tangent.
//
// Lifted out of the component because none of it is React's business. It takes
// a context and a description of what to draw, touches no state, and can be
// exercised without mounting anything.

import type { GraphWindow } from '../state/useCalculatorState';
import type { getCurrentGraphPoint } from '../trig/currentPoint';
import { plotGraphPoints } from '../trig/graphPoints';
import {
  AngleMode,
  asymptoteAngles,
  getInverseFunctionRange,
  PI,
  type Ratio,
  slopeAt,
  TrigFunction,
} from '../trig/trigMath';

export interface GraphScene {
  window: GraphWindow;
  functionMode: TrigFunction;
  angleMode: AngleMode;
  inverseMode: boolean;
  showTangent: boolean;
  currentPoint: ReturnType<typeof getCurrentGraphPoint>;
  selectedRatio: Ratio;
}

/** Maps a point in the plot's own units onto the canvas. */
export function toScreen(window: GraphWindow, mathX: number, mathY: number, w: number, h: number) {
  const { xMin, xMax, yMin, yMax } = window;
  return [((mathX - xMin) / (xMax - xMin)) * w, ((yMax - mathY) / (yMax - yMin)) * h];
}

/** And back, for turning a click into an angle. */
export function toMath(window: GraphWindow, sx: number, sy: number, w: number, h: number) {
  const { xMin, xMax, yMin, yMax } = window;
  return [xMin + (sx / w) * (xMax - xMin), yMax - (sy / h) * (yMax - yMin)];
}

// The angle axis doesn't want a decimal step. In degrees the interesting
// angles come in twelfths and eighths of a turn, and in radians they are
// multiples of pi - a step of 1 radian lands the marks at 1, 2, 3, which is
// nowhere in particular on a sine wave, while pi/4 lands them on its zeros and
// its peaks.
const DEGREE_STEPS = [1, 2, 5, 10, 15, 30, 45, 90, 180, 360, 720, 1440];
// Halvings of pi, and no finer than a quarter. A step of pi/3 numbers an axis
// pi/3, 2pi/3, pi, 4pi/3 - a different family of fractions from the pi/4 and
// pi/2 either side of it in this list - and pi/6 and pi/12 bring the same
// thirds back through their own multiples. Halving keeps every radian axis
// reading in the same fractions.
//
// Eighths stop below the quarter because they are numbers to read, not marks
// to count: an axis from -pi/2 to pi written in eighths carries pi/8, pi/4,
// 3pi/8, pi/2, 5pi/8 and on, which is a column of arithmetic down the side of
// the plot. Eighths and sixteenths still appear as the unnumbered marks
// between the quarters. A window zoomed in tighter than a quarter turn has no
// step here that fits, and the halving in planLabels takes it down from there.
const RADIAN_STEPS_OVER_PI = [1 / 4, 1 / 2, 1, 2, 4, 8, 16];

// The marks between the numbered ones are that step divided, so a number
// always lands on a mark - sized independently they disagreed, and an axis
// labelled every 0.5 was marked every 0.2. Which divisions are available
// depends on the unit: thirds and quarters of a turn read naturally in degrees
// and radians, where a ratio wants halves and fifths, 0.25 rather than 0.125.
const DEGREE_DIVISORS = [3, 4, 2];
// powers of two only, for the same reason the radian steps are: a third of
// pi/4 is pi/12, and marks at twelfths sit between the quarters the numbers
// are written in rather than halfway along them
const RADIAN_DIVISORS = [4, 2];
const PLAIN_DIVISORS = [5, 2];
// past this many the marks crowd into a grey band
const MAX_TICKS = 24;

/** Every step this axis could be numbered in, finest first. */
function stepCandidates(range: number, isAngle: boolean, angleMode: AngleMode): number[] {
  if (isAngle) {
    return angleMode === AngleMode.Degrees ? DEGREE_STEPS : RADIAN_STEPS_OVER_PI.map((k) => k * PI);
  }
  // the ordinary 1, 2, 5 of a decimal axis, over every magnitude this range
  // could want
  const steps: number[] = [];
  for (let magnitude = 10 ** Math.floor(Math.log10(range / 100)); magnitude <= range; magnitude *= 10) {
    for (const mult of [1, 2, 5]) steps.push(magnitude * mult);
  }
  return steps;
}

// An axis carries between these two. Past the upper one it is being read
// rather than glanced at; below the lower one it says nothing about scale at
// all, which is what an axis of bare marks amounts to.
const MIN_LABELS = 2;
const MAX_LABELS = 8;

function tickStepUnder(labelStep: number, range: number, isAngle: boolean, angleMode: AngleMode): number {
  const divisors = !isAngle
    ? PLAIN_DIVISORS
    : angleMode === AngleMode.Degrees
      ? DEGREE_DIVISORS
      : RADIAN_DIVISORS;
  for (const divisor of divisors) {
    const step = labelStep / divisor;
    if (range / step <= MAX_TICKS) return step;
  }
  return labelStep;
}

/** A number with no trailing zeros, and without float dust: 1.5, not 1.5000. */
function trimNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

/** "π/2", "-3π/4", "2π", "0" - or a plain number if it isn't a neat multiple. */
function formatRadians(value: number): string {
  if (Math.abs(value) < 1e-9) return '0';
  const turns = value / PI;
  for (const denominator of [1, 2, 3, 4, 6, 8, 12]) {
    const numerator = turns * denominator;
    if (Math.abs(numerator - Math.round(numerator)) > 1e-6) continue;
    const n = Math.round(numerator);
    const sign = n < 0 ? '-' : '';
    const magnitude = Math.abs(n);
    const top = magnitude === 1 ? 'π' : `${magnitude}π`;
    return denominator === 1 ? `${sign}${top}` : `${sign}${top}/${denominator}`;
  }
  return trimNumber(value);
}

/** Each axis in its own unit: degrees carry the sign, radians read in pi, and
 *  a ratio is a plain number. */
function formatTick(value: number, isAngle: boolean, angleMode: AngleMode): string {
  if (!isAngle) return trimNumber(value);
  return angleMode === AngleMode.Degrees ? `${trimNumber(value)}°` : formatRadians(value);
}

export function drawGraph(ctx: CanvasRenderingContext2D, w: number, h: number, scene: GraphScene) {
  const {
    window: graphWindow,
    functionMode,
    angleMode,
    inverseMode,
    showTangent,
    currentPoint,
    selectedRatio,
  } = scene;
  const toScreenHere = (x: number, y: number, ww: number, hh: number) => toScreen(graphWindow, x, y, ww, hh);
    const { xMin, xMax, yMin, yMax } = graphWindow;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // axes
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.5;
    if (xMin <= 0 && xMax >= 0) {
      const [sx] = toScreenHere(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }
    if (yMin <= 0 && yMax >= 0) {
      const [, sy] = toScreenHere(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
    }

    // Which axis carries the angle swaps with the function type: a standard
    // function takes an angle across and returns a ratio up, an arc function
    // the other way round.
    const xIsAngle = !inverseMode;

    const [axisX] = toScreenHere(0, 0, w, h);
    const [, axisY] = toScreenHere(0, 0, w, h);
    const labelX = Math.min(Math.max(axisX, 2), w - 2);
    const labelY = Math.min(Math.max(axisY, 2), h - 2);

    // The numbers are planned before anything is drawn, because the marks are
    // cut from whatever step the numbers end up on - decided separately they
    // disagreed, and an axis numbered every 0.5 was marked every 0.2.
    ctx.font = '11px sans-serif';

    /** The numbers this step would put on an axis, less any that don't fit. */
    const fitting = (step: number, axis: 'x' | 'y') => {
      const [min, max] = axis === 'x' ? [xMin, xMax] : [yMin, yMax];
      const values: { at: number; text: string }[] = [];
      for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
        // the origin is where the two axes crossing already say zero
        if (Math.abs(v) < step / 2) continue;
        const text = formatTick(v, axis === 'x' ? xIsAngle : !xIsAngle, angleMode);
        const [sx, sy] = toScreenHere(axis === 'x' ? v : 0, axis === 'x' ? 0 : v, w, h);
        if (axis === 'x') {
          // an edge number would be half cut off by the frame
          const half = ctx.measureText(text).width / 2;
          if (sx - half < 2 || sx + half > w - 2) continue;
          values.push({ at: sx, text });
        } else {
          if (sy < 8 || sy > h - 8) continue;
          values.push({ at: sy, text });
        }
      }
      return values;
    };

    // The finest step whose numbers both clear each other and stay few enough
    // to take in at a glance. Room alone is a poor judge: a tall plot has
    // space for a number every eighth of pi, and an axis written pi/8, pi/4,
    // 3pi/8, pi/2, 5pi/8 is a column of arithmetic rather than a scale. A
    // count alone is no better - it is a guess at how wide a number is, and
    // the same guess suited a desktop and crowded a phone - so both have a
    // say. The count is of the numbers that actually get drawn, not of those
    // the step implies: an axis from -10 to 10 numbered every 2 carries ten,
    // of which the two at the frame are dropped, and judging it on the ten
    // would have pushed it out to every 5 and left it with two.
    const planLabels = (axis: 'x' | 'y', pixels: number, needed: number) => {
      const range = axis === 'x' ? xMax - xMin : yMax - yMin;
      const isAngle = axis === 'x' ? xIsAngle : !xIsAngle;
      const candidates = stepCandidates(range, isAngle, angleMode);
      let step = candidates[candidates.length - 1] ?? range;
      for (const candidate of candidates) {
        if ((candidate / range) * pixels < needed) continue;
        if (fitting(candidate, axis).length > MAX_LABELS) continue;
        step = candidate;
        break;
      }

      // Even the coarsest step can leave nothing to show: an axis 3.3 radians
      // wide takes a number every pi/2, and both of them land against the
      // frame. So it is halved until at least two survive, or until halving
      // stops helping.
      let values = fitting(step, axis);
      for (let halved = 0; values.length < MIN_LABELS && halved < 3; halved += 1) {
        const finer = fitting(step / 2, axis);
        if (finer.length <= values.length) break;
        step /= 2;
        values = finer;
      }
      return { step, values };
    };

    // what one of these numbers takes up, measured at the ends of the axis
    // where they are longest
    const widest = (axis: 'x' | 'y') => {
      const [min, max] = axis === 'x' ? [xMin, xMax] : [yMin, yMax];
      const isAngle = axis === 'x' ? xIsAngle : !xIsAngle;
      return Math.max(
        ctx.measureText(formatTick(min, isAngle, angleMode)).width,
        ctx.measureText(formatTick(max, isAngle, angleMode)).width,
      );
    };

    // The gap across is wide because the numbers are not the only thing that
    // has to fit between them: packed as close as they will go, the marks that
    // belong between two numbers have nowhere to sit, and an axis numbered
    // every 0.2 ends up marked every 0.2 as well. Stacked up the side they
    // only have to clear each other's height, which is about a line of space.
    const xLabels = planLabels('x', w, widest('x') + 24);
    const yLabels = planLabels('y', h, 40);

    // ticks
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    const xStep = tickStepUnder(xLabels.step, xMax - xMin, xIsAngle, angleMode);
    for (let v = Math.ceil(xMin / xStep) * xStep; v <= xMax; v += xStep) {
      const [sx] = toScreenHere(v, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(sx, axisY - 4);
      ctx.lineTo(sx, axisY + 4);
      ctx.stroke();
    }
    const yStep = tickStepUnder(yLabels.step, yMax - yMin, !xIsAngle, angleMode);
    for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
      const [, sy] = toScreenHere(0, v, w, h);
      ctx.beginPath();
      ctx.moveTo(axisX - 4, sy);
      ctx.lineTo(axisX + 4, sy);
      ctx.stroke();
    }

    // curve
    const { points } = plotGraphPoints({
      fn: functionMode,
      inverseMode,
      angleMode,
      window: graphWindow,
      pixelWidth: w,
    });

    // vertical asymptotes, drawn as their own pass so beginPath() here can't
    // wipe out the main curve's path (they share the canvas's one current path)
    if (!inverseMode) {
      ctx.save();
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (const p of points) {
        if (!p.isUndefined) continue;
        const [sx] = toScreenHere(p.x, 0, w, h);
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, h);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // Arc mode swaps the axes, so the standard function's vertical asymptotes
      // become the horizontal limits its arc curve approaches without reaching.
      // Same angles, drawn the other way round - but only those inside this
      // function's principal range, since the rest belong to a branch that
      // isn't being plotted.
      const spec = asymptoteAngles(functionMode);
      if (spec) {
        const range = getInverseFunctionRange(functionMode);
        // the bounds are whole degrees; round off the conversion's float dust
        // so a limit exactly on a bound isn't missed
        const lowerDeg = Math.round((range.lower * 180) / PI);
        const upperDeg = Math.round((range.upper * 180) / PI);
        ctx.save();
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const first = Math.ceil((lowerDeg - spec.offset) / spec.period);
        const last = Math.floor((upperDeg - spec.offset) / spec.period);
        for (let k = first; k <= last; k += 1) {
          const degrees = spec.offset + k * spec.period;
          const yv = angleMode === AngleMode.Degrees ? degrees : (degrees * PI) / 180;
          if (yv < yMin || yv > yMax) continue;
          const [, sy] = toScreenHere(0, yv, w, h);
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(w, sy);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    let penDown = false;
    ctx.beginPath();
    for (const p of points) {
      if (p.isUndefined) {
        penDown = false;
        continue;
      }
      const [sx, sy] = toScreenHere(p.x, p.y, w, h);
      if (!penDown) {
        ctx.moveTo(sx, sy);
        penDown = true;
      } else {
        ctx.lineTo(sx, sy);
      }
    }
    ctx.stroke();

    // current point
    const { xval, yval } = currentPoint;
    const pointVisible = xval >= xMin && xval <= xMax && yval >= yMin && yval <= yMax && !selectedRatio.isUndefined;
    if (pointVisible) {
      const [sx, sy] = toScreenHere(xval, yval, w, h);

      // the tangent first, so the point sits on top of it: the line passes
      // straight through the point it is drawn for, and on top it cut the
      // marker in half. What its slope comes to is written under the plot,
      // beside the point's own coordinates - see FunctionGraph.tsx.
      if (showTangent) {
        const slope = slopeAt(functionMode, inverseMode, angleMode, xval);
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.5;
        if (Number.isFinite(slope)) {
          const y1 = yval + slope * (xMin - xval);
          const y2 = yval + slope * (xMax - xval);
          const [x1s, y1s] = toScreenHere(xMin, y1, w, h);
          const [x2s, y2s] = toScreenHere(xMax, y2, w, h);
          ctx.beginPath();
          ctx.moveTo(x1s, y1s);
          ctx.lineTo(x2s, y2s);
          ctx.stroke();
        } else if (slope === Infinity || slope === -Infinity) {
          // the tangent at the end of arcsine and friends is vertical, so it
          // has no slope to write down - draw the line itself instead of
          // giving up on it
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, h);
          ctx.stroke();
        }
      }

      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Numbers on the ticks rather than in the corners, where they described
    // the window but said nothing about the middle of the plot.
    ctx.fillStyle = '#111827';

    // A step can leave almost nothing to show: an axis 3.3 radians wide takes
    // a number every pi/2, and both of them land within a few pixels of the
    // frame, where a number would be half cut off and is dropped. That left an
    // axis carrying bare marks and no figures at all. So the step is halved
    // until at least two numbers survive, or until halving stops helping.
    ctx.textAlign = 'center';
    ctx.textBaseline = labelY > h - 18 ? 'bottom' : 'top';
    for (const label of xLabels.values) {
      ctx.fillText(label.text, label.at, labelY > h - 18 ? labelY - 6 : labelY + 6);
    }

    ctx.textBaseline = 'middle';
    for (const label of yLabels.values) {
      const room = ctx.measureText(label.text).width + 8;
      // to the left of the axis where there's room for it, otherwise the right
      const onLeft = labelX - room > 0;
      ctx.textAlign = onLeft ? 'right' : 'left';
      ctx.fillText(label.text, onLeft ? labelX - 6 : labelX + 6, label.at);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}
