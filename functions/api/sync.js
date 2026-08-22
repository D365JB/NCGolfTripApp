// GET /api/sync -> every record (including tombstones) so clients can reconcile.
export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      'SELECT store, id, doc, deleted, updated_at FROM records',
    ).all();
    const body = (results || []).map((r) => ({
      store: r.store,
      id: r.id,
      record: r.doc ? JSON.parse(r.doc) : null,
      deleted: !!r.deleted,
      updatedAt: r.updated_at || 0,
    }));
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return Response.json({ error: String((err && err.message) || err) }, { status: 500 });
  }
}
