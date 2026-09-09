// The little up/down pair that tucks against a number field's inner right
// edge. Shared by the angle fields on the Functions panel and the radius in
// Circle Settings so they look and behave the same in both places.
//
// The field's own wrapper supplies the position: relative this anchors to,
// and the right-hand padding that keeps the digits clear of the arrows.

import './Stepper.css';

export default function Stepper({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  return (
    <div className="stepper">
      <button type="button" className="stepper__button" onClick={onUp} aria-label="increase" tabIndex={-1}>
        ▲
      </button>
      <button type="button" className="stepper__button" onClick={onDown} aria-label="decrease" tabIndex={-1}>
        ▼
      </button>
    </div>
  );
}
