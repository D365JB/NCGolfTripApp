const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

let container;
function getContainer() {
  if (!container) {
    const conn = process.env.COSMOS_CONNECTION_STRING;
    if (!conn) throw new Error('COSMOS_CONNECTION_STRING not configured');
    const client = new CosmosClient(conn);
    container = client.database('cherokeecup').container('records');
  }
  return container;
}

// GET /api/ping -> health check that does NOT touch Cosmos
app.http('ping', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'ping',
  handler: async () => ({
    jsonBody: {
      ok: true,
      node: process.version,
      hasConn: !!process.env.COSMOS_CONNECTION_STRING,
    },
  }),
});

// GET /api/sync -> every record (including tombstones) so clients can reconcile
app.http('sync', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'sync',
  handler: async (_request, context) => {
    try {
      const c = getContainer();
      const { resources } = await c.items
        .query('SELECT c.id, c.store, c.doc, c.deleted, c.updatedAt FROM c')
        .fetchAll();
      return {
        headers: { 'Cache-Control': 'no-store' },
        jsonBody: resources.map((r) => ({
          store: r.store,
          id: r.id,
          record: r.doc,
          deleted: !!r.deleted,
          updatedAt: r.updatedAt || 0,
        })),
      };
    } catch (err) {
      context.error('sync failed', err);
      return {
        status: 500,
        jsonBody: {
          error: String((err && err.message) || err),
          hasConn: !!process.env.COSMOS_CONNECTION_STRING,
        },
      };
    }
  },
});

// POST /api/record  { store, record }        -> upsert
// DELETE /api/record?store=&id=              -> tombstone (kept so deletes propagate)
app.http('record', {
  methods: ['POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'record',
  handler: async (request, context) => {
    try {
      const c = getContainer();

      if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'invalid JSON body' } };
      }
      const store = body && body.store;
      const record = body && body.record;
      if (!store || !record || record.id == null) {
        return { status: 400, jsonBody: { error: 'store and record.id required' } };
      }
      await c.items.upsert({
        id: String(record.id),
        store,
        doc: record,
        deleted: false,
        updatedAt: Date.now(),
      });
      return { jsonBody: { ok: true } };
    }

    // DELETE
    const store = request.query.get('store');
    const id = request.query.get('id');
    if (!store || !id) {
      return { status: 400, jsonBody: { error: 'store and id required' } };
    }
    await c.items.upsert({
      id: String(id),
      store,
      doc: { id: String(id) },
      deleted: true,
      updatedAt: Date.now(),
    });
    return { jsonBody: { ok: true } };
    } catch (err) {
      context.error('record failed', err);
      return { status: 500, jsonBody: { error: String((err && err.message) || err) } };
    }
  },
});
