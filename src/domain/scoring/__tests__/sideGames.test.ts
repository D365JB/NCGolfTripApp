import { scoreSkins } from '../sideGames/skins';
import { scoreNassau } from '../sideGames/nassau';
import type { HoleInfo, HoleNet, HoleScore } from '../types';

function course(): HoleInfo[] {
  return Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, par: 4, strokeIndex: i + 1 }));
}
function scores(overrides: Record<number, number>, base = 4): HoleScore[] {
  return Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, gross: overrides[i + 1] ?? base }));
}

type R = 'a' | 'b' | 'h';
function nets(spec: R[]): HoleNet[] {
  return spec.map((r, i) => ({
    hole: i + 1,
    netA: r === 'a' ? 3 : r === 'b' ? 5 : 4,
    netB: r === 'b' ? 3 : r === 'a' ? 5 : 4,
  }));
}

describe('scoreSkins (gross)', () => {
  it('awards a unique low score and carries ties forward', () => {
    const players = [
      { playerId: 'p1', courseHandicap: 0, scores: scores({ 1: 3, 3: 3 }) },
      { playerId: 'p2', courseHandicap: 0, scores: scores({}) },
      { playerId: 'p3', courseHandicap: 0, scores: scores({ 2: 5 }) },
    ];
    const r = scoreSkins(course(), players, { mode: 'gross' });
    expect(r.skinsWon.p1).toBe(3); // hole 1 (1 skin) + hole 3 (1 + carried 1 = 2)
    expect(r.skinsWon.p2).toBe(0);
    expect(r.skinsWon.p3).toBe(0);
    expect(r.unresolvedCarry).toBe(15); // holes 4-18 all halve and carry
  });

  it('applies net strokes so a higher handicap can win a skin', () => {
    const players = [
      { playerId: 'low', courseHandicap: 0, scores: scores({ 1: 4 }) },
      { playerId: 'high', courseHandicap: 18, scores: scores({ 1: 4 }) },
    ];
    const r = scoreSkins(course(), players, { mode: 'net' });
    // On SI 1, 'high' gets a stroke -> net 3 beats 4
    expect(r.holes[0].winner).toBe('high');
  });
});

describe('scoreNassau', () => {
  const spec: R[] = [
    'a', 'a', 'a', 'a', 'a', 'h', 'h', 'h', 'h', // front: A wins 5
    'b', 'b', 'b', 'b', 'b', 'h', 'h', 'h', 'h', // back: B wins 5
  ];

  it('settles front, back and total bets', () => {
    const r = scoreNassau(nets(spec));
    expect(r.bets).toHaveLength(3);
    expect(r.bets[0].result).toBe('a');
    expect(r.bets[1].result).toBe('b');
    expect(r.bets[2].result).toBe('tie');
    expect(r.totals).toEqual({ a: 1, b: 1 });
  });

  it('adds an auto-press when a side goes 2 down', () => {
    const r = scoreNassau(nets(spec), { autoPressDownBy: 2 });
    expect(r.bets).toHaveLength(4);
    expect(r.bets[3].name).toBe('Press (from 3)');
  });
});
