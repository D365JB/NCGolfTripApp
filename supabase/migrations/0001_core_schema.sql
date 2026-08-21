-- NC Golf Trip — core schema (Supabase / Postgres)
-- Deliverable for the live-sync backend. Apply with the Supabase CLI once a project exists:
--   supabase db push   (or)   supabase migration up
-- Mirrors the local-first model in src/domain/model.ts so a sync adapter maps 1:1.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Identity: profiles are real app users (Google/Apple/email login), with real names.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  first_name   text not null default '',
  last_name    text not null default '',
  avatar_url   text,
  handicap_index numeric(4, 1),
  home_club    text,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'given_name', split_part(coalesce(new.raw_user_meta_data ->> 'full_name', ''), ' ', 1)),
    coalesce(new.raw_user_meta_data ->> 'family_name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Roster people. A player may be linked to a login profile, or be a guest.
-- ---------------------------------------------------------------------------
create table if not exists players (
  id                uuid primary key default gen_random_uuid(),
  first_name        text not null,
  last_name         text not null,
  handicap_index    numeric(4, 1) not null default 0,
  home_club         text,
  linked_profile_id uuid references profiles (id) on delete set null,
  created_by        uuid not null references profiles (id) on delete cascade,
  created_at        timestamptz not null default now()
);

create table if not exists team_identities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default '#166534',
  logo_url   text,
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Courses (API-sourced or manual) with per-hole par + stroke index.
-- ---------------------------------------------------------------------------
create table if not exists courses (
  id            uuid primary key default gen_random_uuid(),
  external_id   text,
  name          text not null,
  city          text,
  state         text not null default 'NC',
  par           int not null,
  course_rating numeric(4, 1) not null,
  slope_rating  int not null,
  source        text not null default 'manual' check (source in ('manual', 'api')),
  created_by    uuid references profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists course_holes (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses (id) on delete cascade,
  hole         int not null,
  par          int not null,
  stroke_index int not null,
  yardage      int,
  green_lat    double precision,
  green_lng    double precision,
  unique (course_id, hole)
);

-- ---------------------------------------------------------------------------
-- Events (Team vs Team), sessions, matches, participants, scores.
-- event_id is denormalized onto child tables to keep RLS checks simple.
-- ---------------------------------------------------------------------------
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_date  date not null,
  course_id   uuid references courses (id) on delete set null,
  status      text not null default 'setup' check (status in ('setup', 'active', 'complete')),
  points_win  numeric(4, 2) not null default 1,
  points_tie  numeric(4, 2) not null default 0.5,
  spectator_token text unique default encode(gen_random_bytes(8), 'hex'),
  created_by  uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists event_teams (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events (id) on delete cascade,
  team_identity_id  uuid references team_identities (id) on delete set null,
  side              text not null check (side in ('a', 'b')),
  name              text not null,
  color             text not null default '#166534',
  unique (event_id, side)
);

create table if not exists event_players (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references events (id) on delete cascade,
  team_id   uuid not null references event_teams (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  unique (event_id, player_id)
);

create table if not exists sessions (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references events (id) on delete cascade,
  name      text not null,
  date      date,
  sequence  int not null default 1
);

create table if not exists matches (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events (id) on delete cascade,
  session_id   uuid not null references sessions (id) on delete cascade,
  format       text not null check (format in ('singles_1v1', 'best_ball_2', 'foursomes_2', 'scramble_2')),
  name         text not null,
  num_holes    int not null default 18,
  start_hole   int not null default 1,
  points_value numeric(4, 2) not null default 1,
  status       text not null default 'pending' check (status in ('pending', 'active', 'final')),
  created_at   timestamptz not null default now()
);

create table if not exists match_participants (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references matches (id) on delete cascade,
  event_id  uuid not null references events (id) on delete cascade,
  side      text not null check (side in ('a', 'b')),
  player_id uuid not null references players (id) on delete cascade
);

create table if not exists scores (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references matches (id) on delete cascade,
  event_id       uuid not null references events (id) on delete cascade,
  side           text not null check (side in ('a', 'b')),
  participant_id uuid references match_participants (id) on delete cascade,
  hole           int not null,
  gross          int not null,
  putts          int,
  fairway_hit    boolean,
  updated_at     timestamptz not null default now(),
  unique (match_id, side, coalesce(participant_id, '00000000-0000-0000-0000-000000000000'::uuid), hole)
);

create index if not exists idx_scores_match on scores (match_id);
create index if not exists idx_matches_event on matches (event_id);
create index if not exists idx_participants_match on match_participants (match_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles          enable row level security;
alter table players           enable row level security;
alter table team_identities   enable row level security;
alter table courses           enable row level security;
alter table course_holes      enable row level security;
alter table events            enable row level security;
alter table event_teams       enable row level security;
alter table event_players     enable row level security;
alter table sessions          enable row level security;
alter table matches           enable row level security;
alter table match_participants enable row level security;
alter table scores            enable row level security;

-- Membership helper: event creator, or a profile linked to a rostered player.
create or replace function public.is_event_member(target_event uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from events e where e.id = target_event and e.created_by = auth.uid())
      or exists (
        select 1 from event_players ep
        join players p on p.id = ep.player_id
        where ep.event_id = target_event and p.linked_profile_id = auth.uid()
      );
$$;

-- Profiles: everyone signed in can read names; you edit only your own.
create policy profiles_read   on profiles for select to authenticated using (true);
create policy profiles_update on profiles for update to authenticated using (id = auth.uid());

-- Reference data: readable by any signed-in user; mutable by its creator.
create policy players_read   on players for select to authenticated using (true);
create policy players_write  on players for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy teams_read      on team_identities for select to authenticated using (true);
create policy teams_write     on team_identities for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy courses_read    on courses for select to authenticated using (true);
create policy courses_write   on courses for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy course_holes_read  on course_holes for select to authenticated using (true);
create policy course_holes_write on course_holes for all to authenticated
  using (exists (select 1 from courses c where c.id = course_id and c.created_by = auth.uid()))
  with check (exists (select 1 from courses c where c.id = course_id and c.created_by = auth.uid()));

-- Events + children: signed-in users can read; only members can mutate.
create policy events_read   on events for select to authenticated using (true);
create policy events_insert on events for insert to authenticated with check (created_by = auth.uid());
create policy events_modify on events for update to authenticated using (is_event_member(id));
create policy events_delete on events for delete to authenticated using (created_by = auth.uid());

create policy event_teams_rw   on event_teams for all to authenticated using (is_event_member(event_id)) with check (is_event_member(event_id));
create policy event_players_rw on event_players for all to authenticated using (is_event_member(event_id)) with check (is_event_member(event_id));
create policy sessions_rw      on sessions for all to authenticated using (is_event_member(event_id)) with check (is_event_member(event_id));
create policy matches_rw       on matches for all to authenticated using (is_event_member(event_id)) with check (is_event_member(event_id));
create policy participants_rw  on match_participants for all to authenticated using (is_event_member(event_id)) with check (is_event_member(event_id));
create policy scores_rw        on scores for all to authenticated using (is_event_member(event_id)) with check (is_event_member(event_id));

-- NOTE: public read-only spectator access (via events.spectator_token) is added in a
-- later migration with a security-definer RPC, so followers can watch without a login.
