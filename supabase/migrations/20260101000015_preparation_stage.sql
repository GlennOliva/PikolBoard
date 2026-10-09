begin;

-- Add preparation stage to match_status enum
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'match_status'
      and e.enumlabel = 'preparing'
  ) then
    alter type public.match_status add value 'preparing' after 'staged';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'match_status'
      and e.enumlabel = 'up_next'
  ) then
    alter type public.match_status add value 'up_next' after 'preparing';
  end if;
end $$;

commit;
