import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/dexie';
import { Button, Card, Field, PageHeader, SectionTitle, Select, Skeleton, TextInput, cx } from '../../components/ui';
import LogoPicker from '../../components/LogoPicker';
import { Download, FileUp, Plus, Trash2, Trophy, Tv, Upload, Coins } from 'lucide-react';
import { confirmAction } from '../../components/ConfirmSheet';
import {
  FORMAT_LABELS,
  FORMAT_TEAM_SIZE,
  type EventTeam,
  type GolfSession,
  type Match,
  type MatchFormat,
  type MatchParticipant,
  type Player,
  type Side,
} from '../../domain/model';
import { computeMatch } from '../../services/scoring';
import { eventStandings, type MatchSummary } from '../../services/standings';
import { parseTeamStructure } from '../../services/rosterImport';
import { useIsAdmin, useCurrentPlayer } from '../../lib/identity';

const FORMATS = Object.keys(FORMAT_LABELS) as MatchFormat[];

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function EventDetailPage() {
  const { eventId = '' } = useParams();
  const event = useLiveQuery(() => db.events.get(eventId), [eventId]);
  const teams = useLiveQuery(() => db.eventTeams.where('eventId').equals(eventId).toArray(), [eventId]);
  const roster = useLiveQuery(() => db.eventPlayers.where('eventId').equals(eventId).toArray(), [eventId]);
  const allPlayers = useLiveQuery(() => db.players.toArray(), []);
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
  const courses = useLiveQuery(() => db.courses.toArray(), []);
  const isAdmin = useIsAdmin();
  const me = useCurrentPlayer();

  if (!event || !teams || !allPlayers || !sessions || !matches || !participants || !scores || !courses) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const teamA = teams.find((t) => t.side === 'a');
  const teamB = teams.find((t) => t.side === 'b');
  const playersMap = new Map(allPlayers.map((p) => [p.id, p]));
  const rosterFor = (teamId: string): { ep: string; player: Player }[] =>
    (roster ?? [])
      .filter((r) => r.teamId === teamId)
      .map((r) => ({ ep: r.id, player: playersMap.get(r.playerId) }))
      .filter((x): x is { ep: string; player: Player } => Boolean(x.player));
  const assignedIds = new Set((roster ?? []).map((r) => r.playerId));
  const unassigned = allPlayers.filter((p) => !assignedIds.has(p.id));

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const eventCourseName = courseById.get(event.courseId)?.name;
  const courseForMatch = (m: Match) => {
    const session = sessions.find((s) => s.id === m.sessionId);
    return courseById.get(session?.courseId ?? event.courseId);
  };

  const summaries: MatchSummary[] = matches.map((m) => {
    const parts = participants.filter((p) => p.matchId === m.id);
    const matchCourse = courseForMatch(m);
    const hasBothSides = parts.some((p) => p.side === 'a') && parts.some((p) => p.side === 'b');
    if (!matchCourse || !hasBothSides) {
      return { match: m, result: null, status: '—', decided: false };
    }
    const res = computeMatch({
      match: m,
      course: matchCourse,
      participants: parts,
      players: playersMap,
      scores: scores.filter((s) => s.matchId === m.id),
    });
    return { match: m, result: res.state.result, status: res.state.status, decided: res.state.decided };
  });
  const standings = eventStandings(event, summaries);

  const myMatchIds = new Set(
    me ? participants.filter((p) => p.playerId === me.id).map((p) => p.matchId) : [],
  );
  const visibleMatchesFor = (sid: string) =>
    matches.filter((m) => m.sessionId === sid && (isAdmin || myMatchIds.has(m.id)));
  const visibleSessions = isAdmin ? sessions : sessions.filter((s) => visibleMatchesFor(s.id).length > 0);

  async function addSession() {
    const count = sessions!.length;
    const nextDate = count > 0 ? addDays(sessions![count - 1].date ?? event!.startDate, 1) : event!.startDate;
    await db.sessions.add({
      id: newId(),
      eventId,
      name: `Round ${count + 1}`,
      date: nextDate,
      sequence: count + 1,
    });
  }

  async function removeSession(session: GolfSession) {
    const sessionMatches = matches!.filter((m) => m.sessionId === session.id);
    const label =
      sessionMatches.length > 0
        ? `Delete "${session.name}" and its ${sessionMatches.length} match${sessionMatches.length === 1 ? '' : 'es'} (including all scores)?`
        : `Delete "${session.name}"?`;
    if (!(await confirmAction({ title: label, confirmText: 'Delete', danger: true }))) return;
    const matchIds = sessionMatches.map((m) => m.id);
    if (matchIds.length) {
      await db.scores.where('matchId').anyOf(matchIds).delete();
      await db.participants.where('matchId').anyOf(matchIds).delete();
      await db.matches.where('sessionId').equals(session.id).delete();
    }
    await db.sessions.delete(session.id);
  }

  return (
    <div>
      <PageHeader
        title={event.name}
        action={
          <Link to={`/events/${eventId}/board`}>
            <Button variant="outline" size="sm">
              <Tv className="h-4 w-4" /> Overall Leaderboard
            </Button>
          </Link>
        }
      />

      {teamA && teamB && (
        <StandingsBar
          teamA={teamA}
          teamB={teamB}
          pointsA={standings.teamA}
          pointsB={standings.teamB}
          clinched={standings.clinched}
        />
      )}

      <Link
        to={`/events/${eventId}/games`}
        className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white py-2 text-sm font-semibold text-ink/70 transition hover:bg-black/[0.02]"
      >
        <Coins className="h-4 w-4 text-gold-500" /> Skins &amp; Nassau
      </Link>

      <section className="mt-6">
        <SectionTitle>Rosters</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {teamA && <RosterColumn team={teamA} members={rosterFor(teamA.id)} admin={isAdmin} />}
          {teamB && <RosterColumn team={teamB} members={rosterFor(teamB.id)} admin={isAdmin} />}
        </div>
        {isAdmin && teamA && teamB && (
          <RosterBuilder eventId={eventId} teamA={teamA} teamB={teamB} unassigned={unassigned} />
        )}
      </section>

      <section className="mt-6">
        <SectionTitle
          action={
            isAdmin ? (
              <Button variant="ghost" size="sm" onClick={addSession}>
                <Plus className="h-4 w-4" /> Round
              </Button>
            ) : undefined
          }
        >
          {isAdmin ? 'Matches' : 'My Matches'}
        </SectionTitle>
        {!isAdmin && visibleSessions.length === 0 && (
          <p className="rounded-xl bg-sand-50 px-3 py-3 text-xs text-ink/55">
            No matches assigned to you yet. Your admin will set the lineups.
          </p>
        )}
        {visibleSessions.map((s) => (
          <div key={s.id} className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-green-700">{s.name}</p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => removeSession(s)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove round
                </button>
              )}
            </div>
            {isAdmin ? (
              <div className="mb-2 grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={s.date ?? ''}
                  onChange={(e) => db.sessions.update(s.id, { date: e.target.value })}
                  className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-500"
                />
                <Select
                  value={s.courseId ?? ''}
                  onChange={(e) => db.sessions.update(s.id, { courseId: e.target.value || undefined })}
                  className="py-1.5 text-xs"
                >
                  <option value="">Event course{eventCourseName ? ` · ${eventCourseName}` : ''}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <p className="mb-2 text-[11px] text-ink/45">
                {s.date ?? ''}
                {s.courseId
                  ? ` · ${courses.find((c) => c.id === s.courseId)?.name ?? ''}`
                  : eventCourseName
                    ? ` · ${eventCourseName}`
                    : ''}
              </p>
            )}
            <div className="space-y-2">
              {visibleMatchesFor(s.id).map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  eventId={eventId}
                  participants={participants.filter((p) => p.matchId === m.id)}
                  playersMap={playersMap}
                  teamA={teamA}
                  teamB={teamB}
                  rosterA={teamA ? rosterFor(teamA.id).map((x) => x.player) : []}
                  rosterB={teamB ? rosterFor(teamB.id).map((x) => x.player) : []}
                  summary={summaries.find((x) => x.match.id === m.id)}
                  admin={isAdmin}
                />
              ))}
            </div>
            {isAdmin && (
              <AddMatchForm eventId={eventId} sessionId={s.id} count={matches.filter((m) => m.sessionId === s.id).length} />
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function StandingsBar({
  teamA,
  teamB,
  pointsA,
  pointsB,
  clinched,
}: {
  teamA: EventTeam;
  teamB: EventTeam;
  pointsA: number;
  pointsB: number;
  clinched: 'a' | 'b' | 'tie' | null;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-raise">
      <div className="mb-4 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
        <Trophy className="h-3.5 w-3.5 text-gold-400" /> Match Points
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <HeroTeam team={teamA} points={pointsA} clinched={clinched === 'a'} align="right" />
        <span className="text-lg font-black text-white/30">–</span>
        <HeroTeam team={teamB} points={pointsB} clinched={clinched === 'b'} align="left" />
      </div>
      {clinched === 'tie' && (
        <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-widest text-white/70">
          Match tied
        </p>
      )}
    </div>
  );
}

function HeroTeam({
  team,
  points,
  clinched,
  align,
}: {
  team: EventTeam;
  points: number;
  clinched: boolean;
  align: 'left' | 'right';
}) {
  const right = align === 'right';
  return (
    <div className={cx('flex items-center gap-3', right && 'flex-row-reverse text-right')}>
      {team.logoDataUrl ? (
        <img
          src={team.logoDataUrl}
          alt=""
          className="h-12 w-12 rounded-xl object-cover ring-2 ring-white/25"
        />
      ) : (
        <span
          className="h-11 w-11 rounded-xl ring-2 ring-white/25"
          style={{ backgroundColor: team.color }}
        />
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white/90">{team.name}</p>
        <p className="text-5xl font-black leading-none tabular">{points}</p>
        {clinched && (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gold-300">
            <Trophy className="h-3 w-3" /> Clinched
          </span>
        )}
      </div>
    </div>
  );
}

function TeamMark({ team, size = 14 }: { team: EventTeam; size?: number }) {
  return team.logoDataUrl ? (
    <img
      src={team.logoDataUrl}
      alt=""
      className="rounded object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="inline-block rounded-full"
      style={{ width: size, height: size, backgroundColor: team.color }}
    />
  );
}

function RosterColumn({
  team,
  members,
  admin,
}: {
  team: EventTeam;
  members: { ep: string; player: Player }[];
  admin: boolean;
}) {
  return (
    <Card>
      {admin ? (
        <div className="mb-3 space-y-2">
          <LogoPicker
            value={team.logoDataUrl}
            onChange={(url) => db.eventTeams.update(team.id, { logoDataUrl: url })}
            size={40}
            fallbackColor={team.color}
          />
          <input
            key={team.name}
            defaultValue={team.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== team.name) db.eventTeams.update(team.id, { name: v });
              else e.target.value = team.name;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            aria-label="Team name"
            className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-green-950 outline-none hover:border-black/10 focus:border-brand-500 focus:bg-white"
          />
        </div>
      ) : (
        <div className="mb-2 flex items-center gap-1.5">
          <TeamMark team={team} size={16} />
          <span className="text-sm font-semibold text-green-950">{team.name}</span>
        </div>
      )}
      {members.length === 0 && <p className="text-xs text-green-600">No players yet.</p>}
      <ul className="space-y-1">
        {members.map(({ ep, player }) => (
          <li key={ep} className="flex items-center justify-between gap-1 text-sm">
            <span className="truncate text-green-950">
              {player.firstName} {player.lastName}
            </span>
            {admin && (
              <button
                onClick={() => db.eventPlayers.delete(ep)}
                className="text-xs text-red-500"
                aria-label="Remove from team"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RosterBuilder({
  eventId,
  teamA,
  teamB,
  unassigned,
}: {
  eventId: string;
  teamA: EventTeam;
  teamB: EventTeam;
  unassigned: Player[];
}) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [hi, setHi] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState('');
  const [bulkSide, setBulkSide] = useState<'a' | 'b'>('a');
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function quickAdd(teamId: string) {
    const fn = first.trim();
    const ln = last.trim();
    if (!fn && !ln) return;
    const playerId = newId();
    await db.players.add({ id: playerId, firstName: fn || ln, lastName: fn ? ln : '', handicapIndex: Number(hi) || 0 });
    await db.eventPlayers.add({ id: newId(), eventId, teamId, playerId });
    setFirst('');
    setLast('');
    setHi('');
  }

  async function assignExisting(teamId: string, playerId: string) {
    await db.eventPlayers.add({ id: newId(), eventId, teamId, playerId });
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBulk(await file.text());
    setShowBulk(true);
  }

  async function importRoster() {
    const fallbackTeamId = bulkSide === 'a' ? teamA.id : teamB.id;
    const { golfers, skipped } = parseTeamStructure(bulk, teamA, teamB, fallbackTeamId);
    for (const g of golfers) {
      const playerId = newId();
      await db.players.add({
        id: playerId,
        firstName: g.firstName,
        lastName: g.lastName,
        handicapIndex: g.handicapIndex,
        ghinNumber: g.ghinNumber,
      });
      await db.eventPlayers.add({ id: newId(), eventId, teamId: g.teamId, playerId });
    }
    setImportMsg(
      golfers.length
        ? `Imported ${golfers.length} golfer${golfers.length === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}.`
        : 'No golfers found — check the format.',
    );
    if (golfers.length) setBulk('');
  }

  function downloadTemplate() {
    const rows = [
      'Team,First,Last,Handicap,GHIN',
      `${teamA.name},Rory,McIlroy,8.4,1234567`,
      `${teamB.name},Jon,Rahm,5.2,`,
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cherokee-cup-roster-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const teamButton = (team: EventTeam, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-3 py-2 text-sm font-semibold"
      style={{ backgroundColor: `${team.color}22`, color: team.color }}
    >
      + {team.name}
    </button>
  );

  return (
    <Card className="mt-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Add golfers</p>

      <div className="grid grid-cols-2 gap-2">
        <TextInput placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
        <TextInput placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
        <TextInput
          placeholder="Handicap index"
          inputMode="decimal"
          value={hi}
          onChange={(e) => setHi(e.target.value)}
        />
        {teamButton(teamA, () => quickAdd(teamA.id))}
        {teamButton(teamB, () => quickAdd(teamB.id))}
      </div>

      {unassigned.length > 0 && (
        <div className="border-t border-green-100 pt-2">
          <p className="mb-1 text-[11px] font-medium text-green-600">Add an existing golfer</p>
          <div className="space-y-1">
            {unassigned.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-green-950">
                  {p.firstName} {p.lastName}{' '}
                  <span className="text-xs text-green-600">({p.handicapIndex.toFixed(1)})</span>
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" onClick={() => assignExisting(teamA.id, p.id)}>
                    {teamA.name}
                  </Button>
                  <Button variant="ghost" onClick={() => assignExisting(teamB.id, p.id)}>
                    {teamB.name}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-black/5 pt-2.5">
        <button
          type="button"
          onClick={() => setShowBulk((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700"
        >
          <Upload className="h-3.5 w-3.5" /> {showBulk ? 'Hide roster upload' : 'Upload / paste a roster'}
        </button>
        {showBulk && (
          <div className="mt-2.5 space-y-2.5">
            <p className="text-[11px] leading-relaxed text-ink/55">
              Format per line:{' '}
              <span className="font-semibold text-ink/75">Team, First, Last, Handicap, GHIN</span> (GHIN
              optional; a header row is fine).
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100">
                <FileUp className="h-4 w-4" /> Choose CSV file
                <input type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={onFile} />
              </label>
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700"
              >
                <Download className="h-4 w-4" /> Download template
              </button>
            </div>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={5}
              placeholder={'Team, First, Last, Handicap, GHIN\nReds, Rory, McIlroy, 8.4, 1234567\nBlues, Jon, Rahm, 5.2'}
              className="w-full rounded-xl border border-black/10 p-2.5 text-sm text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <span className="text-[11px] text-ink/55">No team? →</span>
              <Select value={bulkSide} onChange={(e) => setBulkSide(e.target.value as 'a' | 'b')}>
                <option value="a">{teamA.name}</option>
                <option value="b">{teamB.name}</option>
              </Select>
              <Button onClick={importRoster}>Import</Button>
            </div>
            {importMsg && <p className="text-[11px] font-semibold text-brand-700">{importMsg}</p>}
          </div>
        )}
      </div>
    </Card>
  );
}

function MatchCard({
  match,
  eventId,
  participants,
  playersMap,
  teamA,
  teamB,
  rosterA,
  rosterB,
  summary,
  admin,
}: {
  match: Match;
  eventId: string;
  participants: MatchParticipant[];
  playersMap: Map<string, Player>;
  teamA?: EventTeam;
  teamB?: EventTeam;
  rosterA: Player[];
  rosterB: Player[];
  summary?: MatchSummary;
  admin: boolean;
}) {
  const size = FORMAT_TEAM_SIZE[match.format];
  const partsA = participants.filter((p) => p.side === 'a');
  const partsB = participants.filter((p) => p.side === 'b');
  const ready = partsA.length === size && partsB.length === size;

  const names = (parts: MatchParticipant[]) =>
    parts
      .map((p) => playersMap.get(p.playerId))
      .filter(Boolean)
      .map((p) => `${p!.firstName} ${p!.lastName[0]}.`)
      .join(' & ') || '—';

  const leaderColor =
    summary?.decided && summary.result === 'a'
      ? teamA?.color
      : summary?.decided && summary.result === 'b'
        ? teamB?.color
        : undefined;

  async function addParticipant(side: Side, playerId: string) {
    if (!playerId) return;
    await db.participants.add({ id: newId(), matchId: match.id, side, playerId });
  }

  async function removeParticipant(participantId: string) {
    if (!(await confirmAction({ title: 'Remove this player from the match?', confirmText: 'Remove', danger: true }))) return;
    await db.scores.where('participantId').equals(participantId).delete();
    await db.participants.delete(participantId);
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase text-green-600">{FORMAT_LABELS[match.format]}</p>
          <p className="font-semibold text-green-950">{match.name}</p>
        </div>
        <div className="text-right">
          <span
            className="rounded-full px-2 py-1 text-xs font-bold"
            style={{ backgroundColor: (leaderColor ?? '#dcfce7') + '33', color: leaderColor ?? '#166534' }}
          >
            {summary?.status ?? '—'}
          </span>
          <p className="mt-1 text-[10px] text-green-600">{match.pointsValue} pt</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
        <span className="truncate text-right font-medium text-green-950">{names(partsA)}</span>
        <span className="text-xs text-green-500">v</span>
        <span className="truncate font-medium text-green-950">{names(partsB)}</span>
      </div>

      {admin && teamA && teamB && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-green-100 pt-3">
          <LineupPicker
            label={teamA.name}
            color={teamA.color}
            parts={partsA}
            size={size}
            playersMap={playersMap}
            options={rosterA.filter((p) => !partsA.some((x) => x.playerId === p.id))}
            onPick={(id) => addParticipant('a', id)}
            onRemove={removeParticipant}
          />
          <LineupPicker
            label={teamB.name}
            color={teamB.color}
            parts={partsB}
            size={size}
            playersMap={playersMap}
            options={rosterB.filter((p) => !partsB.some((x) => x.playerId === p.id))}
            onPick={(id) => addParticipant('b', id)}
            onRemove={removeParticipant}
          />
        </div>
      )}

      {!ready && !admin && (
        <p className="mt-3 border-t border-green-100 pt-3 text-[11px] text-ink/45">Lineup not set yet.</p>
      )}

      {ready && (
        <div className="mt-3">
          <Link to={`/events/${eventId}/matches/${match.id}`}>
            <Button className="w-full">Score match</Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

function LineupPicker({
  label,
  color,
  parts,
  size,
  options,
  playersMap,
  onPick,
  onRemove,
}: {
  label: string;
  color: string;
  parts: MatchParticipant[];
  size: number;
  options: Player[];
  playersMap: Map<string, Player>;
  onPick: (playerId: string) => void;
  onRemove: (participantId: string) => void;
}) {
  const full = parts.length >= size;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate text-[11px] font-semibold text-green-800">
          {label} ({parts.length}/{size})
        </span>
      </div>
      {parts.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {parts.map((p) => {
            const pl = playersMap.get(p.playerId);
            return (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-900"
              >
                {pl ? `${pl.firstName} ${pl.lastName[0]}.` : '\u2014'}
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  aria-label="Remove player"
                  className="text-green-600 hover:text-red-600"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}
      {!full && (
        <Select
          value=""
          disabled={options.length === 0}
          onChange={(e) => onPick(e.target.value)}
          aria-label={`Add ${label} player`}
        >
          <option value="" disabled>
            + Add player
          </option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

function AddMatchForm({ eventId, sessionId, count }: { eventId: string; sessionId: string; count: number }) {
  const [format, setFormat] = useState<MatchFormat>('singles_1v1');
  const [points, setPoints] = useState('1');

  async function add(e: FormEvent) {
    e.preventDefault();
    const match: Match = {
      id: newId(),
      eventId,
      sessionId,
      format,
      name: `Match ${count + 1}`,
      numHoles: 18,
      startHole: 1,
      pointsValue: Number(points) || 1,
      status: 'pending',
    };
    await db.matches.add(match);
  }

  return (
    <form onSubmit={add} className="mt-2 grid grid-cols-[1fr_4rem_auto] items-end gap-2">
      <Field label="Add match">
        <Select value={format} onChange={(e) => setFormat(e.target.value as MatchFormat)}>
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {FORMAT_LABELS[f]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Pts">
        <TextInput value={points} onChange={(e) => setPoints(e.target.value)} inputMode="decimal" />
      </Field>
      <Button type="submit" variant="ghost">
        Add
      </Button>
    </form>
  );
}
