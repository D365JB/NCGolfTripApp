import type { FormatScore, HoleInfo, HoleScore } from '../types';
import { playingHandicap } from '../courseHandicap';
import { strokesReceivedOnHole } from '../strokeAllocation';
import { buildHoleNets, grossOnHole, type SideNetFn } from './common';

export interface FourBallPlayer {
  courseHandicap: number;
  scores: HoleScore[];
}
export interface FourBallSide {
  players: FourBallPlayer[];
}

/**
 * 2-man best ball (four-ball) match play. Allowance 90% per player, then every
 * player is reduced by the lowest Course Handicap in the match (low = scratch).
 * A side's hole score is the lower net of its two players.
 */
export function scoreBestBall2(
  holes: HoleInfo[],
  a: FourBallSide,
  b: FourBallSide,
  totalHoles: number,
  allowancePercent = 90,
): FormatScore {
  const unitsA = a.players.map((p) => playingHandicap(p.courseHandicap, allowancePercent));
  const unitsB = b.players.map((p) => playingHandicap(p.courseHandicap, allowancePercent));
  const baseline = Math.min(...unitsA, ...unitsB);
  const sA = unitsA.map((u) => u - baseline);
  const sB = unitsB.map((u) => u - baseline);

  const sideNet = (side: FourBallSide, strokes: number[]): SideNetFn => (h) => {
    const nets: number[] = [];
    side.players.forEach((p, i) => {
      const g = grossOnHole(p.scores, h.hole);
      if (g !== undefined) {
        nets.push(g - strokesReceivedOnHole(strokes[i], h.strokeIndex, totalHoles));
      }
    });
    return nets.length ? Math.min(...nets) : undefined;
  };

  const holeNets = buildHoleNets(holes, sideNet(a, sA), sideNet(b, sB));
  return { holeNets, sideAStrokes: sA, sideBStrokes: sB };
}
