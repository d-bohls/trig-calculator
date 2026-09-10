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

function niceTickStep(range: number, maxTicks: number): number {
  if (range <= 0) return 1;
  const rough = range / maxTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  for (const mult of [1, 2, 5, 10]) {
    if (magnitude * mult >= rough) return magnitude * mult;
  }
  return magnitude * 10;
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

    // ticks
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    const [, axisY] = toScreenHere(0, 0, w, h);
    const xStep = niceTickStep(xMax - xMin, 20);
    for (let v = Math.ceil(xMin / xStep) * xStep; v <= xMax; v += xStep) {
      const [sx] = toScreenHere(v, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(sx, axisY - 4);
      ctx.lineTo(sx, axisY + 4);
      ctx.stroke();
    }
    const [axisX] = toScreenHere(0, 0, w, h);
    const yStep = niceTickStep(yMax - yMin, 20);
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
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, 2 * Math.PI);
      ctx.fill();

      if (showTangent) {
        const slope = slopeAt(functionMode, inverseMode, angleMode, xval);
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = '#059669';
        ctx.font = '12px monospace';
        if (Number.isFinite(slope)) {
          const y1 = yval + slope * (xMin - xval);
          const y2 = yval + slope * (xMax - xval);
          const [x1s, y1s] = toScreenHere(xMin, y1, w, h);
          const [x2s, y2s] = toScreenHere(xMax, y2, w, h);
          ctx.beginPath();
          ctx.moveTo(x1s, y1s);
          ctx.lineTo(x2s, y2s);
          ctx.stroke();
          ctx.textAlign = 'right';
          ctx.fillText(`slope ≈ ${slope.toFixed(4)}`, w - 6, 16);
          ctx.textAlign = 'left';
        } else if (slope === Infinity || slope === -Infinity) {
          // the tangent at the end of arcsine and friends is vertical, so it
          // has no slope to write down - draw the line itself instead of
          // giving up on it
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, h);
          ctx.stroke();
          ctx.textAlign = 'right';
          ctx.fillText(slope > 0 ? 'slope → ∞' : 'slope → -∞', w - 6, 16);
          ctx.textAlign = 'left';
        }
      }
    }

    // corner labels
    ctx.fillStyle = '#111827';
    ctx.font = '11px sans-serif';
    ctx.fillText(yMax.toFixed(2), 4, 12);
    ctx.fillText(yMin.toFixed(2), 4, h - 6);
    ctx.textAlign = 'left';
    ctx.fillText(xMin.toFixed(2), 4, h - 20 > 12 ? h - 20 : 24);
    ctx.textAlign = 'right';
    ctx.fillText(xMax.toFixed(2), w - 4, h - 20 > 12 ? h - 20 : 24);
    ctx.textAlign = 'left';
}
