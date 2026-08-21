import { rollupStandings, type EventStandings, type MatchForRollup, type MatchResult } from '../domain/scoring';
import type { GolfEvent, Match } from '../domain/model';

export interface MatchSummary {
  match: Match;
  result: MatchResult | null;
  status: string;
  decided: boolean;
}

/** Roll decided match results up into event standings using the event's point config. */
export function eventStandings(event: GolfEvent, summaries: MatchSummary[]): EventStandings {
  const cfg = { win: event.pointsWin, tie: event.pointsTie };
  const matches: MatchForRollup[] = summaries.map((s) => ({
    pointsValue: s.match.pointsValue,
    result: s.decided ? s.result : null,
  }));
  return rollupStandings(matches, cfg);
}
