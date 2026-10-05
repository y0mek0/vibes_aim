-- vibes_aim — Supabase schema (Postgres). Initial migration.
-- Run via Supabase SQL editor or `supabase db push`.

create table if not exists players (
  id text primary key,
  stable numeric(18, 6) not null default 200,
  precise_best numeric(8, 6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists balances (
  player_id text not null references players(id) on delete cascade,
  ticker text not null,
  qty numeric(18, 8) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (player_id, ticker)
);

create table if not exists trades (
  id uuid primary key,
  player_id text not null references players(id) on delete cascade,
  ticker text not null,
  side text not null check (side in ('long', 'short')),
  qty numeric(18, 8) not null,
  entry_price numeric(18, 6) not null,
  exit_price numeric(18, 6),
  leverage int not null check (leverage between 1 and 20),
  liquidation_price numeric(18, 6) not null,
  status text not null default 'open' check (status in ('open', 'closed', 'liquidated')),
  pnl numeric(18, 6) not null default 0,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists hit_log (
  session_id text not null,
  hit_id text not null,
  id uuid primary key default gen_random_uuid(),
  player_id text not null references players(id) on delete cascade,
  ticker text not null,
  unit numeric(18, 8) not null,
  ts bigint not null,
  unique (session_id, hit_id)
);
create index if not exists hit_log_player_ts on hit_log (player_id, ts desc);

create table if not exists missions (
  player_id text not null references players(id) on delete cascade,
  kind text not null,
  progress numeric(18, 6) not null default 0,
  done boolean not null default false,
  claimed_at timestamptz,
  primary key (player_id, kind)
);

create table if not exists unlocks (
  player_id text not null references players(id) on delete cascade,
  ticker text not null,
  unlocked_at timestamptz not null default now(),
  primary key (player_id, ticker)
);
