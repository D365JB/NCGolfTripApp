import { resolveMatch } from '../matchPlay';
import type { HoleNet } from '../types';

type R = 'a' | 'b' | 'h';

/** Build hole nets: 'a' = A wins, 'b' = B wins, 'h' = halved. */
function nets(spec: R[]): HoleNet[] {
  return spec.map((r, i) => ({
    hole: i + 1,
    netA: r === 'a' ? 3 : r === 'b' ? 5 : 4,
    netB: r === 'b' ? 3 : r === 'a' ? 5 : 4,
  }));
}

function repeat(n: number, fn: (i: number) => R): R[] {
  return Array.from({ length: n }, (_, i) => fn(i));
}

describe('resolveMatch', () => {
  it('closes out 3&2', () => {
    const s = resolveMatch(nets(repeat(16, (i) => (i < 3 ? 'a' : 'h'))), 18);
    expect(s.result).toBe('a');
    expect(s.status).toBe('3&2');
    expect(s.decided).toBe(true);
    expect(s.holesPlayed).toBe(16);
  });

  it('closes out 2&1', () => {
    const s = resolveMatch(nets(repeat(17, (i) => (i < 2 ? 'a' : 'h'))), 18);
    expect(s.result).toBe('a');
    expect(s.status).toBe('2&1');
  });

  it('wins 1 UP on the 18th', () => {
    const s = resolveMatch(nets(repeat(18, (i) => (i === 0 ? 'a' : 'h'))), 18);
    expect(s.result).toBe('a');
    expect(s.status).toBe('1 UP');
    expect(s.holesRemaining).toBe(0);
  });

  it('halves the match (AS)', () => {
    const s = resolveMatch(nets(repeat(18, () => 'h')), 18);
    expect(s.result).toBe('tie');
    expect(s.status).toBe('AS');
  });

  it('reports in-progress when holes remain', () => {
    const s = resolveMatch(nets(repeat(10, (i) => (i < 2 ? 'a' : 'h'))), 18);
    expect(s.decided).toBe(false);
    expect(s.result).toBeNull();
    expect(s.status).toBe('2 UP');
    expect(s.leader).toBe('a');
  });

  it('lets side B win', () => {
    const s = resolveMatch(nets(repeat(16, (i) => (i < 3 ? 'b' : 'h'))), 18);
    expect(s.result).toBe('b');
    expect(s.status).toBe('3&2');
  });
});
