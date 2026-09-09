// Port of Forms/frmAutomation.frm

import { useEffect, useRef, useState } from 'react';
import type { CalculatorApi } from '../../state/useCalculatorState';
import { getCurrentGraphPoint } from '../../trig/currentPoint';
import { AngleMode, clampToArcDomain, getRadians, PI } from '../../trig/trigMath';
import Modal from '../Modal';
import './AutomationDialog.css';

export default function AutomationDialog({ api, onClose }: { api: CalculatorApi; onClose: () => void }) {
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const boundsRef = useRef<{ startX: number; stopX: number; dx: number } | null>(null);
  const newValRef = useRef(0);

  const { radians, degrees, angleMode, inverseMode, functionMode, graphWindow, selectedRatio, autoSpeed } = api;

  // the interval callback below outlives the render that started it, so it
  // can't read these off the closure - it would keep using whatever they were
  // when Begin was pressed (which is why changing the speed mid-run did
  // nothing). Keep a ref pointing at the current values and read that instead.
  const latest = useRef({ autoSpeed, inverseMode, angleMode, functionMode });
  useEffect(() => {
    latest.current = { autoSpeed, inverseMode, angleMode, functionMode };
  }, [autoSpeed, inverseMode, angleMode, functionMode]);

  function stop() {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }

  useEffect(() => stop, []);

  function computeBounds() {
    const { xMin, xMax } = graphWindow;
    const dx = (xMax - xMin) / 500;
    let startX = xMin;
    let stopX = xMax;
    if (inverseMode) {
      // land on the domain edge rather than creeping up to it - stepping in
      // by dx until the function accepts the value stops one step short, so
      // arcsine used to begin at -84.9 degrees instead of -90
      startX = clampToArcDomain(functionMode, startX);
      stopX = clampToArcDomain(functionMode, stopX);
    } else {
      startX = dx * Math.round(startX / dx);
      stopX = dx * Math.round(stopX / dx);
    }
    if (startX < xMin) startX = xMin;
    if (stopX > xMax) stopX = xMax;
    return { startX, stopX, dx };
  }

  function applyXVal(xval: number) {
    const { inverseMode: inverse, angleMode: unit, functionMode: fn } = latest.current;
    if (!inverse) {
      const newRadians = unit === AngleMode.Degrees ? (xval * PI) / 180 : xval;
      api.setRadians(newRadians);
    } else {
      const { radians: r, ok } = getRadians(fn, xval);
      if (ok) api.setRadians(r);
    }
  }

  function reset() {
    stop();
    const bounds = computeBounds();
    boundsRef.current = bounds;
    applyXVal(bounds.startX);
  }

  function begin() {
    const { xval } = getCurrentGraphPoint({ radians, degrees, angleMode, inverseMode, ratio: selectedRatio });
    let bounds = boundsRef.current;
    if (!bounds || xval < bounds.startX || xval >= bounds.stopX - bounds.dx) {
      bounds = computeBounds();
      boundsRef.current = bounds;
      applyXVal(bounds.startX);
      newValRef.current = bounds.startX;
    } else {
      newValRef.current = xval;
    }
    setRunning(true);
    intervalRef.current = window.setInterval(() => {
      const b = boundsRef.current;
      if (!b) return;
      newValRef.current += 0.2 * latest.current.autoSpeed * b.dx;
      if (newValRef.current >= b.stopX) {
        // land on the end of the sweep rather than wherever the last whole
        // step happened to fall - a step short of the domain edge leaves
        // arcsine finishing near 89 degrees instead of on 90
        newValRef.current = b.stopX;
        applyXVal(b.stopX);
        stop();
      } else {
        applyXVal(newValRef.current);
      }
    }, 16);
  }

  return (
    <Modal title="Automation" onClose={onClose} blocking={false}>
      <div className="automation-dialog">
        <div className="automation-dialog__speed">
          <label>Speed</label>
          <div className="automation-dialog__speed-row">
            <span>Slow</span>
            <input
              type="range"
              min={1}
              max={10}
              value={autoSpeed}
              onChange={(e) => api.setAutoSpeed(Number(e.target.value))}
            />
            <span>Fast</span>
          </div>
        </div>
        <div className="automation-dialog__actions">
          <button type="button" onClick={reset}>
            Reset
          </button>
          <button type="button" onClick={begin} disabled={running}>
            Begin
          </button>
          <button type="button" onClick={stop} disabled={!running}>
            Stop
          </button>
        </div>
      </div>
    </Modal>
  );
}
