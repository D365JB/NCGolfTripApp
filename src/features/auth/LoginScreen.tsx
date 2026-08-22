import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Flag } from 'lucide-react';
import { db, newId } from '../../db/dexie';
import { Button, TextInput } from '../../components/ui';
import { setIdentity, signInByEmail } from '../../lib/identity';
import type { Player } from '../../domain/model';

// Derive a display name from an email's local part for the first bootstrap profile.
function nameFromEmail(addr: string): { firstName: string; lastName: string } {
  const parts = (addr.split('@')[0] ?? '').split(/[._+-]+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return {
    firstName: parts[0] ? cap(parts[0]) : 'Player',
    lastName: parts.length > 1 ? parts.slice(1).map(cap).join(' ') : '',
  };
}

// Full-screen local sign-in gate. Email-only, honor-system, per-device.
export default function LoginScreen() {
  const playerCount = useLiveQuery(() => db.players.count(), []);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoSrc, setLogoSrc] = useState('/logo.png');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setErr('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const id = await signInByEmail(addr);
      if (id) return; // matched an existing profile
      if (playerCount === 0) {
        // First user on a fresh device: bootstrap a profile from the email.
        const { firstName, lastName } = nameFromEmail(addr);
        const first: Player = { id: newId(), firstName, lastName, handicapIndex: 0, email: addr };
        await db.players.add(first);
        setIdentity(first.id);
        return;
      }
      setErr('No profile with that email yet — ask your admin to add it.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-brand-700 via-brand-800 to-brand-950 px-5 py-10 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="Cherokee Cup"
              onError={() => setLogoSrc((s) => (s === '/logo.png' ? '/logo.svg' : ''))}
              className="h-20 w-20 rounded-2xl object-cover shadow-raise ring-1 ring-white/20"
            />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <Flag className="h-8 w-8 text-gold-300" strokeWidth={2.5} />
            </span>
          )}
          <h1 className="mt-3 text-2xl font-black tracking-tight">Cherokee Cup</h1>
          <p className="mt-1 text-sm text-white/60">Sign in with your email to score your matches.</p>
        </div>

        <div className="rounded-3xl bg-white p-4 text-ink shadow-raise">
          <form onSubmit={onSubmit} className="space-y-2">
            <label className="px-1 text-xs font-semibold text-ink/60">Email</label>
            <TextInput
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErr(null);
              }}
              placeholder="you@email.com"
              autoComplete="email"
              autoFocus
            />
            {err && <p className="px-1 text-[11px] font-semibold text-rose-600">{err}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Continue'}
            </Button>
            <p className="px-1 pt-1 text-center text-[11px] text-ink/45">
              Use the email your admin added for you.
            </p>
          </form>
        </div>
        <p className="mt-4 text-center text-[11px] text-white/45">You'll stay signed in on this device.</p>
      </div>
    </div>
  );
}
