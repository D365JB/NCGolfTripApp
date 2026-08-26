import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/dexie';
import { Button, Skeleton, cx } from '../../components/ui';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { isTeamBallFormat, FORMAT_LABELS, type EventTeam, type Side, type Course } from '../../domain/model';
import { computeMatch } from '../../services/scoring';
import { strokesReceivedOnHole } from '../../domain/scoring';
import { standardPar72Holes } from '../../db/seed';
import { useIdentity } from '../../lib/identity';
import { toast } from '../../components/Toast';

interface Column {
  side: Side;
  participantId?: string;
  label: string;
  name: string;
  strokes: number;
  color?: string;
}

export default function ScorecardPage() {
  const { eventId = '', matchId = '' } = useParams();
  const [view, setView] = useState<'hole' | 'card'>('hole');
  const [holeIdx, setHoleIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const swipe = useRef<{ x: number; y: number; mode: '?' | 'x' | 'y' } | null>(null);
  const activeHoleRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeHoleRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [holeIdx]);
  const identity = useIdentity();

  // Keep the phone screen awake while a scorecard is open (best-effort; ignored where unsupported).
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          await wakeRef.current?.release().catch(() => {});
          wakeRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        /* not supported or denied — the golfer can keep the phone awake manually */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      wakeRef.current?.release().catch(() => {});
      wakeRef.current = null;
    };
  }, []);

  const match = useLiveQuery(() => db.matches.get(matchId), [matchId]);
  const teams = useLiveQuery(() => db.eventTeams.where('eventId').equals(eventId).toArray(), [eventId]);
  const participants = useLiveQuery(() => db.participants.where('matchId').equals(matchId).toArray(), [matchId]);
  const allPlayers = useLiveQuery(() => db.players.toArray(), []);
  const scores = useLiveQuery(() => db.scores.where('matchId').equals(matchId).toArray(), [matchId]);
  const event = useLiveQuery(() => db.events.get(eventId), [eventId]);
  const session = useLiveQuery(() => (match ? db.sessions.get(match.sessionId) : undefined), [match?.sessionId]);
  const courseId = session?.courseId ?? event?.courseId;
  const rawCourse = useLiveQuery(() => (courseId ? db.courses.get(courseId) : undefined), [courseId]);

  if (!match || !teams || !participants || !allPlayers || !scores || !event) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    );
  }

  const courseDoc: Course = rawCourse ?? {
    id: 'unassigned',
    name: 'Par 72 (no course assigned)',
    state: 'NC',
    par: 72,
    courseRating: 71,
    slopeRating: 113,
    holes: standardPar72Holes(),
    source: 'manual',
  };

  const teamA = teams.find((t) => t.side === 'a');
  const teamB = teams.find((t) => t.side === 'b');
  const playersMap = new Map(allPlayers.map((p) => [p.id, p]));
  const initials = (playerId: string): string => {
    const p = playersMap.get(playerId);
    return p ? `${p.firstName[0]}${p.lastName[0]}` : '??';
  };
  const fullName = (playerId: string): string => {
    const p = playersMap.get(playerId);
    return p ? `${p.firstName} ${p.lastName}` : 'Player';
  };

  const holes = [...courseDoc.holes]
    .sort((a, b) => a.hole - b.hole)
    .filter((h) => h.hole >= match.startHole && h.hole < match.startHole + match.numHoles);

  const hasBothSides =
    participants.some((p) => p.side === 'a') && participants.some((p) => p.side === 'b');
  if (!hasBothSides) {
    return (
      <div>
        <div className="mb-4">
          <Link
            to={`/events/${eventId}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-ink/60 hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-8 text-center shadow-card">
          <p className="text-sm font-semibold text-ink">This match needs players on both teams.</p>
          <p className="mt-1 text-xs text-ink/55">
            Add a player to each side from the event page to start scoring.
          </p>
        </div>
      </div>
    );
  }

  const result = computeMatch({
    match,
    course: courseDoc,
    participants,
    players: playersMap,
    scores,
  });

  const canEdit = !!identity && participants.some((p) => p.playerId === identity);

  const partsA = participants.filter((p) => p.side === 'a');
  const partsB = participants.filter((p) => p.side === 'b');

  let columns: Column[];
  if (isTeamBallFormat(match.format)) {
    columns = [
      { side: 'a', label: teamA?.name ?? 'A', name: teamA?.name ?? 'Team A', strokes: result.sideAStrokes[0] ?? 0, color: teamA?.color },
      { side: 'b', label: teamB?.name ?? 'B', name: teamB?.name ?? 'Team B', strokes: result.sideBStrokes[0] ?? 0, color: teamB?.color },
    ];
  } else {
    columns = [
      ...partsA.map((p, i) => ({
        side: 'a' as Side,
        participantId: p.id,
        label: initials(p.playerId),
        name: fullName(p.playerId),
        strokes: result.sideAStrokes[i] ?? 0,
        color: teamA?.color,
      })),
      ...partsB.map((p, i) => ({
        side: 'b' as Side,
        participantId: p.id,
        label: initials(p.playerId),
        name: fullName(p.playerId),
        strokes: result.sideBStrokes[i] ?? 0,
        color: teamB?.color,
      })),
    ];
  }

  const scoreMap = new Map<string, number>();
  for (const s of scores) scoreMap.set(`${s.side}|${s.participantId ?? 'team'}|${s.hole}`, s.gross);
  const keyOf = (c: Column, hole: number) => `${c.side}|${c.participantId ?? 'team'}|${hole}`;

  async function setScore(c: Column, hole: number, raw: string) {
    const gross = raw === '' ? NaN : Number(raw);
    const existing = scores!.find(
      (s) => s.side === c.side && s.hole === hole && (s.participantId ?? null) === (c.participantId ?? null),
    );
    if (Number.isNaN(gross)) {
      if (existing) await db.scores.delete(existing.id);
      return;
    }
    const clamped = Math.max(1, Math.min(20, Math.round(gross)));
    const now = new Date().toISOString();
    if (existing) {
      await db.scores.update(existing.id, { gross: clamped, updatedAt: now });
    } else {
      await db.scores.add({
        id: newId(),
        matchId,
        side: c.side,
        participantId: c.participantId,
        hole,
        gross: clamped,
        updatedAt: now,
      });
    }
  }

  const leaderColor =
    result.state.leader === 'a' ? teamA?.color : result.state.leader === 'b' ? teamB?.color : undefined;

  async function toggleFinal() {
    const willFinal = match!.status !== 'final';
    await db.matches.update(matchId, { status: willFinal ? 'final' : 'active' });
    toast(willFinal ? 'Match finalized' : 'Match reopened');
  }

  const idx = Math.max(0, Math.min(holeIdx, holes.length - 1));
  const hole = holes[idx];
  const colsA = columns.filter((c) => c.side === 'a');
  const colsB = columns.filter((c) => c.side === 'b');

  function goHole(target: number) {
    const clamped = Math.max(0, Math.min(holes.length - 1, target));
    if (clamped === idx) return;
    setDir(clamped > idx ? 1 : -1);
    setHoleIdx(clamped);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(6);
  }
  function onSwipeStart(e: ReactPointerEvent) {
    swipe.current = { x: e.clientX, y: e.clientY, mode: '?' };
  }
  function onSwipeMove(e: ReactPointerEvent) {
    const s = swipe.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.mode === '?') {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) s.mode = 'x';
      else if (Math.abs(dy) > 12) s.mode = 'y';
      else return;
    }
    if (s.mode !== 'x') return;
    const rubber = (idx === 0 && dx > 0) || (idx === holes.length - 1 && dx < 0);
    setDragX(rubber ? dx * 0.28 : dx);
  }
  function onSwipeEnd(e: ReactPointerEvent) {
    const s = swipe.current;
    swipe.current = null;
    if (s?.mode === 'x') {
      const dx = e.clientX - s.x;
      if (dx <= -56) goHole(idx + 1);
      else if (dx >= 56) goHole(idx - 1);
    }
    setDragX(0);
  }

  function adjust(c: Column, delta: number) {
    if (!canEdit) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8);
    const cur = scoreMap.get(keyOf(c, hole.hole));
    const next = cur == null ? (delta > 0 ? hole.par : hole.par - 1) : cur + delta;
    void setScore(c, hole.hole, next < 1 ? '' : String(Math.min(next, 20)));
  }

  const stepperRow = (c: Column) => {
    const gross = scoreMap.get(keyOf(c, hole.hole));
    const dots = strokesReceivedOnHole(c.strokes, hole.strokeIndex, match.numHoles);
    return (
      <div
        key={`${c.side}-${c.participantId ?? 'team'}`}
        className="flex items-center justify-between gap-3 border-t border-black/5 py-2.5 first:border-t-0"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
          <p className="text-[11px] text-ink/50">
            {dots > 0 && <span className="text-rose-500">{'•'.repeat(dots)} </span>}
            {gross != null ? `Net ${gross - dots}` : 'Tap to score'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => adjust(c, -1)}
            disabled={!canEdit}
            className="grid h-11 w-11 place-items-center rounded-full bg-black/5 text-ink transition active:scale-90 disabled:opacity-40"
            aria-label="Decrease score"
          >
            <Minus className="h-5 w-5" />
          </button>
          <ScoreValue gross={gross} par={hole.par} />
          <button
            onClick={() => adjust(c, 1)}
            disabled={!canEdit}
            className="grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-white shadow-sm transition active:scale-90 disabled:opacity-40"
            aria-label="Increase score"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  };

  const teamGroup = (team: EventTeam | undefined, cols: Column[]) =>
    team && cols.length ? (
      <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-card">
        <div className="mb-1 flex items-center gap-2 px-1">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
          <span className="text-sm font-bold text-ink">{team.name}</span>
        </div>
        {cols.map(stepperRow)}
      </div>
    ) : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          to={`/events/${eventId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-ink/60 hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <div className="relative inline-flex rounded-lg bg-black/5 p-0.5 text-xs font-semibold">
            <span
              aria-hidden
              className="seg-pill absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-white shadow-sm transition-transform duration-300"
              style={{
                transform: view === 'hole' ? 'translateX(0)' : 'translateX(100%)',
                transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
              }}
            />
            <button
              onClick={() => {
                setView('hole');
                navigator.vibrate?.(5);
              }}
              className={cx('relative z-10 rounded-md px-2.5 py-1 transition-colors', view === 'hole' ? 'text-ink' : 'text-ink/50')}
            >
              Hole
            </button>
            <button
              onClick={() => {
                setView('card');
                navigator.vibrate?.(5);
              }}
              className={cx('relative z-10 rounded-md px-2.5 py-1 transition-colors', view === 'card' ? 'text-ink' : 'text-ink/50')}
            >
              Card
            </button>
          </div>
          {canEdit && (
            <Button variant={match.status === 'final' ? 'outline' : 'secondary'} size="sm" onClick={toggleFinal}>
              {match.status === 'final' ? 'Reopen' : 'Finalize'}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-center text-white shadow-raise">
        <div className="h-1.5 w-full" style={{ backgroundColor: leaderColor ?? 'transparent' }} />
        <div className="px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
            {FORMAT_LABELS[match.format]}
          </p>
          <p className="mt-1 text-3xl font-black tabular">{result.state.status}</p>
          <p className="mt-1 text-xs font-medium text-white/60">
            {result.state.holesPlayed} played · {result.state.holesRemaining} to play
          </p>
        </div>
      </div>

      {view === 'hole' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => goHole(idx - 1)}
              disabled={idx === 0}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-ink shadow-sm transition active:scale-90 disabled:opacity-30"
              aria-label="Previous hole"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth">
              <div className="flex gap-1 px-0.5">
                {holes.map((h, i) => {
                  const any = columns.some((c) => scoreMap.has(keyOf(c, h.hole)));
                  return (
                    <button
                      key={h.hole}
                      ref={i === idx ? activeHoleRef : undefined}
                      onClick={() => goHole(i)}
                      className={cx(
                        'h-8 w-8 shrink-0 rounded-lg text-xs font-bold tabular transition',
                        i === idx
                          ? 'bg-brand-600 text-white'
                          : any
                            ? 'bg-brand-100 text-brand-800'
                            : 'bg-black/5 text-ink/45',
                      )}
                    >
                      {h.hole}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => goHole(idx + 1)}
              disabled={idx === holes.length - 1}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-ink shadow-sm transition active:scale-90 disabled:opacity-30"
              aria-label="Next hole"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div
            onPointerDown={onSwipeStart}
            onPointerMove={onSwipeMove}
            onPointerUp={onSwipeEnd}
            onPointerCancel={onSwipeEnd}
            style={{
              touchAction: 'pan-y',
              transform: dragX ? `translateX(${dragX}px)` : undefined,
              transition: dragX ? 'none' : 'transform 0.26s cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <div key={idx} className={cx('space-y-4', dir === 1 ? 'hole-in-right' : 'hole-in-left')}>
              <div className="rounded-2xl border border-black/5 bg-white p-4 text-center shadow-card">
                <p className="text-[11px] font-bold uppercase tracking-widest text-ink/45">Hole</p>
                <p className="text-5xl font-black tabular text-ink">{hole.hole}</p>
                <div className="mt-1 flex items-center justify-center gap-3 text-xs font-semibold text-ink/55">
                  <span>Par {hole.par}</span>
                  <span className="text-ink/20">·</span>
                  <span>SI {hole.strokeIndex}</span>
                  {hole.yardage ? (
                    <>
                      <span className="text-ink/20">·</span>
                      <span>{hole.yardage} yds</span>
                    </>
                  ) : null}
                </div>
              </div>

              {teamGroup(teamA, colsA)}
              {teamGroup(teamB, colsB)}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => goHole(idx - 1)} disabled={idx === 0}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button className="flex-[2]" onClick={() => goHole(idx + 1)} disabled={idx === holes.length - 1}>
              Next hole <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-center text-[11px] text-ink/45">
            Red dots = handicap strokes on this hole. First tap sets par, then adjust.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white p-2 shadow-card">
            <table className="w-full border-collapse text-center text-sm">
              <thead>
                <tr className="text-[11px] text-ink/60">
                  <th className="p-1 text-left font-semibold">Hole</th>
                  <th className="p-1 font-semibold">Par</th>
                  <th className="p-1 font-semibold">SI</th>
                  {columns.map((c, i) => (
                    <th key={i} className="p-1">
                      <span
                        className="inline-block rounded px-1.5 py-0.5 font-bold text-white"
                        style={{ backgroundColor: c.color ?? '#166534' }}
                      >
                        {c.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holes.map((h) => (
                  <tr key={h.hole} className="border-t border-black/5">
                    <td className="p-1 text-left font-medium text-ink">
                      {h.hole}
                      {h.yardage ? (
                        <span className="ml-1 text-[9px] font-normal text-ink/40">{h.yardage}y</span>
                      ) : null}
                    </td>
                    <td className="p-1 text-ink/60">{h.par}</td>
                    <td className="p-1 text-ink/40">{h.strokeIndex}</td>
                    {columns.map((c, i) => {
                      const dots = strokesReceivedOnHole(c.strokes, h.strokeIndex, match.numHoles);
                      const val = scoreMap.get(keyOf(c, h.hole));
                      return (
                        <td key={i} className="p-1">
                          <div className="flex flex-col items-center">
                            <span className="h-2 text-[8px] leading-none text-rose-500">
                              {dots > 0 ? '•'.repeat(dots) : ''}
                            </span>
                            <input
                              inputMode="numeric"
                              value={val ?? ''}
                              disabled={!canEdit}
                              onChange={(e) => setScore(c, h.hole, e.target.value)}
                              className="w-10 rounded-lg border border-black/10 bg-white py-1.5 text-center text-sm font-semibold text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:bg-black/5 disabled:text-ink/40"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-[11px] text-ink/50">
            Red dots show handicap strokes given on a hole. Status updates live as you enter scores.
          </p>
        </>
      )}
    </div>
  );
}

function ScoreValue({ gross, par }: { gross?: number; par: number }) {
  if (gross == null) {
    return <span className="grid h-11 w-11 place-items-center text-2xl font-black text-ink/25">–</span>;
  }
  const d = gross - par;
  const shape = d < 0 ? 'rounded-full ring-2' : d > 0 ? 'rounded-md ring-2' : '';
  const tone =
    d <= -2
      ? 'text-amber-500 ring-amber-400'
      : d === -1
        ? 'text-emerald-600 ring-emerald-500'
        : d === 0
          ? 'text-ink'
          : d === 1
            ? 'text-orange-500 ring-orange-400'
            : 'text-rose-600 ring-rose-500';
  return (
    <span
      key={gross}
      className={cx('grid h-11 w-11 place-items-center text-2xl font-black tabular animate-score-pop', shape, tone)}
    >
      {gross}
    </span>
  );
}
