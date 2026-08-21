import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { db, newId } from '../../db/dexie';
import { AdminOnly, Badge, Button, Card, Empty, Field, PageHeader, TextInput, cx } from '../../components/ui';
import { getGhinProxy, isGhinConfigured, lookupGhin, setGhinProxy } from '../../services/ghinApi';
import { useIsAdmin, useIdentity } from '../../lib/identity';
import { confirmAction } from '../../components/ConfirmSheet';
import { toast } from '../../components/Toast';
import type { Player } from '../../domain/model';

export default function PlayersPage() {
  const isAdmin = useIsAdmin();
  const identity = useIdentity();
  const players = useLiveQuery(() => db.players.orderBy('lastName').toArray(), []);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [hi, setHi] = useState('');
  const [club, setClub] = useState('');
  const [ghin, setGhin] = useState('');
  const [email, setEmail] = useState('');
  const [ghinReady, setGhinReady] = useState(isGhinConfigured());
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!first.trim() || !last.trim()) return;
    const player: Player = {
      id: newId(),
      firstName: first.trim(),
      lastName: last.trim(),
      handicapIndex: Number(hi) || 0,
      homeClub: club.trim() || undefined,
      ghinNumber: ghin.trim() || undefined,
      email: email.trim() || undefined,
    };
    await db.players.add(player);
    setFirst('');
    setLast('');
    setHi('');
    setClub('');
    setGhin('');
    setEmail('');
  }

  async function syncGhin(p: Player) {
    if (!p.ghinNumber) return;
    setSyncMsg(`Syncing ${p.firstName}…`);
    try {
      const r = await lookupGhin(p.ghinNumber);
      await db.players.update(p.id, { handicapIndex: r.handicapIndex });
      setSyncMsg(`${p.firstName} ${p.lastName}: HI ${r.handicapIndex.toFixed(1)}`);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'GHIN sync failed.');
    }
  }

  async function removePlayer(p: Player) {
    if (p.id === identity) {
      toast("Sign out first — you can't remove the profile you're signed in as.", 'error');
      return;
    }
    const eps = await db.eventPlayers.where('playerId').equals(p.id).toArray();
    const parts = await db.participants.where('playerId').equals(p.id).toArray();
    const extra =
      eps.length || parts.length
        ? ` This also removes them from ${eps.length} roster spot(s) and ${parts.length} match lineup(s), including their scores.`
        : '';
    if (!(await confirmAction({ title: `Remove ${p.firstName} ${p.lastName}?`, message: extra.trim() || undefined, confirmText: 'Remove', danger: true }))) return;
    if (parts.length) {
      const pids = parts.map((x) => x.id);
      await db.scores.where('participantId').anyOf(pids).delete();
      await db.participants.bulkDelete(pids);
    }
    if (eps.length) await db.eventPlayers.bulkDelete(eps.map((x) => x.id));
    await db.players.delete(p.id);
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Players" />
        <AdminOnly message="Only the admin can add or edit players and handicaps." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Players" />
      <GhinPanel ready={ghinReady} onChange={setGhinReady} />
      {syncMsg && <p className="mb-3 text-xs font-semibold text-brand-700">{syncMsg}</p>}
      <Card className="mb-4">
        <form onSubmit={add} className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <TextInput value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Rory" />
          </Field>
          <Field label="Last name">
            <TextInput value={last} onChange={(e) => setLast(e.target.value)} placeholder="McIlroy" />
          </Field>
          <Field label="Handicap Index">
            <TextInput
              value={hi}
              onChange={(e) => setHi(e.target.value)}
              inputMode="decimal"
              placeholder="8.4"
            />
          </Field>
          <Field label="Home club (optional)">
            <TextInput value={club} onChange={(e) => setClub(e.target.value)} placeholder="Pinehurst" />
          </Field>
          <Field label="GHIN # (optional)">
            <TextInput
              value={ghin}
              onChange={(e) => setGhin(e.target.value)}
              inputMode="numeric"
              placeholder="1234567"
            />
          </Field>
          <div className="col-span-2">
            <Field label="Email (for player login)">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rory@email.com"
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Button type="submit">Add player</Button>
          </div>
        </form>
      </Card>

      {players && players.length === 0 && <Empty>No players yet. Add your group above.</Empty>}
      <ul className="space-y-2">
        {players?.map((p) => (
          <li key={p.id}>
            <Card>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-green-950">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-xs text-green-700">
                    HI {p.handicapIndex.toFixed(1)}
                    {p.homeClub ? ` · ${p.homeClub}` : ''}
                    {p.ghinNumber ? ` · GHIN ${p.ghinNumber}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {ghinReady && p.ghinNumber && (
                    <Button variant="ghost" onClick={() => syncGhin(p)}>
                      Sync
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => removePlayer(p)}>
                    Remove
                  </Button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-[6.5rem_1fr] gap-2">
                <TextInput
                  inputMode="decimal"
                  defaultValue={String(p.handicapIndex)}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isNaN(n) && n !== p.handicapIndex)
                      db.players.update(p.id, { handicapIndex: n });
                  }}
                  placeholder="HCP"
                />
                <TextInput
                  type="email"
                  defaultValue={p.email ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (p.email ?? '')) db.players.update(p.id, { email: v || undefined });
                  }}
                  placeholder="Login email (so they can sign in)"
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GhinPanel({ ready, onChange }: { ready: boolean; onChange: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(getGhinProxy());
  return (
    <Card className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <RefreshCw className="h-4 w-4 text-brand-600" /> GHIN auto-sync
          {ready ? <Badge tone="brand">connected</Badge> : <Badge tone="neutral">off</Badge>}
        </span>
        <ChevronDown className={cx('h-4 w-4 text-ink/40 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-3 space-y-2 border-t border-black/5 pt-3">
          <p className="text-[11px] leading-relaxed text-ink/55">
            There's no public GHIN API (it's USGA partner-only). If you have authorized access, host a
            small proxy and paste its URL here to auto-fill handicaps by GHIN number.
          </p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <TextInput
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-ghin-proxy/lookup"
            />
            <Button
              type="button"
              onClick={() => {
                setGhinProxy(url);
                onChange(isGhinConfigured());
              }}
            >
              Save
            </Button>
          </div>
          {ready && (
            <p className="text-[11px] font-semibold text-brand-700">
              Connected — use “Sync” on a player to fetch their Handicap Index.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
