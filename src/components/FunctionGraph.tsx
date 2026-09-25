// The graph panel: its toolbar, the canvas, the sweep the play button runs, and
// turning a click into an angle. What the plot actually looks like lives in
// ../graph/drawGraph, which needs no React to do its job.
//
// Port of Modules/modGraph.bas (MoveGraphPoint and the frmCalc plumbing).

import { useEffect, useRef, useState } from 'react';
import type { CalculatorApi } from '../state/useCalculatorState';
import { drawGraph, toMath, type PlotColors } from '../graph/drawGraph';
import { getCurrentGraphPoint } from '../trig/currentPoint';
import { displayAngle, formatNumber } from '../trig/format';
import {
  AngleMode,
  arcFunctionName,
  clampToArcDomain,
  getRadians,
  PI,
  slopeAt,
  TRIG_FUNCTION_LABELS,
  TRIG_FUNCTION_NAMES,
} from '../trig/trigMath';
import PlayIcon from './PlayIcon';
import StopIcon from './StopIcon';
import './FunctionGraph.css';

export default function FunctionGraph({ api }: { api: CalculatorApi }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const [size, setSize] = useState({ width: 400, height: 380 });
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1);
  const [theme, setTheme] = useState(() => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
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

  // The plot is painted, not styled, so it can't follow the theme on its own:
  // the colors are read off the canvas below and handed to the drawing. That
  // reading has to happen again when the theme changes, and nothing about the
  // element changes to say that it has.
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

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
    const styles = getComputedStyle(canvas);
    const token = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;
    const colors: PlotColors = {
      bg: token('--plot-bg', '#ffffff'),
      ink: token('--plot-ink', '#111827'),
      grid: token('--plot-grid', '#9ca3af'),
      gridline: token('--plot-gridline', '#eceef1'),
      curve: token('--plot-curve', '#2563eb'),
      tangent: token('--plot-tangent', '#047857'),
    };
    drawGraph(ctx, size.width, size.height, {
      window: graphWindow,
      functionMode,
      angleMode,
      inverseMode,
      showTangent,
      currentPoint,
      selectedRatio,
      colors,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, dpr, theme, radians, functionMode, angleMode, inverseMode, graphWindow, showTangent]);


  function handlePointer(clientX: number, clientY: number, toStep = false) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const [mathX] = toMath(graphWindow, clientX - rect.left, clientY - rect.top, rect.width, rect.height);
    // Whole degrees, so dragging back and forth can't drift the angle - or the
    // settings' own step while shift is held, which is how to land on 30 or 45
    // exactly without reaching for the steppers.
    const step = api.angleStepDegrees;
    const place = (d: number) => api.setDegreesSnapped(toStep ? Math.round(d / step) * step : d);
    if (!inverseMode) {
      // x is the angle itself, in whichever unit the axis is showing
      place(angleMode === AngleMode.Degrees ? mathX : (mathX * 180) / PI);
    } else {
      // x is the input ratio; the angle comes back out of the arc function.
      // Clicking past the end of the curve pulls the point to the endpoint
      // rather than doing nothing at all.
      const { radians: r, ok } = getRadians(functionMode, clampToArcDomain(functionMode, mathX));
      if (ok) place((r * 180) / PI);
    }
  }

  /** The point written as the equation it stands for, the way the circle panel
   *  writes the same fact - a pair of bracketed numbers said which point it is
   *  but not what it means. Each side takes the Function settings' places for
   *  what it is: the angle its angle places, the ratio its result places. */
  function readoutText(): string {
    const angleText = displayAngle(degrees, angleMode, anglePlaces);
    const name = TRIG_FUNCTION_LABELS[functionMode];
    // An arc function's input is the ratio, and at an angle where the ratio
    // doesn't exist there is nothing to put in the brackets - no point on the
    // curve either, which is why none is drawn. Writing Arccot(Undefined) =
    // 180 claimed an answer to a question that was never asked; the fact worth
    // stating is the one that went wrong, which is Cot(180) itself.
    if (selectedRatio.isUndefined) return `${name}(${angleText}) = Undefined`;
    if (inverseMode) {
      return `${arcFunctionName(functionMode)}(${formatNumber(currentPoint.xval, resultPlaces)}) = ${angleText}`;
    }
    return `${name}(${angleText}) = ${formatNumber(currentPoint.yval, resultPlaces)}`;
  }

  /** What the tangent's slope comes to, whenever a tangent has been asked
   *  for. It says so even where there is no slope to give: the alternative
   *  was the line vanishing, which reads as the answer being zero rather than
   *  absent, and takes its place in the row with it. Only the point being off
   *  the window leaves the number standing without its line, and the slope is
   *  a fact about the function there whether or not the plot reaches it. */
  function slopeText(): string | null {
    if (!showTangent) return null;
    if (selectedRatio.isUndefined) return 'slope undefined';
    const slope = slopeAt(functionMode, inverseMode, angleMode, currentPoint.xval);
    // "=" rather than "approximately": the derivative is exact, and what is
    // shown is rounded to the same places as every other number in the app,
    // all of which are written with an equals sign
    if (Number.isFinite(slope)) return `slope = ${formatNumber(slope, resultPlaces)}`;
    // vertical, where arcsine and friends meet the ends of their domain
    return slope > 0 ? 'slope → ∞' : 'slope → -∞';
  }

  return (
    <div className="function-graph">
      <div className="function-graph__toolbar">
        {/* the same button either way: while a sweep runs it is the thing
            that stops it, rather than leaving that to a tap anywhere */}
        <button
          type="button"
          className="icon-button function-graph__play"
          onClick={sweeping ? stopSweep : startSweep}
          aria-label={sweeping ? 'Stop the sweep' : 'Sweep the point across the graph'}
          title={sweeping ? 'Stop the sweep' : 'Sweep the point across the graph'}
        >
          {sweeping ? <StopIcon /> : <PlayIcon />}
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
          } plotted from ${graphWindow.xMin} to ${graphWindow.xMax}. ${readoutText()}. Drag to move the point, holding shift to snap it to the angle step; the angle can also be typed into the Functions panel.`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
            handlePointer(e.clientX, e.clientY, e.shiftKey);
          }}
          onPointerMove={(e) => {
            if (dragging.current) handlePointer(e.clientX, e.clientY, e.shiftKey);
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
