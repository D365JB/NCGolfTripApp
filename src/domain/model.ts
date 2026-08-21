import type { MatchFormat, Side } from './scoring';

export type ID = string;
export type { MatchFormat, Side };

export interface Player {
  id: ID;
  firstName: string;
  lastName: string;
  handicapIndex: number;
  homeClub?: string;
  ghinNumber?: string;
  email?: string; // used to match a login to this profile
  role?: 'admin' | 'player'; // 'admin' may make setup & master changes; defaults to player
}

export interface TeamIdentity {
  id: ID;
  name: string;
  color: string; // hex
  logoDataUrl?: string;
}

export interface CourseHole {
  hole: number;
  par: number;
  strokeIndex: number;
  yardage?: number;
}

export interface Course {
  id: ID;
  name: string;
  city?: string;
  state: string;
  par: number;
  courseRating: number;
  slopeRating: number;
  holes: CourseHole[];
  source: 'manual' | 'api';
  externalId?: string;
}

export interface GolfEvent {
  id: ID;
  name: string;
  startDate: string;
  courseId: ID;
  status: 'setup' | 'active' | 'complete';
  pointsWin: number;
  pointsTie: number;
  createdAt: string;
}

export interface EventTeam {
  id: ID;
  eventId: ID;
  teamIdentityId?: ID;
  side: Side;
  name: string;
  color: string;
  logoDataUrl?: string;
}

export interface EventPlayer {
  id: ID;
  eventId: ID;
  teamId: ID;
  playerId: ID;
}

export interface GolfSession {
  id: ID;
  eventId: ID;
  name: string;
  date: string;
  sequence: number;
  courseId?: ID; // per-round course; falls back to the event course when unset
}

export interface Match {
  id: ID;
  eventId: ID;
  sessionId: ID;
  format: MatchFormat;
  name: string;
  numHoles: number;
  startHole: number;
  pointsValue: number;
  status: 'pending' | 'active' | 'final';
  scorerPlayerId?: ID; // the player responsible for entering this match's scores
}

export interface MatchParticipant {
  id: ID;
  matchId: ID;
  side: Side;
  playerId: ID;
}

export interface Score {
  id: ID;
  matchId: ID;
  side: Side;
  participantId?: ID; // undefined for team-ball formats (scramble, foursomes)
  hole: number;
  gross: number;
  putts?: number;
  fairwayHit?: boolean;
  updatedAt: string;
}

export const FORMAT_LABELS: Record<MatchFormat, string> = {
  singles_1v1: '1v1 Singles',
  best_ball_2: '2-Man Best Ball',
  best_ball_team: 'Team Best Ball',
  foursomes_2: 'Foursomes (Alt Shot)',
  scramble_2: '2-Man Scramble',
};

export const FORMAT_TEAM_SIZE: Record<MatchFormat, number> = {
  singles_1v1: 1,
  best_ball_2: 2,
  best_ball_team: 6,
  foursomes_2: 2,
  scramble_2: 2,
};

/** Team-ball formats share one ball per side; player formats score each player. */
export function isTeamBallFormat(format: MatchFormat): boolean {
  return format === 'scramble_2' || format === 'foursomes_2';
}
