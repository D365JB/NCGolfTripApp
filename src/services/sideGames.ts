import { scoreSkins, scoreNassau, courseHandicap } from '../domain/scoring';
import { isTeamBallFormat } from '../domain/model';
import type { Course, GolfSession, Match, MatchParticipant, Player, Score } from '../domain/model';
import { computeMatch } from './scoring';

function nameOf(players: Map<string, Player>, id: string): string {
  const p = players.get(id);
  return p ? `${p.firstName} ${p.lastName}` : 'Unknown';
}

export interface SkinsRow {
  playerId: string;
  name: string;
  skins: number;
}
export interface SkinsHole {
  hole: number;
  name: string | null;
  skins: number;
  carried: boolean;
}
export interface SkinsSummary {
  rows: SkinsRow[];
  carry: number;
  holes: SkinsHole[];
  playerCount: number;
}

/** Group skins for one round: lowest net/gross per hole wins; ties carry forward. */
export function skinsForSession(params: {
  session: GolfSession;
  matches: Match[];
  participants: MatchParticipant[];
  scores: Score[];
  players: Map<string, Player>;
  course: Course;
  mode: 'net' | 'gross';
}): SkinsSummary {
  const { session, matches, participants, scores, players, course, mode } = params;
  const matchIds = new Set(
    matches.filter((m) => m.sessionId === session.id && !isTeamBallFormat(m.format)).map((m) => m.id),
  );
  const partPlayer = new Map<string, string>();
  for (const p of participants) if (matchIds.has(p.matchId)) partPlayer.set(p.id, p.playerId);

  const byPlayer = new Map<string, Map<number, number>>();
  for (const s of scores) {
    if (s.participantId == null) continue;
    const pid = partPlayer.get(s.participantId);
    if (!pid) continue;
    let hm = byPlayer.get(pid);
    if (!hm) {
      hm = new Map();
      byPlayer.set(pid, hm);
    }
    const cur = hm.get(s.hole);
    if (cur === undefined || s.gross < cur) hm.set(s.hole, s.gross);
  }

  const skinsPlayers = [...byPlayer.entries()].map(([pid, hm]) => {
    const pl = players.get(pid);
    return {
      playerId: pid,
      courseHandicap: pl
        ? courseHandicap(pl.handicapIndex, {
            courseRating: course.courseRating,
            slopeRating: course.slopeRating,
            par: course.par,
          })
        : 0,
      scores: [...hm.entries()].map(([hole, gross]) => ({ hole, gross })),
    };
  });

  const holes = course.holes.map((h) => ({ hole: h.hole, par: h.par, strokeIndex: h.strokeIndex }));
  const res = scoreSkins(holes, skinsPlayers, { mode, allowancePercent: 100 });

  const rows: SkinsRow[] = skinsPlayers
    .map((sp) => ({ playerId: sp.playerId, name: nameOf(players, sp.playerId), skins: res.skinsWon[sp.playerId] ?? 0 }))
    .sort((a, b) => b.skins - a.skins || a.name.localeCompare(b.name));
  const holesOut: SkinsHole[] = res.holes.map((h) => ({
    hole: h.hole,
    name: h.winner ? nameOf(players, h.winner) : null,
    skins: h.skins,
    carried: h.carried,
  }));
  return { rows, carry: res.unresolvedCarry, holes: holesOut, playerCount: skinsPlayers.length };
}

export interface NassauView {
  matchId: string;
  matchName: string;
  aLabel: string;
  bLabel: string;
  bets: { name: string; status: string; a: number; b: number }[];
  totals: { a: number; b: number };
}

/** Nassau (Front/Back/Total + optional presses) for a single a-vs-b match. */
export function nassauForMatch(params: {
  match: Match;
  course: Course;
  participants: MatchParticipant[];
  players: Map<string, Player>;
  scores: Score[];
  betValue: number;
  autoPressDownBy?: number;
}): NassauView {
  const { match, course, participants, players, scores, betValue, autoPressDownBy } = params;
  const res = computeMatch({ match, course, participants, players, scores });
  const n = scoreNassau(res.holeNets, { betValue, autoPressDownBy });
  const names = (side: 'a' | 'b') =>
    participants
      .filter((p) => p.side === side)
      .map((p) => {
        const pl = players.get(p.playerId);
        return pl ? `${pl.firstName} ${pl.lastName[0]}.` : '—';
      })
      .join(' & ') || '—';
  return {
    matchId: match.id,
    matchName: match.name,
    aLabel: names('a'),
    bLabel: names('b'),
    bets: n.bets.map((b) => ({ name: b.name, status: b.status, a: b.a, b: b.b })),
    totals: n.totals,
  };
}
