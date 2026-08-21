import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';
import type { Player } from '../domain/model';

// Device-local auth. No server yet: the signed-in playerId, the admin PIN, and the admin
// unlock flag all live in localStorage so the app works offline on the course. This is an
// honor-system gate today; it maps cleanly onto real accounts + row-level security later.
const KEY = 'cc:identityPlayerId';
const PIN_KEY = 'cc:adminPin';
const UNLOCK_KEY = 'cc:adminUnlocked';
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}
function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string | null): void {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === PIN_KEY || e.key === UNLOCK_KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

// --- Identity (who is on this device) ---
export function setIdentity(playerId: string | null): void {
  lsSet(KEY, playerId);
  if (!playerId) lsSet(UNLOCK_KEY, null); // signing out also locks admin mode
  notify();
}

/** Reactive: the player id this device is scoring as, or null. */
export function useIdentity(): string | null {
  return useSyncExternalStore(subscribe, () => lsGet(KEY), () => null);
}

/** Reactive: the full Player record for this device, or undefined. */
export function useCurrentPlayer(): Player | undefined {
  const id = useIdentity();
  return useLiveQuery(() => (id ? db.players.get(id) : undefined), [id]);
}

/** Find a player by email (case-insensitive) and sign in as them. Returns the id or null. */
export async function signInByEmail(email: string): Promise<string | null> {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;
  const all = await db.players.toArray();
  const match = all.find((p) => p.email?.trim().toLowerCase() === needle);
  if (!match) return null;
  setIdentity(match.id);
  return match.id;
}

// --- Admin gate (single admin, PIN-protected on the device) ---
function obfuscate(pin: string): string {
  // Not real cryptography — just keeps the PIN out of plain sight in devtools. Real
  // enforcement arrives with server-side auth + RLS.
  try {
    return btoa(`cc:${pin}`);
  } catch {
    return `cc:${pin}`;
  }
}
export function hasAdminPin(): boolean {
  return !!lsGet(PIN_KEY);
}
export function setAdminPin(pin: string): void {
  lsSet(PIN_KEY, obfuscate(pin));
  notify();
}
export function verifyAdminPin(pin: string): boolean {
  const stored = lsGet(PIN_KEY);
  return !!stored && stored === obfuscate(pin);
}
export function unlockAdmin(pin: string): boolean {
  if (!verifyAdminPin(pin)) return false;
  lsSet(UNLOCK_KEY, '1');
  notify();
  return true;
}
export function lockAdmin(): void {
  lsSet(UNLOCK_KEY, null);
  notify();
}

/** Reactive: whether admin mode is unlocked on this device. */
export function useAdminUnlocked(): boolean {
  return useSyncExternalStore(subscribe, () => lsGet(UNLOCK_KEY) === '1', () => false);
}

/** Reactive: true only when signed in as an admin AND admin mode is unlocked here. */
export function useIsAdmin(): boolean {
  const me = useCurrentPlayer();
  const unlocked = useAdminUnlocked();
  return me?.role === 'admin' && unlocked;
}

