-- Existing installs created before Stage 11.2 need the per-player best
-- aim accuracy required by the precise_session mission.
alter table players
  add column if not exists precise_best numeric(8, 6) not null default 0;