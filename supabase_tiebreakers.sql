-- Configurable tie-breakers (rules order + admin resolution of unresolved ties)
alter table public.tournaments
  add column if not exists tiebreaker_config jsonb;
