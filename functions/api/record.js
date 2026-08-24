// POST   /api/record  { store, record }      -> upsert
// DELETE /api/record?store=&id=              -> tombstone (kept so deletes propagate)

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const store = body && body.store;
  const record = body && body.record;
  if (!store || !record || record.id == null) {
    return Response.json({ error: 'store and record.id required' }, { status: 400 });
  }
  try {
    await env.DB.prepare(
      `INSERT INTO records (store, id, doc, deleted, updated_at)
       VALUES (?1, ?2, ?3, 0, ?4)
       ON CONFLICT(store, id) DO UPDATE SET doc = ?3, deleted = 0, updated_at = ?4`,
    )
      .bind(store, String(record.id), JSON.stringify(record), Date.now())
      .run();
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String((err && err.message) || err) }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const store = url.searchParams.get('store');
  const id = url.searchParams.get('id');
  if (!store || !id) {
    return Response.json({ error: 'store and id required' }, { status: 400 });
  }
  try {
    await env.DB.prepare(
      `INSERT INTO records (store, id, doc, deleted, updated_at)
       VALUES (?1, ?2, ?3, 1, ?4)
       ON CONFLICT(store, id) DO UPDATE SET deleted = 1, updated_at = ?4`,
    )
      .bind(store, String(id), JSON.stringify({ id: String(id) }), Date.now())
      .run();
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String((err && err.message) || err) }, { status: 500 });
  }
}
