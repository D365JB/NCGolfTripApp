import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Flag } from 'lucide-react';
import { db, newId } from '../../db/dexie';
import { Button, TextInput } from '../../components/ui';
import { setIdentity, signInByEmail } from '../../lib/identity';
import type { Player } from '../../domain/model';

// Full-screen local sign-in gate. Identity persists per-device in localStorage; no
// password (honor-system) until the cloud backend is enabled.
export default function LoginScreen() {
  const players = useLiveQuery(() => db.players.orderBy('lastName').toArray(), []);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [logoSrc, setLogoSrc] = useState('/logo.png');

  const noPlayers = players !== undefined && players.length === 0;

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    const id = await signInByEmail(email);
    if (!id) setErr('No profile with that email yet. Pick your name below or create a profile.');
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!first.trim() || !last.trim()) {
      setErr('Enter your first and last name.');
      return;
    }
    const id = newId();
    const player: Player = {
      id,
      firstName: first.trim(),
      lastName: last.trim(),
      handicapIndex: 0,
      email: cEmail.trim() || undefined,
    };
    await db.players.add(player);
    setIdentity(id);
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
          <p className="mt-1 text-sm text-white/60">Sign in on this device to score your matches.</p>
        </div>

        <div className="rounded-3xl bg-white p-4 text-ink shadow-raise">
          {players === undefined ? (
            <p className="py-6 text-center text-sm text-ink/50">Loading…</p>
          ) : noPlayers ? (
            <form onSubmit={onCreate} className="space-y-3">
              <p className="text-sm font-bold">Welcome — create your profile</p>
              <p className="text-[11px] text-ink/55">
                You'll be the first user on this device and can become the admin next.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <TextInput value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" />
                <TextInput value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" />
              </div>
              <TextInput
                type="email"
                value={cEmail}
                onChange={(e) => setCEmail(e.target.value)}
                placeholder="Email (to sign in later)"
                autoComplete="email"
              />
              {err && <p className="text-[11px] font-semibold text-rose-600">{err}</p>}
              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          ) : (
            <form onSubmit={onEmail} className="space-y-2">
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
              />
              {err && <p className="px-1 text-[11px] font-semibold text-rose-600">{err}</p>}
              <Button type="submit" className="w-full">
                Continue
              </Button>
              <p className="px-1 pt-1 text-center text-[11px] text-ink/45">
                Use the email your admin added for you.
              </p>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-[11px] text-white/45">You'll stay signed in on this device.</p>
      </div>
    </div>
  );
}
