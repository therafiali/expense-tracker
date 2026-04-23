-- Migration: updated_at auto-update trigger
-- Reusable trigger function that keeps updated_at current on any table.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Apply to profiles
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Apply to transactions
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute procedure public.set_updated_at();
