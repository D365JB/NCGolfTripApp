import type { MatchResult, PointsConfig, Side } from './types';

/** Ryder Cup default: win = 1 point, tie = 0.5 point. */
export const DEFAULT_POINTS: PointsConfig = { win: 1, tie: 0.5 };

/** Points awarded to each side for a decided match result. */
export function pointsForResult(
  result: MatchResult,
  pointsValue: number,
  cfg: PointsConfig = DEFAULT_POINTS,
): { a: number; b: number } {
  if (result === 'tie') {
    const half = pointsValue * cfg.tie;
    return { a: half, b: half };
  }
  const won = pointsValue * cfg.win;
  return result === 'a' ? { a: won, b: 0 } : { a: 0, b: won };
}

export type { Side };
