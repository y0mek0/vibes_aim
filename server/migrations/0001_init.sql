-- aim2stock Supabase schema. Run once in SQL Editor.
-- Mirrors the in-memory store in server/src/db/store.js.
-- service_role bypasses RLS, so we keep the policy surface explicit and
-- deny anon/authenticated access to everything (the server does all writes).

create extension if not exists "pgcrypto";

-- Players: balance + accuracy record. google_id nullable for guest.
create table if not exists public.players (
  id           text primary key,
  google_id    text unique,
  email        text,
  stable       numeric(14, 6) not null default 200,
  precise_best numeric(8,  6) not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists players_google_id_idx on public.players(google_id);

-- Ticker balances (AAPL, NVDA, etc.)
create table if not exists public.balances (
  player_id  text        not null references public.players(id) on delete cascade,
  ticker     text        not null,
  qty        numeric(20, 8) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (player_id, ticker)
);

-- Leveraged trades (open/closed/liquidated).
create table if not exists public.trades (
  id                uuid        primary key default gen_random_uuid(),
  player_id         text        not null references public.players(id) on delete cascade,
  ticker            text        not null,
  side              text        not null check (side in ('long', 'short')),
  qty               numeric(20, 8) not null,
  entry_price       numeric(14, 6) not null,
  exit_price        numeric(14, 6),
  leverage          numeric(6,  3) not null,
  liquidation_price numeric(14, 6) not null,
  status            text        not null default 'open' check (status in ('open', 'closed', 'liquidated')),
  pnl               numeric(14, 6) not null default 0,
  created_at        timestamptz not null default now(),
  closed_at         timestamptz
);
create index if not exists trades_player_idx on public.trades(player_id, created_at desc);

-- Aim/hit log. (session_id, hit_id) is the idempotency key.
create table if not exists public.hit_log (
  id          uuid        primary key default gen_random_uuid(),
  player_id   text        not null references public.players(id) on delete cascade,
  session_id  text        not null,
  hit_id      text        not null,
  ticker      text        not null,
  unit        numeric(20, 8) not null,
  ts          bigint      not null,
  unique (session_id, hit_id)
);
create index if not exists hit_log_player_ts_idx on public.hit_log(player_id, ts);

-- Missions (one row per (player, kind)). AAPL -> NVDA chain.
create table if not exists public.missions (
  player_id   text        not null references public.players(id) on delete cascade,
  kind        text        not null,
  progress    numeric(20, 6) not null default 0,
  done        boolean     not null default false,
  claimed_at  timestamptz,
  primary key (player_id, kind)
);

-- Ticker unlocks (NVDA after missions). Empty by default.
create table if not exists public.unlocks (
  player_id   text        not null references public.players(id) on delete cascade,
  ticker      text        not null,
  unlocked_at timestamptz not null default now(),
  primary key (player_id, ticker)
);

-- Gun loadout: one row per (player, gun) the player has bought.
create table if not exists public.loadout (
  player_id    text        not null references public.players(id) on delete cascade,
  gun_id       text        not null,
  purchased_at timestamptz not null default now(),
  primary key (player_id, gun_id)
);

-- Auth: server-side sessions issued after Google sign-in.
-- Plain-text random token; row lookup is O(1) by token hash. The token
-- itself is sent to the client once and stored in localStorage.
create table if not exists public.sessions (
  token_hash  text        primary key,
  player_id   text        not null references public.players(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists sessions_player_idx on public.sessions(player_id);
create index if not exists sessions_expires_idx on public.sessions(expires_at);

-- Lock the data down: service_role bypasses RLS, so we deny everything
-- else. The server is the only writer; the client never talks to Supabase.
alter table public.players   enable row level security;
alter table public.balances  enable row level security;
alter table public.trades    enable row level security;
alter table public.hit_log   enable row level security;
alter table public.missions  enable row level security;
alter table public.unlocks   enable row level security;
alter table public.loadout   enable row level security;
alter table public.sessions  enable row level security;
