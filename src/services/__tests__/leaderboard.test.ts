import { describe, it, expect } from 'vitest';
import { individualLeaderboard } from '../leaderboard';
import type {
  Course,
  EventPlayer,
  EventTeam,
  Match,
  MatchParticipant,
  Player,
  Score,
} from '../../domain/model';

const holes = (parOverride?: { hole: number; par: number }) =>
  Array.from({ length: 18 }, (_, i) => ({
    hole: i + 1,
    par: parOverride && parOverride.hole === i + 1 ? parOverride.par : 4,
    strokeIndex: i + 1,
  }));

const courseA: Course = {
  id: 'A',
  name: 'A',
  state: 'NC',
  par: 72,
  courseRating: 72,
  slopeRating: 113,
  holes: holes(),
  source: 'manual',
};
const courseB: Course = {
  id: 'B',
  name: 'B',
  state: 'NC',
  par: 73,
  courseRating: 73,
  slopeRating: 113,
  holes: holes({ hole: 2, par: 5 }),
  source: 'manual',
};

const match = (id: string): Match => ({
  id,
  eventId: 'e',
  sessionId: id,
  format: 'singles_1v1',
  name: id,
  numHoles: 18,
  startHole: 1,
  pointsValue: 1,
  status: 'active',
});

const player: Player = { id: 'p1', firstName: 'Test', lastName: 'Golfer', handicapIndex: 0 };

describe('individualLeaderboard per-match course + no hole merging', () => {
  it('counts holes per match on each match course (not merged by hole number)', () => {
    const m1 = match('m1');
    const m2 = match('m2');
    const participants: MatchParticipant[] = [
      { id: 'pa1', matchId: 'm1', side: 'a', playerId: 'p1' },
      { id: 'pa2', matchId: 'm2', side: 'a', playerId: 'p1' },
    ];
    const scores: Score[] = [
      { id: 's1', matchId: 'm1', side: 'a', participantId: 'pa1', hole: 1, gross: 5, updatedAt: '' }, // A par4 -> +1
      { id: 's2', matchId: 'm2', side: 'a', participantId: 'pa2', hole: 1, gross: 3, updatedAt: '' }, // B par4 -> -1
      { id: 's3', matchId: 'm2', side: 'a', participantId: 'pa2', hole: 2, gross: 5, updatedAt: '' }, // B par5 -> 0
    ];
    const roster: EventPlayer[] = [{ id: 'ep1', eventId: 'e', teamId: 't', playerId: 'p1' }];
    const teams: EventTeam[] = [{ id: 't', eventId: 'e', side: 'a', name: 'Team', color: '#000' }];
    const courseFor = (m: Match): Course => (m.id === 'm2' ? courseB : courseA);

    const board = individualLeaderboard({
      players: new Map([[player.id, player]]),
      roster,
      teams,
      matches: [m1, m2],
      participants,
      scores,
      courseFor,
    });

    expect(board).toHaveLength(1);
    expect(board[0].thru).toBe(3); // both hole-1 scores counted + hole 2
    expect(board[0].toPar).toBe(0); // +1 -1 +0, using each course's par
  });
});
