import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, CalendarDays, MapPin, ChevronRight, Trophy, Download, Upload } from 'lucide-react';
import { db } from '../../db/dexie';
import { Badge, Button, Card, Empty, PageHeader } from '../../components/ui';
import { useIsAdmin, useCurrentPlayer } from '../../lib/identity';
import { exportAll, downloadBackup, importAll, recordExport } from '../../services/backup';
import { toast } from '../../components/Toast';
import { confirmAction } from '../../components/ConfirmSheet';

const STATUS_TONE = { setup: 'gold', active: 'brand', complete: 'neutral' } as const;

function BackupCard() {
  const [msg, setMsg] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  async function download() {
    try {
      const backup = await exportAll();
      downloadBackup(backup);
      recordExport(backup.data.scores?.length ?? 0);
      setMsg('Backup file downloaded. Keep it somewhere safe.');
      toast('Backup downloaded');
    } catch {
      setMsg('Could not create a backup.');
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!(await confirmAction({ title: 'Restore from backup?', message: 'This replaces ALL data on this device with the backup file.', confirmText: 'Restore', danger: true }))) return;
    try {
      const parsed = JSON.parse(await file.text());
      await importAll(parsed);
      recordExport(parsed?.data?.scores?.length ?? 0);
      setMsg('Restored. Reloading…');
      setTimeout(() => location.reload(), 700);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Restore failed — not a valid backup file.');
    }
  }

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">Your data is safe</p>
          <p className="text-[11px] text-ink/55">
            Scores save automatically and self-restore on this device — no manual backups needed.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={download}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import
          </Button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onFile} />
      {msg && <p className="mt-2 text-[11px] font-semibold text-brand-700">{msg}</p>}
      {persisted === false && (
        <p className="mt-2 rounded-lg border border-gold-300 bg-gold-300/10 px-2 py-1.5 text-[11px] font-semibold text-gold-600">
          Tip: add the app to your Home Screen for the most durable storage.
        </p>
      )}
    </Card>
  );
}

export default function EventsListPage() {
  const isAdmin = useIsAdmin();
  const me = useCurrentPlayer();
  const allEvents = useLiveQuery(() => db.events.orderBy('startDate').reverse().toArray(), []);
  const courses = useLiveQuery(() => db.courses.toArray(), []);
  const myRoster = useLiveQuery(
    () => (me ? db.eventPlayers.where('playerId').equals(me.id).toArray() : []),
    [me?.id],
  );
  const courseName = (id: string) => courses?.find((c) => c.id === id)?.name ?? '—';
  const myEventIds = new Set((myRoster ?? []).map((r) => r.eventId));
  const events = isAdmin ? allEvents : allEvents?.filter((e) => myEventIds.has(e.id));

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Events' : 'My Rounds'}
        subtitle={isAdmin ? 'Your team matches' : "Rounds you're playing in"}
        action={
          isAdmin ? (
            <Link to="/events/new">
              <Button>
                <Plus className="h-4 w-4" strokeWidth={2.5} /> New
              </Button>
            </Link>
          ) : undefined
        }
      />
      {isAdmin && <BackupCard />}
      {!isAdmin && !me && (
        <Empty>
          <Trophy className="mx-auto mb-2 h-7 w-7 text-brand-300" />
          Sign in from the top-right to see your rounds.
        </Empty>
      )}
      {events && events.length === 0 && (isAdmin || me) && (
        <Empty>
          <Trophy className="mx-auto mb-2 h-7 w-7 text-brand-300" />
          {isAdmin
            ? 'No events yet. Create your first team match.'
            : "You're not in any rounds yet. Your admin adds you to a team."}
        </Empty>
      )}
      <ul className="space-y-3">
        {events?.map((ev) => (
          <li key={ev.id}>
            <Link to={`/events/${ev.id}`} className="block">
              <Card interactive className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold text-ink">{ev.name}</p>
                    <Badge tone={STATUS_TONE[ev.status]}>{ev.status}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-ink/55">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {ev.startDate}
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{courseName(ev.courseId)}</span>
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink/25" />
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
