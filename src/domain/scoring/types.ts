export type Side = 'a' | 'b';
export type MatchResult = Side | 'tie';
export type MatchFormat = 'singles_1v1' | 'best_ball_2' | 'best_ball_team' | 'foursomes_2' | 'scramble_2';

/** Static info about a hole on a course. */
export interface HoleInfo {
  hole: number; // 1..N
  par: number;
  strokeIndex: number; // 1..N difficulty rank (1 = hardest)
}

/** A gross score a player/side made on a hole. */
export interface HoleScore {
  hole: number;
  gross: number;
}

/** Tee rating used to compute a Course Handicap. */
export interface TeeRating {
  courseRating: number;
  slopeRating: number;
  par: number;
}

/** Points awarded for a match outcome (Ryder Cup style: win 1, tie 0.5). */
export interface PointsConfig {
  win: number;
  tie: number;
}

/** Net scores for both sides on a single hole. */
export interface HoleNet {
  hole: number;
  netA: number;
  netB: number;
}

/** The running/final state of a match-play contest. */
export interface MatchState {
  diff: number; // positive = side A is up
  leader: Side | null;
  holesPlayed: number;
  holesRemaining: number;
  decided: boolean;
  result: MatchResult | null; // null = still in progress
  status: string; // e.g. "3&2", "2 UP", "AS"
}

/** Per-side result of computing a match's hole-by-hole nets and strokes. */
export interface FormatScore {
  holeNets: HoleNet[];
  sideAStrokes: number[]; // per player (player formats) or single value (team formats)
  sideBStrokes: number[];
}

export interface MatchScoreResult extends FormatScore {
  state: MatchState;
}
