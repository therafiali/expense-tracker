-- Migration: Create standalone reminders table
-- Reminders are not goals: they have once / monthly / interval schedules, not habit counts.

create table public.reminders (
  id                 text primary key,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  title              text not null,
  note               text,
  kind               text not null check (kind in ('once', 'monthly', 'interval')),
  reminder_time      text not null default '09:00',
  fire_at            timestamp with time zone,
  month_day          integer,
  interval_days      integer,
  interval_start_at  timestamp with time zone,
  last_completed_at  timestamp with time zone,
  enabled            boolean not null default true,
  is_active          boolean not null default true,
  created_at         timestamp with time zone not null default timezone('utc', now()),
  updated_at         timestamp with time zone not null default timezone('utc', now())
);

create index reminders_user_updated_idx on public.reminders (user_id, updated_at desc);

alter table public.reminders enable row level security;

create policy "Users can view own reminders"
  on public.reminders for select
  using (auth.uid() = user_id);

create policy "Users can insert own reminders"
  on public.reminders for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reminders"
  on public.reminders for update
  using (auth.uid() = user_id);

create policy "Users can delete own reminders"
  on public.reminders for delete
  using (auth.uid() = user_id);

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute procedure public.set_updated_at();
