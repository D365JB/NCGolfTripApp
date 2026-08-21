import Dexie, { type Table } from 'dexie';
import type {
  Course,
  EventPlayer,
  EventTeam,
  GolfEvent,
  GolfSession,
  Match,
  MatchParticipant,
  Player,
  Score,
  TeamIdentity,
} from '../domain/model';

export class GolfDB extends Dexie {
  players!: Table<Player, string>;
  teamIdentities!: Table<TeamIdentity, string>;
  courses!: Table<Course, string>;
  events!: Table<GolfEvent, string>;
  eventTeams!: Table<EventTeam, string>;
  eventPlayers!: Table<EventPlayer, string>;
  sessions!: Table<GolfSession, string>;
  matches!: Table<Match, string>;
  participants!: Table<MatchParticipant, string>;
  scores!: Table<Score, string>;

  constructor() {
    super('nc-golf-trip');
    this.version(1).stores({
      players: 'id, lastName',
      teamIdentities: 'id, name',
      courses: 'id, name, state',
      events: 'id, startDate, status',
      eventTeams: 'id, eventId',
      eventPlayers: 'id, eventId, teamId, playerId',
      sessions: 'id, eventId, sequence',
      matches: 'id, eventId, sessionId, status',
      participants: 'id, matchId, playerId',
      scores: 'id, matchId, [matchId+side+hole], [matchId+participantId+hole], participantId',
    });
  }
}

export const db = new GolfDB();

export function newId(): string {
  return crypto.randomUUID();
}
