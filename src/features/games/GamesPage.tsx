import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, Coins, Swords } from 'lucide-react';
import { db } from '../../db/dexie';
import { Card, PageHeader, Select, Skeleton, cx } from '../../components/ui';
import { standardPar72Holes } from '../../db/seed';
import { skinsForSession, nassauForMatch } from '../../services/sideGames';
import type { Course, Match } from '../../domain/model';

export default function GamesPage() {
  const { eventId = '' } = useParams();
  const event = useLiveQuery(() => db.events.get(eventId), [eventId]);
  const sessions = useLiveQuery(() => db.sessions.where('eventId').equals(eventId).sortBy('sequence'), [eventId]);
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
  const allPlayers = useLiveQuery(() => db.players.toArray(), []);
  const courses = useLiveQuery(() => db.courses.toArray(), []);

  const [sessionId, setSessionId] = useState('');
  const [mode, setMode] = useState<'net' | 'gross'>('net');
  const [bet, setBet] = useState('10');
  const [autoPress, setAutoPress] = useState(false);

  if (!event || !sessions || !matches || !participants || !scores || !allPlayers || !courses) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const players = new Map(allPlayers.map((p) => [p.id, p]));
  const coursesById = new Map(courses.map((c) => [c.id, c]));
  const fallback: Course = {
    id: 'fallback',
    name: 'Par 72',
    state: 'NC',
    par: 72,
    courseRating: 71,
    slopeRating: 113,
    holes: standardPar72Holes(),
    source: 'manual',
  };
  const courseForMatch = (m: Match): Course =>
    coursesById.get(sessions.find((s) => s.id === m.sessionId)?.courseId ?? event.courseId) ?? fallback;

  const activeSession = sessions.find((s) => s.id === sessionId) ?? sessions[0];
  const activeCourse = activeSession
    ? coursesById.get(activeSession.courseId ?? event.courseId) ?? fallback
    : fallback;
  const skins = activeSession
    ? skinsForSession({ session: activeSession, matches, participants, scores, players, course: activeCourse, mode })
    : null;

  const nassauMatches = matches.filter((m) => {
    const parts = participants.filter((p) => p.matchId === m.id);
    const hasBoth = parts.some((p) => p.side === 'a') && parts.some((p) => p.side === 'b');
    return hasBoth && scores.some((s) => s.matchId === m.id);
  });
  const betValue = Number(bet) || 0;
  const firstName = (label: string) => label.split(' ')[0];

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
      <PageHeader title="Side games" subtitle={event.name} />

      <Card className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <Coins className="h-4 w-4 text-gold-500" />
          <span className="text-sm font-bold text-ink">Skins</span>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Select value={activeSession?.id ?? ''} onChange={(e) => setSessionId(e.target.value)}>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <div className="inline-flex rounded-lg bg-black/5 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setMode('net')}
              className={cx('flex-1 rounded-md px-2.5 py-1', mode === 'net' ? 'seg-pill bg-white text-ink shadow-sm' : 'text-ink/50')}
            >
              Net
            </button>
            <button
              onClick={() => setMode('gross')}
              className={cx('flex-1 rounded-md px-2.5 py-1', mode === 'gross' ? 'seg-pill bg-white text-ink shadow-sm' : 'text-ink/50')}
            >
              Gross
            </button>
          </div>
        </div>
        {!skins || skins.playerCount < 2 ? (
          <p className="text-xs text-ink/50">Enter scores for at least two players in this round to see skins.</p>
        ) : skins.rows.filter((r) => r.skins > 0).length === 0 ? (
          <p className="text-xs text-ink/50">No skins won yet — every hole is carrying.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {skins.rows
                .filter((r) => r.skins > 0)
                .map((r) => (
                  <li
                    key={r.playerId}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 odd:bg-black/[0.02]"
                  >
                    <span className="text-sm font-medium text-ink">{r.name}</span>
                    <span className="text-sm font-bold text-brand-700">
                      {r.skins} {r.skins === 1 ? 'skin' : 'skins'}
                    </span>
                  </li>
                ))}
            </ul>
            {skins.carry > 0 && (
              <p className="mt-2 text-[11px] font-semibold text-gold-600">
                {skins.carry} skin{skins.carry === 1 ? '' : 's'} still carrying.
              </p>
            )}
          </>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-brand-600" />
            <span className="text-sm font-bold text-ink">Nassau</span>
          </div>
          <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink/60">
            <input type="checkbox" checked={autoPress} onChange={(e) => setAutoPress(e.target.checked)} /> Auto-press
          </label>
        </div>
        {nassauMatches.length === 0 ? (
          <p className="text-xs text-ink/50">Nassau appears here once a head-to-head match has scores.</p>
        ) : (
          <div className="space-y-3">
            {nassauMatches.map((m) => {
              const v = nassauForMatch({
                match: m,
                course: courseForMatch(m),
                participants: participants.filter((p) => p.matchId === m.id),
                players,
                scores: scores.filter((s) => s.matchId === m.id),
                betValue,
                autoPressDownBy: autoPress ? 2 : undefined,
              });
              return (
                <div key={m.id} className="rounded-xl border border-black/5 p-2.5">
                  <p className="text-xs font-semibold text-ink">{v.matchName}</p>
                  <p className="mb-1.5 text-[11px] text-ink/50">
                    {v.aLabel} v {v.bLabel}
                  </p>
                  <div className="space-y-0.5">
                    {v.bets.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-[12px]">
                        <span className="text-ink/60">{b.name}</span>
                        <span className="font-semibold text-ink">
                          {b.status}
                          {b.a > b.b ? ` · ${firstName(v.aLabel)} +$${b.a}` : b.b > b.a ? ` · ${firstName(v.bLabel)} +$${b.b}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                  {(v.totals.a > 0 || v.totals.b > 0) && (
                    <p className="mt-1 text-[11px] font-bold text-brand-700">
                      Total: {firstName(v.aLabel)} ${v.totals.a} · {firstName(v.bLabel)} ${v.totals.b}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-[11px] text-ink/45">
          Bet per side: $
          <input
            inputMode="numeric"
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            className="ml-1 w-12 rounded border border-black/10 bg-white px-1.5 py-0.5 text-center text-ink outline-none focus:border-brand-500"
          />
        </p>
      </Card>
    </div>
  );
}
