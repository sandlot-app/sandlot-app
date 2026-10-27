begin;
select no_plan();

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a');

insert into public.games (id, visibility, engine_version, schema_version, rules, setup) values
  ('11111111-1111-1111-1111-111111111111', 'public', '0.0.0', 1, '{}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'public', '0.0.0', 1, '{}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'private', '0.0.0', 1, '{}', '{}');

insert into public.recordings (game_id, playback_id, clock_offset_ms) values
  ('11111111-1111-1111-1111-111111111111', 'hiddenPlayback', 0),
  ('22222222-2222-2222-2222-222222222222', 'publicPlayback', 1500);

-- A game made private after its recording was added: row-level security must still hide it.
update public.games set visibility = 'private' where id = '11111111-1111-1111-1111-111111111111';

select throws_ok(
  $$ insert into public.recordings (game_id, playback_id) values ('33333333-3333-3333-3333-333333333333', 'kids') $$,
  '23514', null, 'a private game cannot get a recording while playback IDs are public'
);
select throws_ok(
  $$ update public.recordings set clock_offset_ms = 10 where game_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'a recording cannot be changed once its game is private'
);
select throws_ok(
  $$ insert into public.recordings (game_id, playback_id) values ('22222222-2222-2222-2222-222222222222', 'other') $$,
  '23505', null, 'a game has at most one recording'
);
select throws_ok(
  $$ update public.recordings set playback_id = 'abc/../x' where game_id = '22222222-2222-2222-2222-222222222222' $$,
  '23514', null, 'a playback ID is letters and digits only, so it is safe to put in a URL'
);
select lives_ok(
  $$ update public.recordings set playback_id = 'newAsset', clock_offset_ms = 1800 where game_id = '22222222-2222-2222-2222-222222222222' $$,
  'a public game''s recording takes a new asset and offset'
);

set local role anon;

select is(
  (select array_agg(playback_id) from public.recordings),
  array['newAsset'],
  'anon reads the recording of a public game and not of a private one'
);
select throws_ok(
  $$ update public.recordings set clock_offset_ms = 0 $$,
  '42501', null, 'anon cannot change a recording'
);
select throws_ok(
  $$ insert into public.recordings (game_id, playback_id) values ('22222222-2222-2222-2222-222222222222', 'x') $$,
  '42501', null, 'anon cannot add a recording'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(
  (select array_agg(playback_id) from public.recordings),
  array['newAsset'],
  'a signed-in user who is not the scorer reads only the public game''s recording'
);
select throws_ok(
  $$ delete from public.recordings $$,
  '42501', null, 'a signed-in user cannot delete a recording'
);

reset role;
delete from public.games where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select count(*) from public.recordings where game_id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'deleting a game deletes its recording'
);

select * from finish();
rollback;
