import { rollupStandings } from '../rollup';

describe('rollupStandings', () => {
  it('totals decided matches and tracks remaining points', () => {
    const s = rollupStandings([
      { pointsValue: 1, result: 'a' },
      { pointsValue: 1, result: 'b' },
      { pointsValue: 1, result: 'tie' },
      { pointsValue: 1, result: null },
    ]);
    expect(s.teamA).toBe(1.5);
    expect(s.teamB).toBe(1.5);
    expect(s.totalAvailable).toBe(4);
    expect(s.remaining).toBe(1);
    expect(s.clinched).toBeNull();
  });

  it('detects a mathematical clinch', () => {
    const s = rollupStandings([
      { pointsValue: 1, result: 'a' },
      { pointsValue: 1, result: 'a' },
      { pointsValue: 1, result: 'a' },
      { pointsValue: 1, result: null },
    ]);
    expect(s.teamA).toBe(3);
    expect(s.clinched).toBe('a');
  });

  it('detects a final tie', () => {
    const s = rollupStandings([
      { pointsValue: 1, result: 'a' },
      { pointsValue: 1, result: 'b' },
    ]);
    expect(s.clinched).toBe('tie');
  });
});
