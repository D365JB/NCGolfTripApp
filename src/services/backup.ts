import { db } from '../db/dexie';

// Every store, in dependency-friendly order for restore.
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

const EXPORT_KEY = 'cc:lastExport';

/** Record that an off-device backup was exported (drives the save reminder). */
export function recordExport(scoreCount: number): void {
  try {
    localStorage.setItem(EXPORT_KEY, JSON.stringify({ count: scoreCount, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function getLastExport(): { count: number; at: number } | null {
  try {
    const raw = localStorage.getItem(EXPORT_KEY);
    return raw ? (JSON.parse(raw) as { count: number; at: number }) : null;
  } catch {
    return null;
  }
}

export interface BackupFile {
  app: 'cherokee-cup';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

/** Snapshot every table into a plain object for download. */
export async function exportAll(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  for (const name of STORES) data[name] = await db.table(name).toArray();
  return { app: 'cherokee-cup', version: 1, exportedAt: new Date().toISOString(), data };
}

/** Trigger a browser download of the backup as a JSON file. */
export function downloadBackup(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cherokee-cup-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Replace all local data with a backup, atomically (rolls back on any error). */
export async function importAll(backup: BackupFile): Promise<void> {
  if (!backup || backup.app !== 'cherokee-cup' || typeof backup.data !== 'object') {
    throw new Error('Not a Cherokee Cup backup file.');
  }
  await db.transaction('rw', db.tables, async () => {
    for (const name of STORES) {
      const rows = backup.data[name];
      const table = db.table(name);
      await table.clear();
      if (Array.isArray(rows) && rows.length) await table.bulkAdd(rows);
    }
  });
}
