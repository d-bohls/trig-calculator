// The minus/plus pair that sits beside a number field. Shared by the angle
// fields on the Functions panel and the whole-number settings, so they look and
// behave the same in both places, and matching the period control below them.
//
// Side by side rather than stacked: two arrows above one another can never both
// be a comfortable touch target, because they compete for the same height. In a
// row each can reach the 44px a finger wants, which Stepper.css does on coarse
// pointers only, leaving them compact for a mouse.

import './Stepper.css';

export default function Stepper({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  return (
    <div className="stepper">
      <button type="button" className="stepper__button" onClick={onDown} aria-label="decrease" tabIndex={-1}>
        &minus;
      </button>
      <button type="button" className="stepper__button" onClick={onUp} aria-label="increase" tabIndex={-1}>
        +
      </button>
    </div>
  );
}
