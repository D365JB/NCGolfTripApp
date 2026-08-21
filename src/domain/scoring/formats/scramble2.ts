import type { FormatScore, HoleInfo, HoleScore } from '../types';
import { buildHoleNets, ballNet } from './common';

export interface ScrambleSide {
  players: { courseHandicap: number }[];
  scores: HoleScore[]; // the single team ball
}

export interface ScrambleAllowance {
  low: number; // % of the lower Course Handicap
  high: number; // % of the higher Course Handicap
}

export const DEFAULT_SCRAMBLE_ALLOWANCE: ScrambleAllowance = { low: 35, high: 15 };

function teamHandicap(
  players: { courseHandicap: number }[],
  allowance: ScrambleAllowance,
): number {
  const chs = players.map((p) => p.courseHandicap);
  const low = Math.min(...chs);
  const high = Math.max(...chs);
  return Math.round((allowance.low / 100) * low + (allowance.high / 100) * high);
}

/**
 * 2-man scramble match play. Committee-recommended (configurable) team allowance
 * of 35% low + 15% high Course Handicap, reduced so the lower team is scratch.
 */
export function scoreScramble2(
  holes: HoleInfo[],
  a: ScrambleSide,
  b: ScrambleSide,
  totalHoles: number,
  allowance: ScrambleAllowance = DEFAULT_SCRAMBLE_ALLOWANCE,
): FormatScore {
  const teamA = teamHandicap(a.players, allowance);
  const teamB = teamHandicap(b.players, allowance);
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
