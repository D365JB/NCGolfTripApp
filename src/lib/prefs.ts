import { useSyncExternalStore } from 'react';

/** Lightweight UI preferences that live only on this device. */

const OUTDOOR_KEY = 'cc:outdoor';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function isOutdoor(): boolean {
  try {
    return localStorage.getItem(OUTDOOR_KEY) === '1';
  } catch {
    return false;
  }
}

function applyOutdoor(on: boolean) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('outdoor', on);
  }
}

/** Apply the saved outdoor setting to <html>. Call once at boot. */
export function initOutdoor(): void {
  applyOutdoor(isOutdoor());
}

export function setOutdoor(on: boolean): void {
  try {
    if (on) localStorage.setItem(OUTDOOR_KEY, '1');
    else localStorage.removeItem(OUTDOOR_KEY);
  } catch {
    /* ignore */
  }
  applyOutdoor(on);
  emit();
}

export function useOutdoor(): boolean {
  return useSyncExternalStore(subscribe, isOutdoor, () => false);
}

/* ---- Theme (system-aware light/dark) --------------------------------- */

export type Theme = 'system' | 'light' | 'dark';
const THEME_KEY = 'cc:theme';
const themeListeners = new Set<() => void>();

function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

function effectiveDark(t: Theme): boolean {
  return t === 'dark' || (t === 'system' && systemPrefersDark());
}

function applyTheme(t: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', effectiveDark(t));
  }
}

/** Apply the saved theme to <html> and follow OS changes. Call once at boot. */
export function initTheme(): void {
  applyTheme(getStoredTheme());
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system');
      themeListeners.forEach((l) => l());
    }
  });
}

export function setTheme(t: Theme): void {
  try {
    if (t === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
  applyTheme(t);
  themeListeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      themeListeners.add(cb);
      return () => {
        themeListeners.delete(cb);
      };
    },
    getStoredTheme,
    () => 'system',
  );
}
