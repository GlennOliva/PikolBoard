begin;

alter table public.matches
  add column if not exists display_name text;

comment on column public.matches.display_name is
  'Optional custom match name shown to organizers and players; truncated to 80 chars and blanked to default.';

-- Backfill existing matches with a safe default
with numbered as (
  select id,
         'Match ' || match_number as default_name
  from public.matches
)
update public.matches m
set display_name = numbered.default_name
from numbered
where m.id = numbered.id
  and (m.display_name is null or btrim(m.display_name) = '');

-- Constrain length and normalize empty strings to null so defaults can be used
alter table public.matches
  add constraint matches_display_name_length_check
    check (display_name is null or length(btrim(display_name)) <= 80);

-- Ensure stored values are trimmed; leave nulls alone
update public.matches
set display_name = btrim(display_name)
where display_name is not null and display_name <> btrim(display_name);

commit;
