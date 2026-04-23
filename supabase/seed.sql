-- Seed file: inserts sample data for local development only.
-- This is NOT run in production.

-- Insert a test user profile (requires auth.users row to exist first).
-- Run this only after signing up via the app locally.

-- Example: uncomment and replace with the UUID of your local test user.
-- insert into public.profiles (id, full_name, currency)
-- values ('00000000-0000-0000-0000-000000000001', 'Test User', 'USD');

-- insert into public.transactions (id, user_id, amount, type, category, note, date)
-- values 
--   (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 1500.00, 'income',  null,       'Monthly salary',  now() - interval '5 days'),
--   (gen_random_uuid(), '00000000-0000-0000-0000-000000000001',   45.50, 'expense', 'Food',     'Groceries',       now() - interval '4 days'),
--   (gen_random_uuid(), '00000000-0000-0000-0000-000000000001',   20.00, 'expense', 'Petrol',   'Fuel top-up',     now() - interval '3 days'),
--   (gen_random_uuid(), '00000000-0000-0000-0000-000000000001',  200.00, 'expense', 'Shopping', 'New headphones',  now() - interval '2 days');
