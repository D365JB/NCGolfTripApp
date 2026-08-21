import type { FormatScore, HoleInfo, HoleScore } from '../types';
import { buildHoleNets, ballNet } from './common';

export interface TeamBallSide {
  players: { courseHandicap: number }[];
  scores: HoleScore[]; // the single team ball
}

/**
 * 2-man foursomes (alternate shot) match play. Team allowance is 50% of the
 * combined Course Handicaps, then reduced so the lower team plays off scratch.
 */
export function scoreFoursomes2(
  holes: HoleInfo[],
  a: TeamBallSide,
  b: TeamBallSide,
  totalHoles: number,
): FormatScore {
  const teamA = Math.round(0.5 * (a.players[0].courseHandicap + a.players[1].courseHandicap));
  const teamB = Math.round(0.5 * (b.players[0].courseHandicap + b.players[1].courseHandicap));
  const baseline = Math.min(teamA, teamB);
  const sA = teamA - baseline;
  const sB = teamB - baseline;

  const holeNets = buildHoleNets(
    holes,
    (h) => ballNet(a.scores, sA, h, totalHoles),
    (h) => ballNet(b.scores, sB, h, totalHoles),
  );

  return { holeNets, sideAStrokes: [sA], sideBStrokes: [sB] };
}
