-- Privy becomes the canonical authentication provider. Keep google_id during
-- rollout so existing Google-backed players can be safely bound on first
-- Privy sign-in without losing their balances, missions, trades or loadout.
alter table public.players
  add column if not exists privy_id text;

create unique index if not exists players_privy_id_unique
  on public.players(privy_id)
  where privy_id is not null;
