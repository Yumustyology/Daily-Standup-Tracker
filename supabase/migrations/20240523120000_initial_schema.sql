DROP POLICY IF EXISTS "Users can insert standups" ON public.standups;
DROP POLICY IF EXISTS "Users can view their org standups" ON public.standups;

DROP TRIGGER IF EXISTS standup_stats_trigger ON public.standups;

DROP FUNCTION IF EXISTS public.update_user_standup_stats();

DROP VIEW IF EXISTS public.team_daily_stats;

DROP TABLE IF EXISTS public.user_standup_stats;
DROP TABLE IF EXISTS public.standups;
DROP TABLE IF EXISTS public.org_members;
DROP TABLE IF EXISTS public.organisations;

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role text default 'member',
  status text default 'active',
  joined_at timestamptz default now()
);

create index idx_org_members_user on org_members(user_id);
create index idx_org_members_org on org_members(org_id);

create table public.standups (
  id uuid primary key default gen_random_uuid(),

  org_id uuid references organisations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,

  standup_date date not null,

  yesterday text,
  today text,
  blockers text,

  created_at timestamptz default now(),

  unique (user_id, standup_date)
);

create index idx_standups_org on standups(org_id);
create index idx_standups_user on standups(user_id);
create index idx_standups_date on standups(standup_date);

create table public.user_standup_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organisations(id) on delete cascade,

  total_standups int default 0,
  current_streak int default 0,
  longest_streak int default 0,

  last_standup_date date
);

create or replace function public.update_user_standup_stats()
returns trigger
language plpgsql
as $$
declare
  prev_date date;
begin

  select last_standup_date
  into prev_date
  from public.user_standup_stats
  where user_id = new.user_id;

  if prev_date is null then
    insert into public.user_standup_stats (
      user_id,
      org_id,
      total_standups,
      current_streak,
      longest_streak,
      last_standup_date
    )
    values (
      new.user_id,
      new.org_id,
      1,
      1,
      1,
      new.standup_date
    )
    on conflict (user_id) do nothing;

  else
    update public.user_standup_stats
    set
      total_standups = total_standups + 1,
      current_streak =
        case
          when prev_date = new.standup_date - interval '1 day'
          then current_streak + 1
          else 1
        end,
      longest_streak =
        greatest(longest_streak, current_streak + 1),
      last_standup_date = new.standup_date
    where user_id = new.user_id;
  end if;

  return new;
end;
$$;

create trigger standup_stats_trigger
after insert on public.standups
for each row
execute function public.update_user_standup_stats();

create view public.team_daily_stats as
select
  org_id,
  standup_date,
  count(*) as submissions
from public.standups
group by org_id, standup_date;


create policy "Users can view their org standups"
on public.standups
for select
using (
  org_id in (
    select org_id
    from public.org_members
    where user_id = auth.uid()
  )
);

create policy "Users can insert standups"
on public.standups
for insert
with check (user_id = auth.uid());
