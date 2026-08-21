import { courseHandicap, courseHandicapExact, playingHandicap } from '../courseHandicap';

describe('courseHandicap (WHS 2020+)', () => {
  it('applies HI x Slope/113 + (CR - Par)', () => {
    expect(courseHandicap(10.4, { slopeRating: 125, courseRating: 71.2, par: 72 })).toBe(11);
  });

  it('equals the index when Slope=113 and CR=Par', () => {
    expect(courseHandicap(18, { slopeRating: 113, courseRating: 72, par: 72 })).toBe(18);
  });

  it('supports plus handicaps', () => {
    expect(courseHandicap(-2, { slopeRating: 113, courseRating: 72, par: 72 })).toBe(-2);
  });
});

describe('playingHandicap allowances', () => {
  it('four-ball 90% rounds 9.9 to 10', () => {
    expect(playingHandicap(11, 90)).toBe(10);
  });

  it('50% of 20 is 10', () => {
    expect(playingHandicap(20, 50)).toBe(10);
  });
});

describe('WHS: allowances apply to the UNROUNDED Course Handicap', () => {
  const tee = { slopeRating: 113, courseRating: 72, par: 72 };

  it('exposes the unrounded Course Handicap', () => {
    expect(courseHandicapExact(10.5, tee)).toBeCloseTo(10.5);
  });

  it('rounds once (9), not twice (10), for a 90% four-ball allowance', () => {
    // Correct WHS: 90% of 10.5 = 9.45 -> 9.
    expect(playingHandicap(courseHandicapExact(10.5, tee), 90)).toBe(9);
    // The old double-rounding path (round CH to 11, then 90% -> 9.9 -> 10) would be wrong.
    expect(playingHandicap(courseHandicap(10.5, tee), 90)).toBe(10);
  });
});
