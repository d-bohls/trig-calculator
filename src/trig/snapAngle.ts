// Detents for dragging an angle, in the circle and along the graph's angle
// axis. Every angle still rounds to a whole degree; a multiple of the angle
// step gets a wider landing than the rest.

/** Below this the multiples are so close together that snapping to them says
 *  nothing - at a step of one degree, every degree is one. */
const MIN_STEP_FOR_DETENTS = 5;

/** How far a multiple takes a drag in before it, which is the ordinary
 *  rounding distance - it grabs nothing early. */
const CATCH = 0.5;

/** And how far it holds on past itself: a whole degree, rather than the half a
 *  plain degree gets. It borrows that half from the degree beyond, which keeps
 *  its own half on the far side of that. */
const HOLD = 1;

/** The stretch of pointer angles that a multiple holds, and which multiple.
 *  Set when the drag first lands on it, because where it ends depends on which
 *  way the drag arrived. */
export interface AngleHold {
  multiple: number;
  from: number;
  to: number;
}

export interface SnappedAngle {
  degrees: number;
  hold: AngleHold | null;
}

/**
 * Where to put the angle for a pointer at `degrees`, given where the pointer
 * was on the last move and whatever multiple the drag is currently sitting on.
 *
 * A multiple takes a drag in at the usual half degree and then holds it an
 * extra half degree past itself - so arriving at 60 from below it holds from
 * 59.5 to 61, and arriving from above it holds from 59 to 60.5. The slack is
 * behind rather than in front: you push through the multiple and it resists,
 * which is what a detent feels like, and the degree it borrows is the one
 * beyond it rather than the one you were creeping up on.
 *
 * The stretch is fixed on arrival and does not move with the pointer, so
 * easing back a fraction inside it stays put rather than dropping off; leaving
 * means leaving the stretch.
 */
export function snapApproachingAngle(
  degrees: number,
  previous: number | null,
  step: number,
  hold: AngleHold | null,
): SnappedAngle {
  if (!(step >= MIN_STEP_FOR_DETENTS)) return { degrees: whole(degrees), hold: null };
  if (hold && degrees >= hold.from && degrees <= hold.to) {
    return { degrees: hold.multiple, hold };
  }

  const travelling = previous === null ? 0 : degrees - previous;
  if (travelling !== 0) {
    const multiple = notMinusZero(Math.round(degrees / step) * step);
    const rising = travelling > 0;
    const from = multiple - (rising ? CATCH : HOLD);
    const to = multiple + (rising ? HOLD : CATCH);
    if (degrees >= from && degrees <= to) {
      return { degrees: multiple, hold: { multiple, from, to } };
    }
  }

  return { degrees: whole(degrees), hold: null };
}

function whole(degrees: number): number {
  return notMinusZero(Math.round(degrees));
}

/** Rounding anything in the last half degree below zero hands back -0, which
 *  prints as "-0.00" wherever it lands - and so does the multiple at zero,
 *  when the pointer comes at it from underneath. */
function notMinusZero(degrees: number): number {
  return degrees === 0 ? 0 : degrees;
}
