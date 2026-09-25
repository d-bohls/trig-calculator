// The graph panel: its toolbar, the canvas, the sweep the play button runs, and
// turning a click into an angle. What the plot actually looks like lives in
// ../graph/drawGraph, which needs no React to do its job.
//
// Port of Modules/modGraph.bas (MoveGraphPoint and the frmCalc plumbing).

import { useEffect, useRef, useState } from 'react';
import type { CalculatorApi } from '../state/useCalculatorState';
import { drawGraph, toMath } from '../graph/drawGraph';
import { getCurrentGraphPoint } from '../trig/currentPoint';
import { formatNumber } from '../trig/format';
import {
  AngleMode,
  clampToArcDomain,
  getRadians,
  PI,
  slopeAt,
  TRIG_FUNCTION_NAMES,
} from '../trig/trigMath';
import PlayIcon from './PlayIcon';
import './FunctionGraph.css';

export default function FunctionGraph({ api }: { api: CalculatorApi }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const [size, setSize] = useState({ width: 400, height: 380 });
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1);
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

  // The canvas is sized in device pixels, so it has to follow the device pixel
  // ratio - and that can change without anything on the page changing size, by
  // dragging the window to a monitor that scales differently. The resize
  // observer above sees nothing then, so the plot would go on drawing at the
  // old scale: too large for its box, spilling past the edges both ways. There
  // is no event for this, so watch the resolution the page is being rendered
  // at and re-arm after each change, since the query names the old value.
  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const onChange = () => setDpr(window.devicePixelRatio || 1);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [dpr]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    drawGraph(ctx, size.width, size.height, {
      window: graphWindow,
      functionMode,
      angleMode,
      inverseMode,
      showTangent,
      currentPoint,
      selectedRatio,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, dpr, radians, functionMode, angleMode, inverseMode, graphWindow, showTangent]);


  function handlePointer(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const [mathX] = toMath(graphWindow, clientX - rect.left, clientY - rect.top, rect.width, rect.height);
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

  /** What the tangent's slope comes to, or null when no tangent is drawn -
   *  which is whenever the point itself isn't, since a line through a point
   *  off the plot has nothing to be tangent to. */
  function slopeText(): string | null {
    const { xval, yval } = currentPoint;
    const { xMin, xMax, yMin, yMax } = graphWindow;
    const drawn =
      showTangent &&
      !selectedRatio.isUndefined &&
      xval >= xMin &&
      xval <= xMax &&
      yval >= yMin &&
      yval <= yMax;
    if (!drawn) return null;
    const slope = slopeAt(functionMode, inverseMode, angleMode, xval);
    if (Number.isFinite(slope)) return `slope ≈ ${formatNumber(slope, resultPlaces)}`;
    // vertical, where arcsine and friends meet the ends of their domain
    return slope > 0 ? 'slope → ∞' : 'slope → -∞';
  }

  return (
    <div className="function-graph">
      <div className="function-graph__toolbar">
        <button
          type="button"
          className="icon-button function-graph__play"
          onClick={startSweep}
          aria-label="Sweep the point across the graph"
          title="Sweep the point across the graph"
        >
          <PlayIcon />
        </button>
        <label className="function-graph__tangent">
          <input
            type="checkbox"
            checked={showTangent}
            onChange={(e) => api.setShowTangent(e.target.checked)}
          />
          Show tangent line
        </label>
      </div>
      <div ref={containerRef} className="function-graph__canvas-wrap">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${inverseMode ? 'Inverse ' : ''}${
            TRIG_FUNCTION_NAMES[functionMode]
          } plotted from ${graphWindow.xMin} to ${graphWindow.xMax}. Current point ${readoutText()}. Drag to move it; the angle can also be typed into the Functions panel.`}
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
      {/* the point's two facts, each against the edge of the plot they sit
          under, the way the toolbar's two controls sit against them above */}
      <div className="function-graph__readout">
        <span>{readoutText()}</span>
        {slopeText() && <span className="function-graph__slope">{slopeText()}</span>}
      </div>
    </div>
  );
}
