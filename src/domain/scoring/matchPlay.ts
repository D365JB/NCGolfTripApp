import type { HoleNet, MatchState, Side } from './types';

/**
 * Resolve a match-play contest from hole-by-hole net scores.
 * Handles early close-out ("3&2"), final margins ("2 UP"), halved matches
 * ("AS"), and in-progress states when not all holes are entered yet.
 */
export function resolveMatch(holeNets: HoleNet[], totalHoles = 18): MatchState {
  const ordered = [...holeNets].sort((x, y) => x.hole - y.hole);

  let diff = 0; // positive = A up
  for (let i = 0; i < ordered.length; i++) {
    const { netA, netB } = ordered[i];
    if (netA < netB) diff++;
    else if (netB < netA) diff--;

    const holesPlayed = i + 1;
    const holesRemaining = totalHoles - holesPlayed;

    if (Math.abs(diff) > holesRemaining) {
      const up = Math.abs(diff);
      const status = holesRemaining === 0 ? `${up} UP` : `${up}&${holesRemaining}`;
      const winner: Side = diff > 0 ? 'a' : 'b';
      return {
        diff,
        leader: winner,
        holesPlayed,
        holesRemaining,
        decided: true,
        result: winner,
        status,
      };
    }
  }

  const holesPlayed = ordered.length;
  const holesRemaining = totalHoles - holesPlayed;
  const leader: Side | null = diff > 0 ? 'a' : diff < 0 ? 'b' : null;

  if (holesRemaining <= 0) {
    if (diff === 0) {
      return {
        diff,
        leader: null,
        holesPlayed,
        holesRemaining: 0,
        decided: true,
        result: 'tie',
        status: 'AS',
      };
    }
    const up = Math.abs(diff);
    const winner: Side = diff > 0 ? 'a' : 'b';
    return {
      diff,
      leader: winner,
      holesPlayed,
      holesRemaining: 0,
      decided: true,
      result: winner,
      status: `${up} UP`,
    };
  }

  const up = Math.abs(diff);
  return {
    diff,
    leader,
    holesPlayed,
    holesRemaining,
    decided: false,
    result: null,
    status: diff === 0 ? 'AS' : `${up} UP`,
  };
}
