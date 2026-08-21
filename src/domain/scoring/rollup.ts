import type { MatchResult, PointsConfig, Side } from './types';
import { DEFAULT_POINTS, pointsForResult } from './points';

export interface MatchForRollup {
  pointsValue: number;
  result: MatchResult | null; // null = undecided
}

export interface EventStandings {
  teamA: number;
  teamB: number;
  totalAvailable: number;
  awarded: number;
  remaining: number;
  clinched: MatchResult | null; // which team has mathematically clinched, or 'tie' when all done level
  pointsToClinch: number; // a team securing strictly more than this wins outright
}

/**
 * Roll match results up into event standings and detect a mathematical clinch.
 * Assumes win points are fully redistributed on a tie (win === 2 * tie), as in
 * the Ryder Cup default, so total available points equals the sum of point values.
 */
export function rollupStandings(
  matches: MatchForRollup[],
  cfg: PointsConfig = DEFAULT_POINTS,
): EventStandings {
  let teamA = 0;
  let teamB = 0;
  let totalAvailable = 0;
  let remaining = 0;

  for (const m of matches) {
    totalAvailable += m.pointsValue * cfg.win;
    if (m.result === null) {
      remaining += m.pointsValue * cfg.win;
      continue;
    }
    const p = pointsForResult(m.result, m.pointsValue, cfg);
    teamA += p.a;
    teamB += p.b;
  }

  const awarded = teamA + teamB;
  const pointsToClinch = totalAvailable / 2;

  let clinched: MatchResult | null = null;
  if (teamA > pointsToClinch) clinched = 'a';
  else if (teamB > pointsToClinch) clinched = 'b';
  else if (remaining === 0) clinched = teamA === teamB ? 'tie' : teamA > teamB ? 'a' : 'b';

  return { teamA, teamB, totalAvailable, awarded, remaining, clinched, pointsToClinch };
}

export type { Side };
