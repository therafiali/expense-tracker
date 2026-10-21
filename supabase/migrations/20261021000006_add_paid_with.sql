-- How an expense was paid. Missing values count as cash, same as the phone app.

alter table public.transactions
  add column if not exists paid_with text;

alter table public.transactions
  drop constraint if exists transactions_paid_with_check;

alter table public.transactions
  add constraint transactions_paid_with_check
  check (paid_with is null or paid_with in ('cash', 'online'));
