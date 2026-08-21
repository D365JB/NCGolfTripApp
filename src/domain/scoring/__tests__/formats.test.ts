import { scoreMatch } from '../scoreMatch';
import { scoreBestBall2 } from '../formats/bestBall2';
import { scoreFoursomes2 } from '../formats/foursomes2';
import { scoreScramble2 } from '../formats/scramble2';
import type { HoleInfo, HoleScore } from '../types';

/** 18 holes, par 4, Stroke Index equal to hole number (hole 1 hardest). */
function course(): HoleInfo[] {
  return Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, par: 4, strokeIndex: i + 1 }));
}
function evenScores(gross: number): HoleScore[] {
  return Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, gross }));
}

describe('singles 1v1 (100%)', () => {
  it('gives the higher handicap the difference and lets strokes decide', () => {
    const res = scoreMatch({
      format: 'singles_1v1',
      holes: course(),
      sideA: { players: [{ courseHandicap: 5, scores: evenScores(4) }] },
      sideB: { players: [{ courseHandicap: 10, scores: evenScores(4) }] },
    });
    expect(res.sideAStrokes).toEqual([0]);
    expect(res.sideBStrokes).toEqual([5]);
    expect(res.state.result).toBe('b');
    // B is 5 up with 4 to play -> closed out as "5&4"
    expect(res.state.status).toBe('5&4');
  });
});

describe('best ball / four-ball (90%, reduced to low)', () => {
  it('computes per-player strokes reduced to the lowest in the match', () => {
    const r = scoreBestBall2(
      course(),
      {
        players: [
          { courseHandicap: 10, scores: [] },
          { courseHandicap: 8, scores: [] },
        ],
      },
      {
        players: [
          { courseHandicap: 6, scores: [] },
          { courseHandicap: 4, scores: [] },
        ],
      },
      18,
    );
    // 90% units: 9, 7, 5, 4 ; baseline 4 => 5, 3, 1, 0
    expect(r.sideAStrokes).toEqual([5, 3]);
    expect(r.sideBStrokes).toEqual([1, 0]);
  });
});

describe('foursomes / alternate shot (50% combined)', () => {
  it('halves combined handicaps and reduces to the low team', () => {
    const r = scoreFoursomes2(
      course(),
      { players: [{ courseHandicap: 10 }, { courseHandicap: 6 }], scores: evenScores(4) },
      { players: [{ courseHandicap: 4 }, { courseHandicap: 2 }], scores: evenScores(4) },
      18,
    );
    // teamA = 8, teamB = 3, baseline 3 => 5 and 0
    expect(r.sideAStrokes).toEqual([5]);
    expect(r.sideBStrokes).toEqual([0]);
  });
});

describe('scramble 2-man (35% low + 15% high)', () => {
  it('applies the committee allowance and reduces to the low team', () => {
    const r = scoreScramble2(
      course(),
      { players: [{ courseHandicap: 8 }, { courseHandicap: 20 }], scores: evenScores(4) },
      { players: [{ courseHandicap: 2 }, { courseHandicap: 4 }], scores: evenScores(4) },
      18,
    );
    // teamA = round(2.8 + 3.0) = 6 ; teamB = round(0.7 + 0.6) = 1 ; baseline 1 => 5 and 0
    expect(r.sideAStrokes).toEqual([5]);
    expect(r.sideBStrokes).toEqual([0]);
  });
});

describe('scoreMatch dispatch (team-ball input)', () => {
  it('resolves a scramble through the unified entry point', () => {
    const res = scoreMatch({
      format: 'scramble_2',
      holes: course(),
      sideA: { players: [{ courseHandicap: 8 }, { courseHandicap: 20 }], teamScores: evenScores(4) },
      sideB: { players: [{ courseHandicap: 2 }, { courseHandicap: 4 }], teamScores: evenScores(4) },
    });
    expect(res.sideAStrokes).toEqual([5]);
    expect(res.state.result).toBe('a');
    expect(res.state.status).toBe('5&4');
  });
});
