import type { HoleNet, MatchResult } from '../types';
import { resolveMatch } from '../matchPlay';

export interface NassauOptions {
  betValue?: number;
  autoPressDownBy?: number; // start a new press when a side falls this many down
}

export interface NassauBet {
  name: string;
  result: MatchResult;
  status: string;
  a: number;
  b: number;
}

export interface NassauResult {
  bets: NassauBet[];
  totals: { a: number; b: number };
}

function segmentBet(name: string, holeNets: HoleNet[], holeCount: number, betValue: number): NassauBet {
  const state = resolveMatch(holeNets, holeCount);
  let a = 0;
  let b = 0;
  let result: MatchResult = 'tie';
  if (state.decided && state.result && state.result !== 'tie') {
    result = state.result;
    if (result === 'a') a = betValue;
    else b = betValue;
  }
  return { name, result, status: state.status, a, b };
}

/** Holes where a side newly reaches the press threshold; each starts a fresh bet. */
function autoPressStarts(ordered: HoleNet[], downBy: number): number[] {
  const starts: number[] = [];
  let diff = 0;
  let prevBelow = true;
  for (const h of ordered) {
    if (h.netA < h.netB) diff++;
    else if (h.netB < h.netA) diff--;
    const abs = Math.abs(diff);
    if (abs >= downBy && prevBelow) {
      const next = h.hole + 1;
      if (ordered.some((x) => x.hole >= next)) starts.push(next);
    }
    prevBelow = abs < downBy;
  }
  return starts;
}

/**
 * Nassau: three match-play bets — Front 9, Back 9, and Total 18 — with an
 * optional auto-press that opens a new bet (running to the finish) when a side
 * falls the configured number of holes down.
 */
export function scoreNassau(holeNets: HoleNet[], options: NassauOptions = {}): NassauResult {
  const betValue = options.betValue ?? 1;
  const ordered = [...holeNets].sort((a, b) => a.hole - b.hole);
  const front = ordered.filter((h) => h.hole <= 9);
  const back = ordered.filter((h) => h.hole >= 10 && h.hole <= 18);

  const bets: NassauBet[] = [
    segmentBet('Front 9', front, 9, betValue),
    segmentBet('Back 9', back, 9, betValue),
    segmentBet('Total 18', ordered, 18, betValue),
  ];

  if (options.autoPressDownBy && options.autoPressDownBy > 0) {
    for (const start of autoPressStarts(ordered, options.autoPressDownBy)) {
      const pressHoles = ordered.filter((h) => h.hole >= start);
      bets.push(segmentBet(`Press (from ${start})`, pressHoles, pressHoles.length, betValue));
    }
  }

  const totals = bets.reduce((t, bet) => ({ a: t.a + bet.a, b: t.b + bet.b }), { a: 0, b: 0 });
  return { bets, totals };
}
