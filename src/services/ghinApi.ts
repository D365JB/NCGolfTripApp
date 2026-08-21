// Authorized GHIN lookup. There is NO public GHIN API — it is USGA partner-only —
// so this calls a proxy endpoint YOU configure (env VITE_GHIN_PROXY_URL or the
// in-app field). It never handles GHIN login credentials.

const PROXY_STORAGE = 'ghin_proxy';

export function getGhinProxy(): string {
  return import.meta.env.VITE_GHIN_PROXY_URL || localStorage.getItem(PROXY_STORAGE) || '';
}
export function setGhinProxy(url: string): void {
  if (url.trim()) localStorage.setItem(PROXY_STORAGE, url.trim());
  else localStorage.removeItem(PROXY_STORAGE);
}
export function isGhinConfigured(): boolean {
  return Boolean(getGhinProxy());
}

export interface GhinLookup {
  ghinNumber: string;
  handicapIndex: number;
  firstName?: string;
  lastName?: string;
  club?: string;
}

/** Parse a WHS index string, treating a leading "+" as a plus (negative) handicap. */
export function parseHandicapIndex(value: unknown): number {
  if (typeof value === 'number') return value;
  const s = String(value ?? '').trim();
  if (!s) return 0;
  if (s.startsWith('+')) {
    const n = parseFloat(s.slice(1));
    return Number.isFinite(n) ? -n : 0;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Map a proxy response (single golfer or { golfers: [...] }) to our shape. */
export function mapGhinResponse(ghinNumber: string, raw: unknown): GhinLookup {
  const r = raw as Record<string, unknown>;
  const golfer =
    (r?.golfer as Record<string, unknown>) ??
    (Array.isArray(r?.golfers) ? (r.golfers[0] as Record<string, unknown>) : undefined) ??
    r ??
    {};
  const hi =
    golfer.handicap_index ?? golfer.hi_value ?? golfer.hi_display ?? golfer.handicapIndex ?? golfer.value;
  return {
    ghinNumber: String(golfer.ghin ?? golfer.ghin_number ?? ghinNumber),
    handicapIndex: parseHandicapIndex(hi),
    firstName: (golfer.first_name ?? golfer.firstName) as string | undefined,
    lastName: (golfer.last_name ?? golfer.lastName) as string | undefined,
    club: (golfer.club_name ?? golfer.club) as string | undefined,
  };
}

export async function lookupGhin(ghinNumber: string): Promise<GhinLookup> {
  const proxy = getGhinProxy();
  if (!proxy) throw new Error('GHIN lookup is not configured.');
  const url = `${proxy}${proxy.includes('?') ? '&' : '?'}ghin=${encodeURIComponent(ghinNumber)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GHIN lookup failed (${res.status})`);
  return mapGhinResponse(ghinNumber, await res.json());
}
