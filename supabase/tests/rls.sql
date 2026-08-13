-- RLS isolation tests for subscriptions + user_prefs.
-- Run with: supabase db test --local  (pgTAP; wrapped in a rolled-back txn)
--
-- Two users are created directly in auth.users, each with one row, then the
-- test switches to the `authenticated` role with a JWT sub claim and asserts
-- full cross-user isolation.

begin;

select plan(13);

-- Fixture: two users
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'rls-a@test.dev', 'x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'rls-b@test.dev', 'x', now(), now(), now());

-- Fixture: one subscription + one prefs row per user (inserted as owner)
insert into public.subscriptions (id, user_id, name, amount, currency, cycle,
                                  next_renewal, category, icon,
                                  created_at, updated_at, archived, seeded)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '00000000-0000-4000-8000-000000000001',
   'User A sub', 10, 'USD', 'monthly', '2026-09-01', 'other', 'cube-outline', 1, 1, false, false),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '00000000-0000-4000-8000-000000000002',
   'User B sub', 20, 'USD', 'monthly', '2026-09-01', 'other', 'cube-outline', 1, 1, false, false);

insert into public.user_prefs (user_id, currency, budget, reminders_enabled, updated_at)
values
  ('00000000-0000-4000-8000-000000000001', 'USD', 100, true, 1),
  ('00000000-0000-4000-8000-000000000002', 'EUR', 200, false, 1);

-- Act as user A
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::int from public.subscriptions),
  1,
  'user A sees exactly their own subscription'
);

select is(
  (select name from public.subscriptions limit 1),
  'User A sub',
  'user A reads only their own row'
);

select is(
  (select count(*)::int from public.user_prefs),
  1,
  'user A sees exactly their own prefs row'
);

select is(
  (select currency from public.user_prefs),
  'USD',
  'user A reads their own prefs'
);

-- Cross-user UPDATE is silently ignored (no USING match)
update public.subscriptions set name = 'hacked' where user_id = '00000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::int from public.subscriptions where name = 'hacked'),
  0,
  'user A cannot update user B rows'
);

-- Cross-user UPDATE with id match is also ignored
update public.subscriptions set name = 'hacked' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
select is(
  (select count(*)::int from public.subscriptions where name = 'hacked'),
  0,
  'user A cannot update user B rows by id'
);

-- Cross-user DELETE is ignored (verify as owner, since B row is invisible to A)
delete from public.subscriptions where user_id = '00000000-0000-4000-8000-000000000002';
set local role postgres;
select is(
  (select count(*)::int from public.subscriptions where user_id = '00000000-0000-4000-8000-000000000002'),
  1,
  'user A cannot delete user B rows'
);
set local role authenticated;

-- INSERT with a foreign user_id is rejected by WITH CHECK
select throws_ok(
  $$ insert into public.subscriptions (id, user_id, name, amount, currency, cycle,
        next_renewal, category, icon, created_at, updated_at, archived, seeded)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '00000000-0000-4000-8000-000000000002',
             'Stolen', 1, 'USD', 'monthly', '2026-09-01', 'other', 'cube-outline',
             1, 1, false, false) $$,
  '42501',
  NULL,
  'user A cannot insert rows owned by user B'
);

-- INSERT without user_id defaults to auth.uid()
insert into public.subscriptions (id, name, amount, currency, cycle,
                                  next_renewal, category, icon,
                                  created_at, updated_at, archived, seeded)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Own insert', 1, 'USD', 'monthly',
   '2026-09-01', 'other', 'cube-outline', 1, 1, false, false);
select is(
  (select user_id from public.subscriptions where name = 'Own insert'),
  '00000000-0000-4000-8000-000000000001',
  'insert defaults user_id to auth.uid()'
);

-- UPDATE of own row works and keeps ownership
update public.subscriptions set name = 'Own edited' where name = 'Own insert';
select is(
  (select count(*)::int from public.subscriptions
    where name = 'Own edited' and user_id = '00000000-0000-4000-8000-000000000001'),
  1,
  'user A can update their own rows'
);

-- Prefs: cross-user UPDATE ignored
update public.user_prefs set currency = 'XXX' where user_id = '00000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::int from public.user_prefs where currency = 'XXX'),
  0,
  'user A cannot update user B prefs'
);

-- user B cannot touch user A rows
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::int from public.subscriptions),
  1,
  'user B sees exactly their own subscription'
);

select is(
  (select name from public.subscriptions),
  'User B sub',
  'user B reads only their own row'
);

select * from finish();
rollback;
