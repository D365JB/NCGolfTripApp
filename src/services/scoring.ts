import {
  scoreMatch,
  courseHandicap,
  courseHandicapExact,
  type HoleScore,
  type MatchScoreResult,
  type ScoreMatchInput,
} from '../domain/scoring';
import {
  isTeamBallFormat,
  type Course,
  type Match,
  type MatchParticipant,
  type Player,
  type Score,
} from '../domain/model';

export interface MatchContext {
  match: Match;
  course: Course;
  participants: MatchParticipant[]; // stable order; sides filtered preserving order
  players: Map<string, Player>;
  scores: Score[];
}

export function playerCourseHandicap(handicapIndex: number, course: Course): number {
  return courseHandicap(handicapIndex, {
    courseRating: course.courseRating,
    slopeRating: course.slopeRating,
    par: course.par,
  });
}

function holesForMatch(ctx: MatchContext) {
  return [...ctx.course.holes]
    .sort((a, b) => a.hole - b.hole)
    .filter((h) => h.hole >= ctx.match.startHole && h.hole < ctx.match.startHole + ctx.match.numHoles)
    .map((h) => ({ hole: h.hole, par: h.par, strokeIndex: h.strokeIndex }));
}

export function buildMatchInput(ctx: MatchContext): ScoreMatchInput {
  const { match, course, participants, players, scores } = ctx;
  const holes = holesForMatch(ctx);
  const partsA = participants.filter((p) => p.side === 'a');
  const partsB = participants.filter((p) => p.side === 'b');

  const chOf = (playerId: string): number => {
    const p = players.get(playerId);
    return p
      ? courseHandicapExact(p.handicapIndex, {
          courseRating: course.courseRating,
          slopeRating: course.slopeRating,
          par: course.par,
        })
      : 0;
  };
  const forParticipant = (participantId: string): HoleScore[] =>
    scores.filter((s) => s.participantId === participantId).map((s) => ({ hole: s.hole, gross: s.gross }));
  const forSide = (side: 'a' | 'b'): HoleScore[] =>
    scores.filter((s) => s.side === side && s.participantId == null).map((s) => ({ hole: s.hole, gross: s.gross }));

  if (isTeamBallFormat(match.format)) {
    return {
      format: match.format,
      holes,
      totalHoles: match.numHoles,
      sideA: { players: partsA.map((p) => ({ courseHandicap: chOf(p.playerId) })), teamScores: forSide('a') },
      sideB: { players: partsB.map((p) => ({ courseHandicap: chOf(p.playerId) })), teamScores: forSide('b') },
    };
  }

  return {
    format: match.format,
    holes,
    totalHoles: match.numHoles,
    sideA: {
      players: partsA.map((p) => ({ playerId: p.playerId, courseHandicap: chOf(p.playerId), scores: forParticipant(p.id) })),
    },
    sideB: {
      players: partsB.map((p) => ({ playerId: p.playerId, courseHandicap: chOf(p.playerId), scores: forParticipant(p.id) })),
    },
  };
}

export function computeMatch(ctx: MatchContext): MatchScoreResult {
  return scoreMatch(buildMatchInput(ctx));
}
