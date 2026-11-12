-- Tournament format: 'playoff' (top 2 play a final) or 'league' (table topper is champion)
alter table public.tournaments
  add column if not exists format text not null default 'playoff';

alter table public.tournaments
  drop constraint if exists tournaments_format_check;
alter table public.tournaments
  add constraint tournaments_format_check check (format in ('playoff', 'league'));
