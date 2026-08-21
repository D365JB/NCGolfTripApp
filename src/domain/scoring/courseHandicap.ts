import type { TeeRating } from './types';

/**
 * WHS (2020+) Course Handicap:
 *   CH = HI x (Slope / 113) + (CourseRating - Par).
 */
export function courseHandicapExact(handicapIndex: number, tee: TeeRating): number {
  return handicapIndex * (tee.slopeRating / 113) + (tee.courseRating - tee.par);
}

/** Course Handicap rounded to the nearest integer (for display and stroke allocation). */
export function courseHandicap(handicapIndex: number, tee: TeeRating): number {
  return Math.round(courseHandicapExact(handicapIndex, tee));
}

/**
 * Playing Handicap = allowance% applied to the UNROUNDED Course Handicap, then
 * rounded (WHS Rule 6.2 / Appendix C). Pass the exact Course Handicap here.
 */
export function playingHandicap(courseHandicapValue: number, allowancePercent: number): number {
  return Math.round(courseHandicapValue * (allowancePercent / 100));
}
