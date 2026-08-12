-- Subby: subscriptions + user_prefs, migrated from expo-sqlite.
--
-- Multi-tenancy: every row carries user_id (default auth.uid()) and RLS
-- scopes all operations to the signed-in user. Money is numeric, timestamps
-- stay epoch-ms bigint (the app's domain type), dates are `date`.
-- `seeded` marks demo rows (owned by the test account), `notification_id`
-- stays device-local in the app (not stored here).

create table public.subscriptions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null,
  currency text not null,
  cycle text not null,
  next_renewal date not null,
  category text not null,
  icon text not null,
  color text,
  notes text,
  trial_ends date,
  created_at bigint not null,
  updated_at bigint not null,
  archived boolean not null default false,
  seeded boolean not null default false
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);

create table public.user_prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  currency text not null default 'USD',
  budget numeric(12, 2) not null default 0,
  reminders_enabled boolean not null default true,
  updated_at bigint not null default 0
);

alter table public.subscriptions enable row level security;
alter table public.user_prefs enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "subscriptions_insert_own" on public.subscriptions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "subscriptions_update_own" on public.subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "subscriptions_delete_own" on public.subscriptions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_prefs_select_own" on public.user_prefs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_prefs_insert_own" on public.user_prefs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_prefs_update_own" on public.user_prefs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- New tables are not auto-exposed to the Data API; grant explicitly.
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert, update, delete on public.user_prefs to authenticated;
