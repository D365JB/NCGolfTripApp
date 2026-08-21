import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { cx } from '../../components/ui';
import { computeMatch } from '../../services/scoring';
import { eventStandings, type MatchSummary } from '../../services/standings';
import { individualLeaderboard, formatToPar, type BoardEntry } from '../../services/leaderboard';
import { strokesReceivedOnHole } from '../../domain/scoring';
import {
  FORMAT_LABELS,
  isTeamBallFormat,
  type Course,
  type EventTeam,
  type Match,
  type MatchParticipant,
  type Player,
  type Score,
} from '../../domain/model';
import { standardPar72Holes } from '../../db/seed';
import { ChevronDown } from 'lucide-react';

/** FLIP: animate leaderboard rows to their new positions when the order changes. */
function useFlip() {
  const ref = useRef<HTMLUListElement>(null);
  const prev = useRef<Map<string, number>>(new Map());
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-flip]'));
    const next = new Map<string, number>();
    for (const it of items) next.set(it.dataset.flip!, it.getBoundingClientRect().top);
    if (!reduce) {
      for (const it of items) {
        const key = it.dataset.flip!;
        const old = prev.current.get(key);
        const cur = next.get(key)!;
        if (old != null && Math.abs(old - cur) > 1) {
          it.animate(
            [{ transform: `translateY(${old - cur}px)` }, { transform: 'translateY(0)' }],
            { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          );
        }
      }
    }
    prev.current = next;
  });
  return ref;
}

export default function BigBoardPage() {
  const { eventId = '' } = useParams();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const flipRef = useFlip();
  const event = useLiveQuery(() => db.events.get(eventId), [eventId]);
  const teams = useLiveQuery(() => db.eventTeams.where('eventId').equals(eventId).toArray(), [eventId]);
  const roster = useLiveQuery(() => db.eventPlayers.where('eventId').equals(eventId).toArray(), [eventId]);
  const allPlayers = useLiveQuery(() => db.players.toArray(), []);
  const matches = useLiveQuery(() => db.matches.where('eventId').equals(eventId).toArray(), [eventId]);
  const matchIdKey = (matches ?? []).map((m) => m.id).sort().join(',');
  const participants = useLiveQuery(
    () => db.participants.where('matchId').anyOf((matches ?? []).map((m) => m.id)).toArray(),
    [matchIdKey],
  );
  const scores = useLiveQuery(
    () => db.scores.where('matchId').anyOf((matches ?? []).map((m) => m.id)).toArray(),
    [matchIdKey],
  );
  const sessions = useLiveQuery(() => db.sessions.where('eventId').equals(eventId).toArray(), [eventId]);
  const course = useLiveQuery(() => (event ? db.courses.get(event.courseId) : undefined), [event?.courseId]);
  const allCourses = useLiveQuery(() => db.courses.toArray(), []);

  if (!event || !teams || !roster || !allPlayers || !matches || !participants || !scores || !sessions || !allCourses) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-[#0b241a] via-[#081014] to-black p-4 sm:p-8">
        <div className="mx-auto max-w-5xl animate-pulse space-y-4">
          <div className="h-8 w-56 rounded-lg bg-white/10" />
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl bg-white/5 p-6">
            <div className="h-16 rounded-xl bg-white/10" />
            <div className="mx-auto h-6 w-14 rounded bg-white/10" />
            <div className="h-16 rounded-xl bg-white/10" />
          </div>
          <div className="space-y-2 pt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const courseDoc: Course = course ?? {
    id: 'unassigned',
    name: 'Par 72',
    state: 'NC',
    par: 72,
    courseRating: 71,
    slopeRating: 113,
    holes: standardPar72Holes(),
    source: 'manual',
  };
  const coursesById = new Map(allCourses.map((c) => [c.id, c]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const courseFor = (m: Match): Course =>
    coursesById.get(sessionById.get(m.sessionId)?.courseId ?? event.courseId) ?? courseDoc;

  const playersMap = new Map(allPlayers.map((p) => [p.id, p]));
  const teamA = teams.find((t) => t.side === 'a');
  const teamB = teams.find((t) => t.side === 'b');

  const boardMatches = matches.map((m) => {
    const parts = participants.filter((p) => p.matchId === m.id);
    const nameFor = (side: 'a' | 'b') =>
      parts
        .filter((p) => p.side === side)
        .map((p) => {
          const pl = playersMap.get(p.playerId);
          return pl ? `${pl.firstName[0]}. ${pl.lastName}` : '\u2014';
        })
        .join(' & ');
    const aNames = nameFor('a');
    const bNames = nameFor('b');
    const hasBothSides = parts.some((p) => p.side === 'a') && parts.some((p) => p.side === 'b');
    if (!hasBothSides) {
      return {
        match: m,
        result: null,
        status: '\u2014',
        decided: false,
        leader: null,
        holesPlayed: 0,
        aNames: aNames || 'TBD',
        bNames: bNames || 'TBD',
        started: false,
      };
    }
    const res = computeMatch({
      match: m,
      course: courseFor(m),
      participants: parts,
      players: playersMap,
      scores: scores.filter((s) => s.matchId === m.id),
    });
    return {
      match: m,
      result: res.state.result,
      status: res.state.status,
      decided: res.state.decided,
      leader: res.state.leader,
      holesPlayed: res.state.holesPlayed,
      aNames,
      bNames,
      started: res.state.holesPlayed > 0,
    };
  });
  const summaries: MatchSummary[] = boardMatches.map((b) => ({
    match: b.match,
    result: b.result,
    status: b.status,
    decided: b.decided,
  }));
  const standings = eventStandings(event, summaries);
  const rankMatch = (bm: { started: boolean; decided: boolean }) =>
    bm.started && !bm.decided ? 0 : bm.decided ? 1 : 2;
  const orderedMatches = [...boardMatches].sort((a, b) => rankMatch(a) - rankMatch(b));
  const board = individualLeaderboard({
    players: playersMap,
    roster,
    teams,
    matches,
    participants,
    scores,
    courseFor,
  });

  let headline = 'Match tied';
  if (standings.clinched === 'a') headline = `${teamA?.name} win`;
  else if (standings.clinched === 'b') headline = `${teamB?.name} win`;
  else if (standings.clinched === 'tie') headline = 'Match tied';
  else if (standings.teamA > standings.teamB) headline = `${teamA?.name} lead`;
  else if (standings.teamB > standings.teamA) headline = `${teamB?.name} lead`;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#0b241a] via-[#081014] to-black text-white">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-8 sm:py-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight sm:text-3xl">{event.name}</h1>
          <p className="truncate text-[11px] text-white/50 sm:text-sm">{courseDoc.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 sm:text-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 sm:h-2.5 sm:w-2.5" /> LIVE
          </span>
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            className="hidden rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20 sm:inline-block"
          >
            ⛶ Fullscreen
          </button>
          <Link
            to={`/events/${eventId}`}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 sm:px-3 sm:text-sm"
          >
            Exit
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-white/10 px-3 py-4 sm:gap-4 sm:px-8 sm:py-6">
        <TeamPanel team={teamA} points={standings.teamA} align="right" />
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 sm:text-xs">Match points</p>
          <p className="mt-0.5 text-xs font-bold text-white/80 sm:mt-1 sm:text-lg">{headline}</p>
        </div>
        <TeamPanel team={teamB} points={standings.teamB} align="left" />
      </section>

      <section className="px-3 py-4 sm:px-8 sm:py-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40 sm:mb-3 sm:text-sm">
          Leaderboard — net
        </h2>
        <div className="grid grid-cols-[1.75rem_1fr_2.5rem_3.25rem] items-center gap-2 border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/40 sm:grid-cols-[3.5rem_1fr_5rem_6rem] sm:text-xs">
          <span>Pos</span>
          <span>Player</span>
          <span className="text-center">Thru</span>
          <span className="text-right">To Par</span>
        </div>
        <ul ref={flipRef}>
          {board.map((e) => (
            <BoardRow key={e.playerId} entry={e} />
          ))}
        </ul>
      </section>

      <section className="px-3 pb-8 sm:px-8">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40 sm:text-sm">Matches</h2>
        <div className="space-y-2">
          {orderedMatches.map((m) => {
            const live = m.started && !m.decided;
            const statusColor =
              m.leader === 'a' ? teamA?.color : m.leader === 'b' ? teamB?.color : '#ffffff';
            const open = selectedMatchId === m.match.id;
            return (
              <div key={m.match.id} className="overflow-hidden rounded-xl bg-white/5">
                <button
                  onClick={() => setSelectedMatchId(open ? null : m.match.id)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07] sm:px-4 sm:py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-white/40 sm:text-xs">
                        {FORMAT_LABELS[m.match.format]}
                      </span>
                      {live && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-emerald-400 sm:text-[10px]">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm font-semibold text-white sm:text-lg">{m.aNames}</p>
                    <p className="truncate text-xs text-white/45 sm:text-sm">v {m.bNames}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <p className="text-lg font-black tabular sm:text-2xl" style={{ color: statusColor }}>
                        {m.status}
                      </p>
                      <p className="text-[10px] text-white/40 sm:text-xs">
                        {m.decided ? 'Final' : m.started ? `thru ${m.holesPlayed}` : 'Not started'}
                      </p>
                    </div>
                    <ChevronDown
                      className={cx('h-4 w-4 shrink-0 text-white/30 transition-transform', open && 'rotate-180')}
                    />
                  </div>
                </button>
                {open && (
                  <div className="animate-in border-t border-white/10 bg-black/20 px-2 py-3 sm:px-3">
                    <MatchScorecard
                      match={m.match}
                      participants={participants.filter((p) => p.matchId === m.match.id)}
                      scores={scores.filter((s) => s.matchId === m.match.id)}
                      course={courseFor(m.match)}
                      teamA={teamA}
                      teamB={teamB}
                      playersMap={playersMap}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TeamPanel({
  team,
  points,
  align,
}: {
  team?: EventTeam;
  points: number;
  align: 'left' | 'right';
}) {
  if (!team) return <div />;
  const right = align === 'right';
  return (
    <div className={`flex min-w-0 items-center gap-2 sm:gap-4 ${right ? 'flex-row-reverse text-right' : ''}`}>
      {team.logoDataUrl ? (
        <img src={team.logoDataUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover sm:h-16 sm:w-16 sm:rounded-xl" />
      ) : (
        <span className="h-9 w-9 shrink-0 rounded-lg sm:h-14 sm:w-14 sm:rounded-xl" style={{ backgroundColor: team.color }} />
      )}
      <div className={`flex min-w-0 items-center gap-1.5 sm:gap-4 ${right ? 'flex-row-reverse' : ''}`}>
        <span className="truncate text-sm font-black tracking-tight sm:text-2xl lg:text-4xl">{team.name}</span>
        <span
          key={points}
          className="animate-score-pop text-4xl font-black tabular-nums sm:text-6xl lg:text-7xl"
          style={{ color: team.color }}
        >
          {points}
        </span>
      </div>
    </div>
  );
}

function BoardRow({ entry }: { entry: BoardEntry }) {
  const parColor =
    entry.toPar < 0 ? 'text-emerald-400' : entry.toPar > 0 ? 'text-white/70' : 'text-white';
  const isTop = entry.started && entry.position <= 3;
  const medal =
    entry.position === 1
      ? 'bg-gold-400 text-brand-950'
      : entry.position === 2
        ? 'bg-slate-300 text-slate-900'
        : 'bg-amber-700 text-white';
  return (
    <li
      data-flip={entry.playerId}
      className={cx(
        'grid grid-cols-[1.75rem_1fr_2.5rem_3.25rem] items-center gap-2 border-b border-white/5 py-2.5 sm:grid-cols-[3.5rem_1fr_5rem_6rem] sm:py-3.5',
        entry.position === 1 && 'bg-gradient-to-r from-gold-400/12 to-transparent',
      )}
    >
      <span
        className={cx(
          'inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1 py-0.5 text-xs font-black sm:min-w-[2.25rem] sm:px-2 sm:text-lg',
          isTop ? medal : 'text-white/45',
        )}
      >
        {entry.positionLabel}
      </span>
      <span className="flex min-w-0 items-center gap-2 sm:gap-3">
        {entry.team &&
          (entry.team.logoDataUrl ? (
            <img src={entry.team.logoDataUrl} alt="" className="h-4 w-4 shrink-0 rounded object-cover sm:h-7 sm:w-7 sm:rounded-md" />
          ) : (
            <span className="h-3 w-3 shrink-0 rounded-full sm:h-4 sm:w-4" style={{ backgroundColor: entry.team.color }} />
          ))}
        <span className="truncate text-sm font-semibold tracking-tight sm:text-3xl">{entry.name}</span>
      </span>
      <span className="text-center text-sm tabular text-white/55 sm:text-2xl">
        {entry.started ? (entry.thru >= 18 ? 'F' : entry.thru) : '–'}
      </span>
      <span className={cx('text-right text-sm font-black tabular sm:text-3xl', parColor)}>
        {entry.started ? formatToPar(entry.toPar) : '–'}
      </span>
    </li>
  );
}

function toneFor(gross: number | undefined, par: number): string {
  if (gross == null) return 'text-white/25';
  const d = gross - par;
  if (d <= -2) return 'text-gold-400 font-black';
  if (d === -1) return 'text-emerald-400 font-black';
  if (d === 0) return 'text-white/80';
  if (d === 1) return 'text-orange-400';
  return 'text-rose-400';
}

function MatchScorecard({
  match,
  participants,
  scores,
  course,
  teamA,
  teamB,
  playersMap,
}: {
  match: Match;
  participants: MatchParticipant[];
  scores: Score[];
  course: Course;
  teamA?: EventTeam;
  teamB?: EventTeam;
  playersMap: Map<string, Player>;
}) {
  if (scores.length === 0) {
    return <p className="py-3 text-center text-xs text-white/40">No scores entered yet.</p>;
  }

  const holes = [...course.holes]
    .sort((a, b) => a.hole - b.hole)
    .filter((h) => h.hole >= match.startHole && h.hole < match.startHole + match.numHoles);

  const result = computeMatch({ match, course, participants, players: playersMap, scores });
  const netByHole = new Map(result.holeNets.map((h) => [h.hole, h]));
  const statusColor =
    result.state.leader === 'a' ? teamA?.color : result.state.leader === 'b' ? teamB?.color : '#ffffff';

  type Row = { key: string; label: string; color?: string; side: 'a' | 'b'; participantId?: string; strokes: number };
  const nameFor = (playerId: string) => {
    const pl = playersMap.get(playerId);
    return pl ? `${pl.firstName[0]}. ${pl.lastName}` : '—';
  };
  const partsA = participants.filter((p) => p.side === 'a');
  const partsB = participants.filter((p) => p.side === 'b');
  const rows: Row[] = isTeamBallFormat(match.format)
    ? [
        { key: 'a', label: teamA?.name ?? 'Team A', color: teamA?.color, side: 'a', strokes: result.sideAStrokes[0] ?? 0 },
        { key: 'b', label: teamB?.name ?? 'Team B', color: teamB?.color, side: 'b', strokes: result.sideBStrokes[0] ?? 0 },
      ]
    : [
        ...partsA.map((p, i) => ({ key: p.id, label: nameFor(p.playerId), color: teamA?.color, side: 'a' as const, participantId: p.id, strokes: result.sideAStrokes[i] ?? 0 })),
        ...partsB.map((p, i) => ({ key: p.id, label: nameFor(p.playerId), color: teamB?.color, side: 'b' as const, participantId: p.id, strokes: result.sideBStrokes[i] ?? 0 })),
      ];

  const scoreMap = new Map<string, number>();
  for (const s of scores) scoreMap.set(`${s.side}|${s.participantId ?? 'team'}|${s.hole}`, s.gross);
  const cellFor = (r: Row, hole: number) => scoreMap.get(`${r.side}|${r.participantId ?? 'team'}|${hole}`);
  const totalFor = (r: Row) => holes.reduce((sum, h) => sum + (cellFor(r, h.hole) ?? 0), 0);
  const parTotal = holes.reduce((sum, h) => sum + h.par, 0);

  return (
    <div className="no-scrollbar overflow-x-auto">
      <table className="w-full border-collapse text-center text-[11px] sm:text-sm">
        <thead>
          <tr className="text-white/40">
            <th className="sticky left-0 z-10 bg-[#0c1a15] p-1 pr-2 text-left font-bold">Hole</th>
            {holes.map((h) => (
              <th key={h.hole} className="min-w-[1.35rem] p-1 font-semibold tabular">
                {h.hole}
              </th>
            ))}
            <th className="p-1 pl-2 font-bold">Tot</th>
          </tr>
          <tr className="text-white/30">
            <th className="sticky left-0 z-10 bg-[#0c1a15] p-1 pr-2 text-left font-semibold">Par</th>
            {holes.map((h) => (
              <th key={h.hole} className="p-1 font-normal tabular">
                {h.par}
              </th>
            ))}
            <th className="p-1 pl-2 tabular">{parTotal}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-white/5">
              <td className="sticky left-0 z-10 bg-[#0c1a15] p-1 pr-2 text-left">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="max-w-[6.5rem] truncate font-semibold text-white/90 sm:max-w-[10rem]">
                    {r.label}
                  </span>
                </span>
              </td>
              {holes.map((h) => {
                const g = cellFor(r, h.hole);
                const dots = strokesReceivedOnHole(r.strokes, h.strokeIndex, match.numHoles);
                return (
                  <td key={h.hole} className={cx('relative p-1 tabular', toneFor(g, h.par))}>
                    {dots > 0 && (
                      <span className="pointer-events-none absolute inset-x-0 top-0 text-center text-[6px] leading-none text-rose-400">
                        {'•'.repeat(dots)}
                      </span>
                    )}
                    {g ?? '·'}
                  </td>
                );
              })}
              <td className="p-1 pl-2 font-black tabular text-white">{totalFor(r) || '–'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/15">
            <td className="sticky left-0 z-10 bg-[#0c1a15] p-1 pr-2 text-left font-bold text-white/80">Match</td>
            {holes.map((h) => {
              const hn = netByHole.get(h.hole);
              const winner = hn
                ? hn.netA < hn.netB
                  ? teamA?.color
                  : hn.netB < hn.netA
                    ? teamB?.color
                    : null
                : undefined;
              return (
                <td key={h.hole} className="p-1">
                  {hn === undefined ? (
                    <span className="text-white/15">·</span>
                  ) : winner ? (
                    <span className="mx-auto block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: winner }} />
                  ) : (
                    <span className="mx-auto block h-0.5 w-3 rounded-full bg-white/30" />
                  )}
                </td>
              );
            })}
            <td className="p-1 pl-2 font-black tabular" style={{ color: statusColor }}>
              {result.state.status}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
