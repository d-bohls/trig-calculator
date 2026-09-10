// Port of Modules/modGraph.bas (PlotGraphPoints, PaintGraphScreen, MoveGraphPoint, DrawTangent)

import { useEffect, useRef, useState } from 'react';
import type { CalculatorApi } from '../state/useCalculatorState';
import { getCurrentGraphPoint } from '../trig/currentPoint';
import { formatNumber } from '../trig/format';
import { plotGraphPoints } from '../trig/graphPoints';
import {
  AngleMode,
  asymptoteAngles,
  clampToArcDomain,
  getInverseFunctionRange,
  getRadians,
  PI,
  slopeAt,
} from '../trig/trigMath';
import GraphSettingsDialog from './dialogs/GraphSettingsDialog';
import GearIcon from './GearIcon';
import PlayIcon from './PlayIcon';
import './FunctionGraph.css';

function niceTickStep(range: number, maxTicks: number): number {
  if (range <= 0) return 1;
  const rough = range / maxTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  for (const mult of [1, 2, 5, 10]) {
    if (magnitude * mult >= rough) return magnitude * mult;
  }
  return magnitude * 10;
}

export default function FunctionGraph({ api }: { api: CalculatorApi }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const [size, setSize] = useState({ width: 400, height: 380 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const sweepFrame = useRef<number | null>(null);

  const { radians, functionMode, angleMode, inverseMode, graphWindow, selectedRatio, degrees, showTangent } = api;
  const { anglePlaces, resultPlaces } = api;
  const currentPoint = getCurrentGraphPoint({ radians, degrees, angleMode, inverseMode, ratio: selectedRatio });

  function stopSweep() {
    if (sweepFrame.current !== null) {
      cancelAnimationFrame(sweepFrame.current);
      sweepFrame.current = null;
    }
    setSweeping(false);
  }

  useEffect(() => stopSweep, []);

  // A sweep is something to watch, not a mode to be trapped in, so it yields
  // the moment the user reaches for anything. The listener only cancels; it
  // doesn't swallow the event, so whatever was clicked, dragged or typed still
  // happens. Nothing is disabled and there's nothing to dismiss.
  useEffect(() => {
    if (!sweeping) return;
    const interrupt = () => stopSweep();
    document.addEventListener('pointerdown', interrupt, true);
    return () => document.removeEventListener('pointerdown', interrupt, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweeping]);

  /** Walks the point from one edge of the window to the other. The range and
   *  the function are read once, at the start, so the sweep is a self-contained
   *  animation rather than something that changes shape underneath itself. */
  function startSweep() {
    stopSweep();
    const fn = functionMode;
    const unit = angleMode;
    const inverse = inverseMode;
    const from = inverse ? clampToArcDomain(fn, graphWindow.xMin) : graphWindow.xMin;
    const to = inverse ? clampToArcDomain(fn, graphWindow.xMax) : graphWindow.xMax;
    if (!(to > from)) return;

    const apply = (xval: number) => {
      if (!inverse) {
        api.setRadians(unit === AngleMode.Degrees ? (xval * PI) / 180 : xval);
        return;
      }
      const { radians: r, ok } = getRadians(fn, xval);
      if (ok) api.setRadians(r);
    };

    // read once, so dragging the speed slider can't stretch a sweep already
    // under way. Measured off the clock rather than counted in frames, so it
    // takes the same time on any machine.
    const sweepMs = Math.max(1, api.sweepSeconds) * 1000;
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / sweepMs);
      apply(from + (to - from) * progress);
      if (progress < 1) {
        sweepFrame.current = requestAnimationFrame(step);
      } else {
        sweepFrame.current = null;
        setSweeping(false);
      }
    };
    setSweeping(true);
    sweepFrame.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    // only the backing-store resolution is set here - the canvas's visual
    // size comes from CSS (absolutely positioned to fill its wrapper). Setting
    // an inline pixel height here instead would feed the measured height back
    // into the layout as intrinsic content, pinning the row at whatever height
    // it last grew to and preventing it from ever shrinking again.
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, size.width, size.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, radians, functionMode, angleMode, inverseMode, graphWindow, showTangent]);

  function toScreen(mathX: number, mathY: number, w: number, h: number) {
    const { xMin, xMax, yMin, yMax } = graphWindow;
    const sx = ((mathX - xMin) / (xMax - xMin)) * w;
    const sy = ((yMax - mathY) / (yMax - yMin)) * h;
    return [sx, sy];
  }

  function toMath(sx: number, sy: number, w: number, h: number) {
    const { xMin, xMax, yMin, yMax } = graphWindow;
    const mathX = xMin + (sx / w) * (xMax - xMin);
    const mathY = yMax - (sy / h) * (yMax - yMin);
    return [mathX, mathY];
  }

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const { xMin, xMax, yMin, yMax } = graphWindow;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // axes
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.5;
    if (xMin <= 0 && xMax >= 0) {
      const [sx] = toScreen(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }
    if (yMin <= 0 && yMax >= 0) {
      const [, sy] = toScreen(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
    }

    // ticks
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    const [, axisY] = toScreen(0, 0, w, h);
    const xStep = niceTickStep(xMax - xMin, 20);
    for (let v = Math.ceil(xMin / xStep) * xStep; v <= xMax; v += xStep) {
      const [sx] = toScreen(v, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(sx, axisY - 4);
      ctx.lineTo(sx, axisY + 4);
      ctx.stroke();
    }
    const [axisX] = toScreen(0, 0, w, h);
    const yStep = niceTickStep(yMax - yMin, 20);
    for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
      const [, sy] = toScreen(0, v, w, h);
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
        const [sx] = toScreen(p.x, 0, w, h);
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
          const [, sy] = toScreen(0, yv, w, h);
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
      const [sx, sy] = toScreen(p.x, p.y, w, h);
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
      const [sx, sy] = toScreen(xval, yval, w, h);
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
          const [x1s, y1s] = toScreen(xMin, y1, w, h);
          const [x2s, y2s] = toScreen(xMax, y2, w, h);
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

  function handlePointer(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const [mathX] = toMath(clientX - rect.left, clientY - rect.top, rect.width, rect.height);
    // snap to a whole degree, so dragging back and forth can't drift the angle
    if (!inverseMode) {
      // x is the angle itself, in whichever unit the axis is showing
      api.setDegreesSnapped(angleMode === AngleMode.Degrees ? mathX : (mathX * 180) / PI);
    } else {
      // x is the input ratio; the angle comes back out of the arc function.
      // Clicking past the end of the curve pulls the point to the endpoint
      // rather than doing nothing at all.
      const { radians: r, ok } = getRadians(functionMode, clampToArcDomain(functionMode, mathX));
      if (ok) api.setDegreesSnapped((r * 180) / PI);
    }
  }

  /** The point's coordinates, each to the Function settings' places for what it
   *  actually is - the angle axis to the angle places, the ratio axis to the
   *  result places. Arc mode swaps which axis is which. */
  function readoutText(): string {
    const xPlaces = inverseMode ? resultPlaces : anglePlaces;
    const yPlaces = inverseMode ? anglePlaces : resultPlaces;
    if (selectedRatio.isUndefined) {
      return inverseMode
        ? `(Undefined, ${formatNumber(currentPoint.yval, yPlaces)})`
        : `(${formatNumber(currentPoint.xval, xPlaces)}, Undefined)`;
    }
    return `(${formatNumber(currentPoint.xval, xPlaces)}, ${formatNumber(currentPoint.yval, yPlaces)})`;
  }

  return (
    <div className="function-graph">
      <div className="function-graph__toolbar">
        <label className="function-graph__tangent">
          <input
            type="checkbox"
            checked={showTangent}
            onChange={(e) => api.setShowTangent(e.target.checked)}
          />
          Show tangent line
        </label>
        <button
          type="button"
          className="icon-button function-graph__play"
          onClick={startSweep}
          aria-label="Sweep the point across the graph"
          title="Sweep the point across the graph"
        >
          <PlayIcon />
        </button>
        <button
          type="button"
          className="icon-button function-graph__settings"
          onClick={() => setSettingsOpen(true)}
          aria-label="Graph settings"
          title="Graph settings"
        >
          <GearIcon />
        </button>
      </div>
      <div ref={containerRef} className="function-graph__canvas-wrap">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
            handlePointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (dragging.current) handlePointer(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            dragging.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            api.setShowTangent(!showTangent);
          }}
        />
      </div>
      <div className="function-graph__readout">{readoutText()}</div>
      {settingsOpen && <GraphSettingsDialog api={api} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
