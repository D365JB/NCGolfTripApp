import { db } from '../db/dexie';

/**
 * Cloud sync: keeps the local Dexie DB mirrored with a shared Cloudflare D1
 * database (via Pages Functions at /api). Design goals:
 *  - Local-first: the UI always reads/writes Dexie; sync happens in the background.
 *  - Per-record: every store row is an individual D1 row so concurrent scorers on
 *    different phones don't clobber each other (no whole-blob writes).
 *  - Delete-safe: deletes are tombstoned server-side so they propagate to peers.
 *  - Offline-tolerant: outgoing writes queue in an outbox and retry on each tick.
 */

const API = '/api';
const POLL_MS = 4000;

const STORES = [
  'players',
  'teamIdentities',
  'courses',
  'events',
  'eventTeams',
  'eventPlayers',
  'sessions',
  'matches',
  'participants',
  'scores',
] as const;
type StoreName = (typeof STORES)[number];
const STORE_SET = new Set<string>(STORES);

type RemoteRecord = {
  store: StoreName;
  id: string;
  record: Record<string, unknown> | null;
  deleted: boolean;
  updatedAt: number;
};

type Push =
  | { store: StoreName; op: 'upsert'; id: string; record: Record<string, unknown> }
  | { store: StoreName; op: 'delete'; id: string };

let enabled = false;
let applyingRemote = false;
let flushing = false;
const outbox: Push[] = [];

function table(store: StoreName) {
  return (db as unknown as Record<string, import('dexie').Table<Record<string, unknown>, string>>)[store];
}

/** fetch with a hard timeout so a hung/unreachable backend can never wedge boot or polling. */
function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  let signal: AbortSignal | undefined;
  try {
    signal = AbortSignal.timeout(8000);
  } catch {
    signal = undefined;
  }
  return fetch(`${API}${path}`, { cache: 'no-store', ...init, signal });
}

/**
 * Detect the cloud API, hydrate local state, then start hooks + polling.
 * Safe to call fire-and-forget: it never throws and returns false when there is
 * no reachable backend (the app then runs purely local-first).
 */
export async function startCloudSync(): Promise<boolean> {
  let records: RemoteRecord[];
  try {
    const res = await apiFetch('/sync');
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return false; // dev server SPA fallback etc.
    records = (await res.json()) as RemoteRecord[];
  } catch {
    return false; // offline or no API -> stay local-only
  }

  enabled = true;
  await applyRemote(records);
  installHooks();
  window.setInterval(tick, POLL_MS);
  window.addEventListener('online', () => void tick());
  return true;
}

/** Apply a remote snapshot to Dexie without echoing the writes back out. */
async function applyRemote(records: RemoteRecord[]): Promise<void> {
  applyingRemote = true;
  try {
    for (const r of records) {
      if (!STORE_SET.has(r.store)) continue;
      try {
        if (r.deleted) {
          if ((await table(r.store).get(r.id)) !== undefined) {
            await table(r.store).delete(r.id);
          }
        } else if (r.record) {
          const existing = await table(r.store).get(r.id);
          if (JSON.stringify(existing) !== JSON.stringify(r.record)) {
            await table(r.store).put(r.record as Record<string, unknown>);
          }
        }
      } catch {
        /* ignore a single bad row */
      }
    }
  } finally {
    applyingRemote = false;
  }
}

/** Mirror local Dexie mutations into the outbox for pushing to the cloud. */
function installHooks(): void {
  for (const store of STORES) {
    // Dexie's hook overloads are narrow; use a loose handle for registration.
    const t = table(store) as unknown as {
      hook(name: 'creating', cb: (pk: string, obj: Record<string, unknown>) => void): void;
      hook(name: 'updating', cb: (mods: Record<string, unknown>, pk: string, obj: Record<string, unknown>) => void): void;
      hook(name: 'deleting', cb: (pk: string) => void): void;
    };
    t.hook('creating', (pk: string, obj: Record<string, unknown>) => {
      if (applyingRemote) return;
      const id = String((pk ?? (obj as { id?: string }).id) ?? '');
      if (id) enqueue({ store, op: 'upsert', id, record: { ...obj, id } });
    });
    t.hook('updating', (mods: Record<string, unknown>, pk: string, obj: Record<string, unknown>) => {
      if (applyingRemote) return;
      const id = String(pk);
      enqueue({ store, op: 'upsert', id, record: { ...obj, ...mods, id } });
    });
    t.hook('deleting', (pk: string) => {
      if (applyingRemote) return;
      enqueue({ store, op: 'delete', id: String(pk) });
    });
  }
}

function enqueue(p: Push): void {
  // collapse older pending writes for the same row
  const i = outbox.findIndex((q) => q.store === p.store && q.id === p.id);
  if (i >= 0) outbox.splice(i, 1);
  outbox.push(p);
  void flush();
}

async function flush(): Promise<void> {
  if (flushing || !enabled) return;
  flushing = true;
  try {
    while (outbox.length) {
      const p = outbox[0];
      try {
        if (p.op === 'upsert') {
          const res = await apiFetch('/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store: p.store, record: p.record }),
          });
          if (!res.ok) break;
        } else {
          const res = await apiFetch(
            `/record?store=${encodeURIComponent(p.store)}&id=${encodeURIComponent(p.id)}`,
            { method: 'DELETE' },
          );
          if (!res.ok) break;
        }
        outbox.shift(); // delivered
      } catch {
        break; // offline; retry on next tick
      }
    }
  } finally {
    flushing = false;
  }
}

async function tick(): Promise<void> {
  await flush();
  try {
    const res = await apiFetch('/sync');
    if (!res.ok) return;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return;
    await applyRemote((await res.json()) as RemoteRecord[]);
  } catch {
    /* offline; try again next tick */
  }
}

/**
 * One-time helper to push the entire local DB up to the cloud (used to seed a
 * fresh D1 database from an existing device). Safe to call repeatedly.
 * Run from the console: `await window.__seedCloud()`.
 */
export async function seedCloudFromLocal(): Promise<number> {
  let count = 0;
  for (const store of STORES) {
    const rows = (await table(store).toArray()) as Record<string, unknown>[];
    for (const record of rows) {
      const res = await apiFetch('/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store, record }),
      });
      if (res.ok) count++;
    }
  }
  return count;
}
