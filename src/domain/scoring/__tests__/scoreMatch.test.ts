import { describe, it, expect } from 'vitest';
import { scoreMatch } from '../scoreMatch';
import type { HoleInfo } from '../types';

const holes: HoleInfo[] = Array.from({ length: 18 }, (_, i) => ({
  hole: i + 1,
  par: 4,
  strokeIndex: i + 1,
}));

describe('scoreMatch with incomplete lineups', () => {
  it('returns a neutral all-square result when a side has no players (singles)', () => {
    const r = scoreMatch({
      format: 'singles_1v1',
      holes,
      totalHoles: 18,
      sideA: { players: [] },
      sideB: { players: [{ courseHandicap: 10, scores: [] }] },
    });
    expect(r.state.decided).toBe(false);
    expect(r.state.result).toBeNull();
    expect(r.state.status).toBe('AS');
    expect(r.holeNets).toEqual([]);
  });

  it('does not throw for a team format with an empty side (scramble)', () => {
    expect(() =>
      scoreMatch({
        format: 'scramble_2',
        holes,
        totalHoles: 18,
        sideA: { players: [], teamScores: [] },
        sideB: { players: [{ courseHandicap: 5 }, { courseHandicap: 8 }], teamScores: [] },
      }),
    ).not.toThrow();
  });
});
