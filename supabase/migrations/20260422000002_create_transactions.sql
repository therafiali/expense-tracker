-- Migration: Create transactions table

create table public.transactions (
  id         uuid primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     numeric(12, 2) not null,
  type       text not null check (type in ('income', 'expense')),
  category   text,
  note       text,
  date       timestamp with time zone not null,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now())
);

-- Index for fast per-user, per-month queries
create index transactions_user_date_idx on public.transactions (user_id, date desc);

-- Row Level Security
alter table public.transactions enable row level security;

create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);
