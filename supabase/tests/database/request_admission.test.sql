begin;
select no_plan();

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');
insert into public.games (id, engine_version, schema_version, rules, setup)
values ('11111111-1111-1111-1111-111111111111', '0.0.0', 1, '{}', '{}');
select private.take_over('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a');

set local role service_role;
select is(private.admit_request('00000000-0000-0000-0000-00000000000b', 'voice'), 'forbidden', 'a signed-in non-scorer cannot spend on voice');
select is((select count(*) from private.request_limits), 0::bigint, 'a forbidden voice request creates no rate-limit row');
select is(private.admit_request('00000000-0000-0000-0000-00000000000a', 'voice'), 'allowed', 'current scorer can use voice');
select is(private.admit_request('00000000-0000-0000-0000-00000000000a', 'voice'), 'allowed', 'another endpoint shares the same voice bucket');
select is((select requests from private.request_limits where scope = 'voice'), 2, 'voice calls increment one persistent counter');
select is((select count(*) from generate_series(1,28) where private.admit_request('00000000-0000-0000-0000-00000000000a', 'voice') = 'allowed'), 28::bigint, 'remaining voice quota is admitted');
select is(private.admit_request('00000000-0000-0000-0000-00000000000a', 'voice'), 'limited', '31st shared voice call is refused');
select is((select requests from private.request_limits where scope = 'voice'), 30, 'refused requests do not grow the counter');
select is(private.admit_request('00000000-0000-0000-0000-00000000000a', 'sync'), 'allowed', 'sync has a separate quota');
select is(private.admit_request('00000000-0000-0000-0000-00000000000b', 'sync'), 'allowed', 'another user has an independent sync quota');
select is(private.admit_request('00000000-0000-0000-0000-00000000000a', 'other'), 'forbidden', 'unknown scopes cannot create new buckets');
select is(private.admit_request(null, 'sync'), 'forbidden', 'missing identities are refused');

reset role;
update private.request_limits set window_started_at = statement_timestamp() - interval '2 minutes' where scope = 'voice';
set local role service_role;
select is(private.admit_request('00000000-0000-0000-0000-00000000000a', 'voice'), 'allowed', 'a later minute resets an existing bucket');
select is((select requests from private.request_limits where scope = 'voice'), 1, 'reset keeps just one counter row');
select private.take_over('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b');
select is(private.admit_request('00000000-0000-0000-0000-00000000000a', 'voice'), 'forbidden', 'an old scoring epoch cannot authorize voice after takeover');
select is(private.admit_request('00000000-0000-0000-0000-00000000000b', 'voice'), 'allowed', 'new scorer has an independent voice quota');
select is((select count(*) from private.request_limits), 4::bigint, 'storage stays one row per identity and known scope');

reset role;
set local role anon;
select throws_ok($$ select private.admit_request('00000000-0000-0000-0000-00000000000a', 'voice') $$, '42501', null, 'anon cannot call admission directly');
select throws_ok('select * from private.request_limits', '42501', null, 'anon cannot read counters');
reset role;
set local role authenticated;
select throws_ok($$ select private.admit_request('00000000-0000-0000-0000-00000000000a', 'voice') $$, '42501', null, 'authenticated cannot authorize itself');
select throws_ok('select * from private.request_limits', '42501', null, 'authenticated cannot read counters');
select throws_ok('update private.request_limits set requests = 1', '42501', null, 'authenticated cannot reset counters');
reset role;
select * from finish();
rollback;
