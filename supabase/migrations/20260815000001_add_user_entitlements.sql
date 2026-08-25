-- Subby Pro entitlements — verified server-side via verify-purchase + iap-webhook.
-- Client never writes this table directly (RLS denies insert/update/delete for authenticated).
-- Only service_role (Edge Functions) upserts verified rows.

create table public.user_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_pro boolean not null default false,
  product_id text,
  expires_at bigint, -- epoch ms, null = lifetime / no expiry
  entitlement_source text check (entitlement_source in ('app_store', 'play_store', 'lifetime', 'mock')),
  updated_at bigint not null default 0
);

alter table public.user_entitlements enable row level security;

-- Authenticated users can read only their own row.
create policy "user_entitlements_select_own" on public.user_entitlements
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- No insert/update/delete policies for authenticated — only service_role may write.
-- (Supabase Edge Functions using SERVICE_ROLE_KEY bypass RLS.)

grant select on public.user_entitlements to authenticated;
