import { parseTeamStructure } from '../rosterImport';
import type { EventTeam } from '../../domain/model';

const teamA: EventTeam = { id: 'A', eventId: 'e', side: 'a', name: 'Reds', color: '#b91c1c' };
const teamB: EventTeam = { id: 'B', eventId: 'e', side: 'b', name: 'Blues', color: '#1d4ed8' };

describe('parseTeamStructure', () => {
  it('parses a header + team/first/last/handicap/ghin', () => {
    const text = ['Team,First,Last,Handicap,GHIN', 'Reds,Rory,McIlroy,8.4,1234567', 'Blues,Jon,Rahm,5.2'].join('\n');
    const { golfers, skipped } = parseTeamStructure(text, teamA, teamB, 'A');
    expect(skipped).toBe(0);
    expect(golfers).toEqual([
      { teamId: 'A', firstName: 'Rory', lastName: 'McIlroy', handicapIndex: 8.4, ghinNumber: '1234567' },
      { teamId: 'B', firstName: 'Jon', lastName: 'Rahm', handicapIndex: 5.2, ghinNumber: undefined },
    ]);
  });

  it('handles a full-name column and team aliases (a/b)', () => {
    const { golfers } = parseTeamStructure('a, Bryson DeChambeau, 3.2\nb, Brooks Koepka, 4.8', teamA, teamB, 'A');
    expect(golfers[0]).toEqual({ teamId: 'A', firstName: 'Bryson', lastName: 'DeChambeau', handicapIndex: 3.2, ghinNumber: undefined });
    expect(golfers[1].teamId).toBe('B');
  });

  it('falls back to the chosen team when no team column is present', () => {
    const { golfers } = parseTeamStructure('Rory McIlroy, 8.4', teamA, teamB, 'B');
    expect(golfers[0]).toEqual({ teamId: 'B', firstName: 'Rory', lastName: 'McIlroy', handicapIndex: 8.4, ghinNumber: undefined });
  });

  it('skips blank/nameless rows', () => {
    const { golfers, skipped } = parseTeamStructure('Reds, , \nReds, Xander, Schauffele, 6.0', teamA, teamB, 'A');
    expect(golfers).toHaveLength(1);
    expect(skipped).toBe(1);
  });
});
