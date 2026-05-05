-- Migration: Create goals and goal progress tables

create table public.goals (
  id                   text primary key,
  user_id              uuid not null references public.profiles(id) on delete cascade,
  title                text not null,
  emoji                text,
  target_count         integer not null default 1,
  completed_count      integer not null default 0,
  period               text not null check (period in ('daily', 'weekly', 'monthly')),
  reminder_enabled     boolean not null default true,
  reminders_per_period integer not null default 1,
  reminder_time        text not null default '09:00',
  reminder_slots       jsonb not null default '[]'::jsonb,
  period_anchor        timestamp with time zone not null default timezone('utc', now()),
  is_active            boolean not null default true,
  created_at           timestamp with time zone not null default timezone('utc', now()),
  updated_at           timestamp with time zone not null default timezone('utc', now())
);

create index goals_user_updated_idx on public.goals (user_id, updated_at desc);

alter table public.goals enable row level security;

create policy "Users can view own goals"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on public.goals for update
  using (auth.uid() = user_id);

create policy "Users can delete own goals"
  on public.goals for delete
  using (auth.uid() = user_id);

create table public.goal_progress (
  id         text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  goal_id    text not null references public.goals(id) on delete cascade,
  date_key   text not null,
  count      integer not null default 0,
  updated_at timestamp with time zone not null default timezone('utc', now())
);

create unique index goal_progress_goal_date_uniq on public.goal_progress (user_id, goal_id, date_key);
create index goal_progress_user_updated_idx on public.goal_progress (user_id, updated_at desc);

alter table public.goal_progress enable row level security;

create policy "Users can view own goal progress"
  on public.goal_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own goal progress"
  on public.goal_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goal progress"
  on public.goal_progress for update
  using (auth.uid() = user_id);

create policy "Users can delete own goal progress"
  on public.goal_progress for delete
  using (auth.uid() = user_id);

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute procedure public.set_updated_at();

