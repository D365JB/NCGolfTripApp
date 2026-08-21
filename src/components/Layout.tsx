import { useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trophy, Users, Shield, Flag, User, Lock, LogOut, ShieldCheck, ListOrdered, Save, Sun, Moon, Monitor } from 'lucide-react';
import { Button, TextInput, cx } from './ui';
import { db } from '../db/dexie';
import {
  useIdentity,
  setIdentity,
  useCurrentPlayer,
  useAdminUnlocked,
  useIsAdmin,
  unlockAdmin,
  lockAdmin,
  setAdminPin,
} from '../lib/identity';
import LoginScreen from '../features/auth/LoginScreen';
import InstallPrompt from './InstallPrompt';
import { exportAll, downloadBackup, recordExport, getLastExport } from '../services/backup';
import { useOutdoor, setOutdoor, useTheme, setTheme, type Theme } from '../lib/prefs';
import { Toaster, toast } from './Toast';
import { ConfirmHost } from './ConfirmSheet';

// Prefers a user-supplied /logo.png, then the bundled /logo.svg, then the flag mark.
function BrandMark() {
  const [src, setSrc] = useState('/logo.png');
  return src ? (
    <img
      src={src}
      alt="Cherokee Cup"
      onError={() => setSrc((s) => (s === '/logo.png' ? '/logo.svg' : ''))}
      className="h-9 w-9 rounded-xl object-cover object-left shadow-sm ring-1 ring-black/10"
    />
  ) : (
    <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
      <Flag className="h-4 w-4" strokeWidth={2.5} />
    </span>
  );
}

const adminTabs = [
  { to: '/', label: 'Events', icon: Trophy, end: true },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/teams', label: 'Teams', icon: Shield },
  { to: '/courses', label: 'Courses', icon: Flag },
];
const playerTabs = [
  { to: '/', label: 'My Rounds', icon: Trophy, end: true },
  { to: '/my/board', label: 'Leaderboard', icon: ListOrdered },
];

function AccountSheet({ onClose }: { onClose: () => void }) {
  const me = useCurrentPlayer();
  const outdoor = useOutdoor();
  const theme = useTheme();
  const unlocked = useAdminUnlocked();
  const adminCount = useLiveQuery(() => db.players.filter((p) => p.role === 'admin').count(), []) ?? 0;
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ startY: number; dy: number } | null>(null);
  function onDragStart(e: ReactPointerEvent) {
    e.preventDefault(); // suppress the compatibility mouse-click that would follow the drag
    drag.current = { startY: e.clientY, dy: 0 };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function onDragMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d) return;
    d.dy = Math.max(0, e.clientY - d.startY);
    setDragY(d.dy);
  }
  function onDragEnd() {
    const d = drag.current;
    drag.current = null;
    if (d && d.dy > 110) {
      if ('vibrate' in navigator) navigator.vibrate(8);
      onClose();
      return;
    }
    setDragY(0);
  }

  async function becomeAdmin(e: FormEvent) {
    e.preventDefault();
    if (!me) return;
    if (pin.trim().length < 4) {
      setPinErr('Choose a PIN of at least 4 digits.');
      return;
    }
    await db.players.update(me.id, { role: 'admin' });
    setAdminPin(pin.trim());
    unlockAdmin(pin.trim());
    setPin('');
    setPinErr(null);
  }

  function doUnlock(e: FormEvent) {
    e.preventDefault();
    if (!unlockAdmin(pin.trim())) {
      setPinErr('Incorrect PIN.');
      return;
    }
    setPin('');
    setPinErr(null);
  }

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[85dvh] max-w-xl overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-raise animate-in"
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? 'none' : 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className="mx-auto mb-3 flex h-6 w-full touch-none cursor-grab items-center justify-center active:cursor-grabbing"
        >
          <div className="h-1.5 w-10 rounded-full bg-black/15" />
        </div>
        {me ? (
          <div className="mb-3 flex items-center gap-3 px-1">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {me.firstName[0]}
              {me.lastName[0]}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
                {me.firstName} {me.lastName}
                {me.role === 'admin' && <ShieldCheck className="h-3.5 w-3.5 text-gold-500" />}
              </p>
              {me.email && <p className="truncate text-[11px] text-ink/50">{me.email}</p>}
            </div>
          </div>
        ) : (
          <p className="mb-3 px-1 text-sm text-ink/60">Not signed in.</p>
        )}

        <div className="rounded-2xl border border-black/5 bg-sand-50 p-3">
          {!me ? (
            <p className="text-[11px] text-ink/55">Sign in to manage admin access.</p>
          ) : me.role === 'admin' ? (
            unlocked ? (
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700">
                  <ShieldCheck className="h-4 w-4" /> Admin mode on
                </span>
                <button
                  onClick={lockAdmin}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-ink/50 hover:text-ink"
                >
                  <Lock className="h-3.5 w-3.5" /> Lock
                </button>
              </div>
            ) : (
              <form onSubmit={doUnlock} className="space-y-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-bold text-ink">
                  <Lock className="h-4 w-4 text-ink/50" /> Unlock admin
                </p>
                <div className="flex gap-2">
                  <TextInput
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      setPinErr(null);
                    }}
                    placeholder="Admin PIN"
                  />
                  <Button type="submit" variant="secondary">
                    Unlock
                  </Button>
                </div>
              </form>
            )
          ) : adminCount === 0 ? (
            <form onSubmit={becomeAdmin} className="space-y-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold text-ink">
                <ShieldCheck className="h-4 w-4 text-gold-500" /> Become the admin
              </p>
              <p className="text-[11px] text-ink/55">
                You'll be the only one who can set up events, teams, courses, and players. Choose a PIN to
                protect it.
              </p>
              <div className="flex gap-2">
                <TextInput
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setPinErr(null);
                  }}
                  placeholder="Create a PIN (4+ digits)"
                />
                <Button type="submit">Save</Button>
              </div>
            </form>
          ) : (
            <p className="text-[11px] text-ink/55">Setup is managed by the admin.</p>
          )}
          {pinErr && <p className="mt-1 text-[11px] font-semibold text-rose-600">{pinErr}</p>}
        </div>

        <div className="mt-2 rounded-2xl border border-black/5 bg-sand-50 p-1">
          <div className="grid grid-cols-3 gap-1">
            {(['system', 'light', 'dark'] as Theme[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTheme(t);
                  navigator.vibrate?.(5);
                }}
                className={cx(
                  'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold capitalize transition',
                  theme === t ? 'seg-pill bg-white text-ink shadow-sm' : 'text-ink/50',
                )}
              >
                {t === 'system' ? (
                  <Monitor className="h-3.5 w-3.5" />
                ) : t === 'light' ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
                {t}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setOutdoor(!outdoor);
            navigator.vibrate?.(5);
          }}
          aria-pressed={outdoor}
          className="mt-2 flex w-full items-center justify-between rounded-2xl border border-black/5 bg-sand-50 px-3 py-2.5"
        >
          <span className="inline-flex items-center gap-2 text-xs font-bold text-ink">
            <Sun className="h-4 w-4 text-gold-500" /> Outdoor mode
            <span className="font-medium text-ink/50">bright-sun contrast</span>
          </span>
          <span
            className={cx(
              'relative h-5 w-9 shrink-0 rounded-full transition-colors',
              outdoor ? 'bg-brand-600' : 'bg-black/15',
            )}
          >
            <span
              className={cx(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
                outdoor ? 'left-[1.15rem]' : 'left-0.5',
              )}
            />
          </span>
        </button>

        <button
          onClick={() => {
            setIdentity(null);
            onClose();
          }}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-center text-xs font-semibold text-ink/50 hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out of this device
        </button>
      </div>
    </div>
  );
}

function IdentityButton() {
  const identity = useIdentity();
  const players = useLiveQuery(() => db.players.orderBy('lastName').toArray(), []);
  const unlocked = useAdminUnlocked();
  const [open, setOpen] = useState(false);
  const me = players?.find((p) => p.id === identity) ?? null;
  const isAdmin = me?.role === 'admin' && unlocked;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ml-auto flex items-center gap-2 rounded-full border border-black/10 bg-white/70 py-1 pl-1 pr-2.5 text-xs font-semibold text-ink shadow-sm transition active:scale-95"
      >
        <span
          className={cx(
            'grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white',
            me ? 'bg-brand-600' : 'bg-ink/30',
          )}
        >
          {me ? `${me.firstName[0]}${me.lastName[0]}` : <User className="h-4 w-4" />}
        </span>
        <span className="max-w-[86px] truncate">{me ? me.firstName : 'Sign in'}</span>
        {isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-gold-500" />}
      </button>
      {open && createPortal(<AccountSheet onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function SaveReminder() {
  const count = useLiveQuery(() => db.scores.count(), []) ?? 0;
  const [snoozeUntil, setSnoozeUntil] = useState(0);
  const last = getLastExport();
  const since = count - (last?.count ?? 0);
  if (since < 20 || Date.now() < snoozeUntil) return null;

  async function save() {
    const backup = await exportAll();
    downloadBackup(backup);
    recordExport(backup.data.scores?.length ?? 0);
    setSnoozeUntil(Date.now() + 60 * 60 * 1000);
    toast('Backup saved to your device');
  }

  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-gold-300 bg-gold-300/10 px-3 py-2 text-xs">
      <Save className="h-4 w-4 shrink-0 text-gold-600" />
      <p className="flex-1 font-semibold text-ink/80">
        {since} new scores since your last backup — save a copy.
      </p>
      <button
        onClick={save}
        className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1 font-bold text-white"
      >
        Save
      </button>
      <button
        onClick={() => setSnoozeUntil(Date.now() + 30 * 60 * 1000)}
        className="shrink-0 font-semibold text-ink/45"
      >
        Later
      </button>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const identity = useIdentity();
  const tabs = isAdmin ? adminTabs : playerTabs;
  if (!identity) return <LoginScreen />;
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-20 border-b border-black/[0.05] bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center gap-2.5 px-4 py-3">
          <BrandMark />
          <span className="text-[15px] font-extrabold tracking-tight text-ink">
            Cherokee Cup<span className="text-brand-600"> Golf App</span>
          </span>
          <IdentityButton />
        </div>
      </header>

      <div className="px-4 pt-3 empty:hidden">
        <SaveReminder />
        <InstallPrompt />
      </div>

      <main key={location.pathname} className="flex-1 animate-in px-4 pb-28 pt-5">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/[0.06] bg-white/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-stretch px-2">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              onClick={() => 'vibrate' in navigator && navigator.vibrate(6)}
              className="flex flex-1 flex-col items-center py-2"
            >
              {({ isActive }) => (
                <span className="flex flex-col items-center gap-1">
                  <span
                    className={cx(
                      'flex h-9 w-14 items-center justify-center rounded-full transition-colors',
                      isActive ? 'bg-brand-100 text-brand-700 tab-pop' : 'text-ink/40',
                    )}
                  >
                    <t.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.6 : 2} />
                  </span>
                  <span
                    className={cx(
                      'text-[10.5px] font-semibold transition-colors',
                      isActive ? 'text-brand-700' : 'text-ink/45',
                    )}
                  >
                    {t.label}
                  </span>
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      <Toaster />
      <ConfirmHost />
    </div>
  );
}
