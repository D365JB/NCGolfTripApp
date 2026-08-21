import { Navigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { useCurrentPlayer } from '../../lib/identity';

// Sends a signed-in player to the overall leaderboard of their most recent event.
export default function MyBoardRedirect() {
  const me = useCurrentPlayer();
  const eventId = useLiveQuery(async () => {
    if (!me) return null;
    const rosters = await db.eventPlayers.where('playerId').equals(me.id).toArray();
    const ids = [...new Set(rosters.map((r) => r.eventId))];
    if (ids.length === 0) return null;
    const events = (await Promise.all(ids.map((id) => db.events.get(id)))).filter(
      (e): e is NonNullable<typeof e> => !!e,
    );
    if (events.length === 0) return null;
    events.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
    return events[0].id;
  }, [me?.id]);

  if (eventId === undefined) {
    return <div className="grid min-h-dvh place-items-center bg-slate-950 text-white/60">Loading…</div>;
  }
  if (eventId === null) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-950 px-6 text-center text-white/70">
        <div>
          <p className="text-sm font-semibold">No leaderboard yet</p>
          <p className="mt-1 text-xs text-white/50">
            {me ? "You're not in any rounds yet." : 'Sign in to see your leaderboard.'}
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white"
          >
            Back to app
          </Link>
        </div>
      </div>
    );
  }
  return <Navigate to={`/events/${eventId}/board`} replace />;
}
