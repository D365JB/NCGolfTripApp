import type {
  HoleInfo,
  HoleScore,
  MatchFormat,
  MatchScoreResult,
} from './types';
import { resolveMatch } from './matchPlay';
import { scoreSingles } from './formats/singles';
import { scoreBestBall2 } from './formats/bestBall2';
import { scoreFoursomes2 } from './formats/foursomes2';
import { scoreScramble2, type ScrambleAllowance } from './formats/scramble2';

export interface MatchPlayerInput {
  playerId?: string;
  courseHandicap: number;
  scores?: HoleScore[]; // used by player formats (singles, best ball)
}

export interface MatchSideInput {
  players: MatchPlayerInput[];
  teamScores?: HoleScore[]; // used by team-ball formats (foursomes, scramble)
}

export interface ScoreMatchInput {
  format: MatchFormat;
  holes: HoleInfo[];
  totalHoles?: number;
  sideA: MatchSideInput;
  sideB: MatchSideInput;
  scrambleAllowance?: ScrambleAllowance;
  fourBallAllowancePercent?: number;
}

/** Dispatch a match to the correct format engine and resolve its match-play state. */
export function scoreMatch(input: ScoreMatchInput): MatchScoreResult {
  const totalHoles = input.totalHoles ?? input.holes.length;
  const { holes, sideA, sideB } = input;

  // An incomplete match (a side without its players) has no contest yet — return a
  // neutral all-square state instead of indexing into an empty side.
  if (sideA.players.length === 0 || sideB.players.length === 0) {
    return { holeNets: [], sideAStrokes: [], sideBStrokes: [], state: resolveMatch([], totalHoles) };
  }

  let score;
  switch (input.format) {
    case 'singles_1v1':
      score = scoreSingles(
        holes,
        { courseHandicap: sideA.players[0].courseHandicap, scores: sideA.players[0].scores ?? [] },
        { courseHandicap: sideB.players[0].courseHandicap, scores: sideB.players[0].scores ?? [] },
        totalHoles,
      );
      break;
    case 'best_ball_2':
    case 'best_ball_team':
      score = scoreBestBall2(
        holes,
        { players: sideA.players.map((p) => ({ courseHandicap: p.courseHandicap, scores: p.scores ?? [] })) },
        { players: sideB.players.map((p) => ({ courseHandicap: p.courseHandicap, scores: p.scores ?? [] })) },
        totalHoles,
        input.fourBallAllowancePercent,
      );
      break;
    case 'foursomes_2':
      score = scoreFoursomes2(
        holes,
        { players: sideA.players, scores: sideA.teamScores ?? [] },
        { players: sideB.players, scores: sideB.teamScores ?? [] },
        totalHoles,
      );
      break;
    case 'scramble_2':
      score = scoreScramble2(
        holes,
        { players: sideA.players, scores: sideA.teamScores ?? [] },
        { players: sideB.players, scores: sideB.teamScores ?? [] },
        totalHoles,
        input.scrambleAllowance,
      );
      break;
  }

  return { ...score, state: resolveMatch(score.holeNets, totalHoles) };
}
