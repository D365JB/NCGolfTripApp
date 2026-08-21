import type { FormatScore, HoleInfo, HoleScore } from '../types';
import { buildHoleNets, ballNet } from './common';

export interface SinglesSide {
  courseHandicap: number;
  scores: HoleScore[];
}

/**
 * 1v1 singles match play. Allowance 100%: each player's Playing Handicap is their
 * Course Handicap (rounded); the low plays off scratch and the higher receives the
 * full difference.
 */
export function scoreSingles(
  holes: HoleInfo[],
  a: SinglesSide,
  b: SinglesSide,
  totalHoles: number,
): FormatScore {
  const phA = Math.round(a.courseHandicap);
  const phB = Math.round(b.courseHandicap);
  const baseline = Math.min(phA, phB);
  const sA = phA - baseline;
  const sB = phB - baseline;

  const holeNets = buildHoleNets(
    holes,
    (h) => ballNet(a.scores, sA, h, totalHoles),
    (h) => ballNet(b.scores, sB, h, totalHoles),
  );

  return { holeNets, sideAStrokes: [sA], sideBStrokes: [sB] };
}
