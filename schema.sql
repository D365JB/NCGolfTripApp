-- Cherokee Cup shared sync store (Cloudflare D1 / SQLite).
-- Apply with: wrangler d1 execute cherokee-cup-db --file schema.sql --remote
create table if not exists records (
  store       text    not null,
  id          text    not null,
  doc         text    not null default '{}',   -- JSON string
  deleted     integer not null default 0,       -- 0/1
  updated_at  integer not null default 0,
  primary key (store, id)
);
