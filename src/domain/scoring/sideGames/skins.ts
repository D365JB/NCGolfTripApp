import type { HoleInfo, HoleScore } from '../types';
import { strokesReceivedOnHole } from '../strokeAllocation';
import { playingHandicap } from '../courseHandicap';

export interface SkinsPlayer {
  playerId: string;
  courseHandicap: number;
  scores: HoleScore[];
}

export interface SkinsOptions {
  mode?: 'net' | 'gross';
  skinValue?: number;
  allowancePercent?: number; // applied in net mode
}

export interface SkinHoleResult {
  hole: number;
  winner: string | null;
  skins: number; // skins awarded on this hole (includes carried skins)
  carried: boolean;
}

export interface SkinsResult {
  holes: SkinHoleResult[];
  skinsWon: Record<string, number>;
  value: Record<string, number>;
  unresolvedCarry: number;
}

/**
 * Skins: lowest (net or gross) score on a hole wins the skin; ties carry the
 * skin(s) forward to the next hole. Net mode allocates handicap strokes by index.
 */
export function scoreSkins(
  holes: HoleInfo[],
  players: SkinsPlayer[],
  options: SkinsOptions = {},
): SkinsResult {
  const mode = options.mode ?? 'net';
  const skinValue = options.skinValue ?? 1;
  const allowance = options.allowancePercent ?? 100;
  const totalHoles = holes.length;

  const strokesOf = new Map<string, number>();
  for (const p of players) strokesOf.set(p.playerId, playingHandicap(p.courseHandicap, allowance));

  const results: SkinHoleResult[] = [];
  const skinsWon: Record<string, number> = {};
  for (const p of players) skinsWon[p.playerId] = 0;

  let carry = 0;
  for (const h of [...holes].sort((a, b) => a.hole - b.hole)) {
    const entries: { playerId: string; value: number }[] = [];
    for (const p of players) {
      const gross = p.scores.find((s) => s.hole === h.hole)?.gross;
      if (gross === undefined) continue;
      const value =
        mode === 'gross'
          ? gross
          : gross - strokesReceivedOnHole(strokesOf.get(p.playerId) ?? 0, h.strokeIndex, totalHoles);
      entries.push({ playerId: p.playerId, value });
    }
    if (entries.length < 2) continue;

    const min = Math.min(...entries.map((e) => e.value));
    const winners = entries.filter((e) => e.value === min);
    const stake = 1 + carry;
    if (winners.length === 1) {
      skinsWon[winners[0].playerId] += stake;
      results.push({ hole: h.hole, winner: winners[0].playerId, skins: stake, carried: false });
      carry = 0;
    } else {
      results.push({ hole: h.hole, winner: null, skins: 0, carried: true });
      carry = stake;
    }
  }

  const value: Record<string, number> = {};
  for (const p of players) value[p.playerId] = skinsWon[p.playerId] * skinValue;

  return { holes: results, skinsWon, value, unresolvedCarry: carry };
}
