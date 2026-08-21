import { db } from '../db/dexie';
import { exportAll, importAll, type BackupFile } from './backup';

// A second, independent copy of the data in localStorage. If IndexedDB is ever cleared
// or corrupted (but localStorage survives), we auto-restore from this on next launch.
const KEY = 'cc:autobackup';
const MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;

// Drop bulky logo data URLs so the snapshot fits localStorage; scores/rosters are what matter.
function slim(backup: BackupFile): BackupFile {
  const data: Record<string, unknown[]> = {};
  for (const [table, rows] of Object.entries(backup.data)) {
    data[table] = rows.map((r) => {
      if (r && typeof r === 'object' && 'logoDataUrl' in (r as Record<string, unknown>)) {
        const rest = { ...(r as Record<string, unknown>) };
        delete rest.logoDataUrl;
        return rest;
      }
      return r;
    });
  }
  return { ...backup, data };
}

export async function snapshotToLocal(): Promise<void> {
  try {
    const backup = await exportAll();
    // Never overwrite a good snapshot with an empty one (e.g., right after a wipe).
    const empty =
      (backup.data.players?.length ?? 0) === 0 && (backup.data.events?.length ?? 0) === 0;
    if (empty) return;
    localStorage.setItem(KEY, JSON.stringify(slim(backup)));
  } catch {
    /* quota/serialization issue — manual Backup still available */
  }
}

/** Restore from the local snapshot only when the database looks freshly emptied. */
export async function recoverFromLocalIfEmpty(): Promise<boolean> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    // Only recover when there is genuinely nothing to clobber.
    const [events, players] = await Promise.all([db.events.count(), db.players.count()]);
    if (events > 0 || players > 0) return false;
    const backup = JSON.parse(raw) as BackupFile;
    const hasData =
      backup?.data && Array.isArray(backup.data.players) && backup.data.players.length > 0;
    if (!hasData) return false;
    if (backup.exportedAt && Date.now() - Date.parse(backup.exportedAt) > MAX_AGE_MS) return false;
    await importAll(backup);
    return true;
  } catch {
    return false;
  }
}

let started = false;
export function startAutoSnapshot(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const save = () => void snapshotToLocal();
  setInterval(save, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('pagehide', save);
  setTimeout(save, 3000);
}
