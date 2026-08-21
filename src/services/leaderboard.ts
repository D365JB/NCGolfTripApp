import { courseHandicap, strokesReceivedOnHole } from '../domain/scoring';
import { isTeamBallFormat } from '../domain/model';
import type {
  Course,
  EventPlayer,
  EventTeam,
  Match,
  MatchParticipant,
  Player,
  Score,
} from '../domain/model';

export interface BoardEntry {
  playerId: string;
  name: string;
  team?: EventTeam;
  thru: number;
  toPar: number;
  position: number;
  positionLabel: string; // "1", "T2", or "–" when not started
  started: boolean;
}

/**
 * Individual net-to-par leaderboard for the TV board. Aggregates each player's net
 * across their individual-ball matches (singles + best ball), taking strokes and par
 * from THAT match's course. Team-ball (scramble/foursomes) scores are excluded since
 * they can't be attributed to one player. Holes are counted per match — never merged
 * by hole number across matches.
 */
export function individualLeaderboard(params: {
  players: Map<string, Player>;
  roster: EventPlayer[];
  teams: EventTeam[];
  matches: Match[];
  participants: MatchParticipant[];
  scores: Score[];
  courseFor: (match: Match) => Course;
}): BoardEntry[] {
  const { players, roster, teams, matches, participants, scores, courseFor } = params;
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const matchById = new Map(matches.map((m) => [m.id, m]));

  // participantId -> its player + match, for individual-ball matches only.
  const partInfo = new Map<string, { playerId: string; match: Match }>();
  for (const p of participants) {
    const m = matchById.get(p.matchId);
    if (!m || isTeamBallFormat(m.format)) continue;
    partInfo.set(p.id, { playerId: p.playerId, match: m });
  }

  // Sum net-to-par and holes played per player across their individual matches.
  const agg = new Map<string, { toPar: number; thru: number }>();
  for (const s of scores) {
    if (s.participantId == null) continue;
    const info = partInfo.get(s.participantId);
    if (!info) continue;
    const player = players.get(info.playerId);
    if (!player) continue;
    const course = courseFor(info.match);
    const holeMeta = course.holes.find((h) => h.hole === s.hole);
    if (!holeMeta) continue;
    const ch = courseHandicap(player.handicapIndex, {
      courseRating: course.courseRating,
      slopeRating: course.slopeRating,
      par: course.par,
    });
    const net = s.gross - strokesReceivedOnHole(ch, holeMeta.strokeIndex, course.holes.length);
    const cur = agg.get(info.playerId) ?? { toPar: 0, thru: 0 };
    cur.toPar += net - holeMeta.par;
    cur.thru += 1;
    agg.set(info.playerId, cur);
  }

  const entries: BoardEntry[] = roster.map((rp) => {
    const player = players.get(rp.playerId);
    const team = teamById.get(rp.teamId);
    const a = agg.get(rp.playerId);
    const thru = a?.thru ?? 0;
    return {
      playerId: rp.playerId,
      name: player ? `${player.firstName} ${player.lastName}` : 'Unknown',
      team,
      thru,
      toPar: a?.toPar ?? 0,
      position: 0,
      positionLabel: '',
      started: thru > 0,
    };
  });

  entries.sort((a, b) => {
    if (a.started !== b.started) return a.started ? -1 : 1;
    if (a.toPar !== b.toPar) return a.toPar - b.toPar;
    return b.thru - a.thru;
  });

  let lastToPar: number | null = null;
  let lastPos = 0;
  entries.forEach((e, i) => {
    if (!e.started) {
      e.positionLabel = '–';
      return;
    }
    if (lastToPar === null || e.toPar !== lastToPar) {
      lastPos = i + 1;
      lastToPar = e.toPar;
    }
    e.position = lastPos;
  });

  const positionCounts = new Map<number, number>();
  for (const e of entries) {
    if (e.started) positionCounts.set(e.position, (positionCounts.get(e.position) ?? 0) + 1);
  }
  for (const e of entries) {
    if (!e.started) continue;
    e.positionLabel = ((positionCounts.get(e.position) ?? 1) > 1 ? 'T' : '') + e.position;
  }

  return entries;
}

export function formatToPar(toPar: number): string {
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}
