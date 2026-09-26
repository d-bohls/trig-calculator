// What a drag lands on. The interesting part is the stretch a multiple holds:
// where it begins and ends, that it depends on which way the drag arrived, and
// that easing back a fraction inside it stays put.

import { describe, expect, it } from 'vitest';
import { snapApproachingAngle, type AngleHold } from './snapAngle';

/** Runs a path of pointer angles through the snapping, as a drag would. */
function drag(path: number[], step = 15): number[] {
  let hold: AngleHold | null = null;
  let previous: number | null = null;
  const seen: number[] = [];
  for (const degrees of path) {
    const next = snapApproachingAngle(degrees, previous, step, hold);
    hold = next.hold;
    previous = degrees;
    seen.push(next.degrees);
  }
  return seen;
}

describe('snapApproachingAngle', () => {
  it('takes a drag in at the usual half degree, coming up on a multiple', () => {
    // 59.4 is still 59 - the multiple grabs nothing early
    expect(drag([58.6, 59.4, 59.6, 59.9])).toEqual([59, 59, 60, 60]);
  });

  it('holds a whole degree past itself, going on', () => {
    expect(drag([59.6, 60.4, 60.9, 61.1])).toEqual([60, 60, 60, 61]);
  });

  it('does the same in reverse, coming down on it', () => {
    expect(drag([62, 61.4, 60.6, 60.4, 59.2, 58.9])).toEqual([62, 61, 61, 60, 60, 59]);
  });

  it('holds where it landed when the pointer eases back inside', () => {
    // arrived from below, so it holds from 59.5 to 61: easing back from 60.9
    // stays on 60 rather than dropping off
    expect(drag([59.6, 60.9, 60.6, 60.55])).toEqual([60, 60, 60, 60]);
    // and arrived from above it holds from 59 to 60.5
    expect(drag([60.6, 60.4, 59.2, 59.4])).toEqual([61, 60, 60, 60]);
  });

  it('drops off once the pointer leaves the stretch it landed in', () => {
    expect(drag([59.6, 60.9, 61.2])).toEqual([60, 60, 61]);
    expect(drag([60.6, 60.4, 58.9])).toEqual([61, 60, 59]);
  });

  it('leaves the degree before a multiple its full width', () => {
    // creeping up on 59 gets 59, where slack in front would have taken it
    expect(drag([58.2, 58.6, 59.2, 59.4])).toEqual([58, 59, 59, 59]);
    // and creeping down on 61 gets 61
    expect(drag([61.8, 61.4, 60.8, 60.6])).toEqual([62, 61, 61, 61]);
  });

  it('rounds when it cannot tell which way the drag is going', () => {
    expect(drag([59.6])).toEqual([60]);
    expect(drag([59.6, 59.6])).toEqual([60, 60]);
  });

  it('snaps to nothing when the step is too fine to mean anything', () => {
    for (const step of [1, 2, 3, 4]) {
      expect(drag([60.4, 60.9, 61.1], step)).toEqual([60, 61, 61]);
    }
  });

  it('works below zero, and never hands back a negative zero', () => {
    expect(drag([-58.6, -59.4, -59.6, -60.9])).toEqual([-59, -59, -60, -60]);
    expect(Object.is(drag([-1.2, -0.8])[1], -0)).toBe(false);
    expect(Object.is(drag([0.2, -0.2])[1], -0)).toBe(false);
  });
});
