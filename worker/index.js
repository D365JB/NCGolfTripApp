// Cloudflare Worker: serves the built SPA (static assets) and the /api routes
// backed by D1. This replaces the Pages Functions so `wrangler deploy` works
// (Workers Builds git integration runs `npx wrangler deploy`).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      try {
        // GET /api/sync -> every record (including tombstones)
        if (url.pathname === '/api/sync' && request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT store, id, doc, deleted, updated_at FROM records',
          ).all();
          return json(
            (results || []).map((r) => ({
              store: r.store,
              id: r.id,
              record: r.doc ? JSON.parse(r.doc) : null,
              deleted: !!r.deleted,
              updatedAt: r.updated_at || 0,
            })),
          );
        }

        // POST /api/record { store, record } -> upsert
        if (url.pathname === '/api/record' && request.method === 'POST') {
          let body;
          try {
            body = await request.json();
          } catch {
            return json({ error: 'invalid JSON body' }, 400);
          }
          const store = body && body.store;
          const record = body && body.record;
          if (!store || !record || record.id == null) {
            return json({ error: 'store and record.id required' }, 400);
          }
          await env.DB.prepare(
            `INSERT INTO records (store, id, doc, deleted, updated_at)
             VALUES (?1, ?2, ?3, 0, ?4)
             ON CONFLICT(store, id) DO UPDATE SET doc = ?3, deleted = 0, updated_at = ?4`,
          )
            .bind(store, String(record.id), JSON.stringify(record), Date.now())
            .run();
          return json({ ok: true });
        }

        // DELETE /api/record?store=&id= -> tombstone
        if (url.pathname === '/api/record' && request.method === 'DELETE') {
          const store = url.searchParams.get('store');
          const id = url.searchParams.get('id');
          if (!store || !id) return json({ error: 'store and id required' }, 400);
          await env.DB.prepare(
            `INSERT INTO records (store, id, doc, deleted, updated_at)
             VALUES (?1, ?2, ?3, 1, ?4)
             ON CONFLICT(store, id) DO UPDATE SET deleted = 1, updated_at = ?4`,
          )
            .bind(store, String(id), JSON.stringify({ id: String(id) }), Date.now())
            .run();
          return json({ ok: true });
        }

        if (url.pathname === '/api/ping') return json({ ok: true, worker: true });

        return json({ error: 'not found' }, 404);
      } catch (err) {
        return json({ error: String((err && err.message) || err) }, 500);
      }
    }

    // Everything else -> static assets (SPA fallback via not_found_handling).
    return env.ASSETS.fetch(request);
  },
};
