begin;
select no_plan();

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a');

insert into public.games (id, visibility, engine_version, schema_version, rules, setup) values
  ('11111111-1111-1111-1111-111111111111', 'private', '0.0.0', 1, '{}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'public', '0.0.0', 1, '{}', '{}');

insert into public.recordings (game_id, playback_id, clock_offset_ms) values
  ('11111111-1111-1111-1111-111111111111', 'privatePlayback', 0),
  ('22222222-2222-2222-2222-222222222222', 'publicPlayback', 1500);

select throws_ok(
  $$ insert into public.recordings (game_id, playback_id) values ('11111111-1111-1111-1111-111111111111', 'other') $$,
  '23505', null, 'a game has at most one recording'
);
select throws_ok(
  $$ update public.recordings set playback_id = 'abc/../x' where game_id = '22222222-2222-2222-2222-222222222222' $$,
  '23514', null, 'a playback ID is letters and digits only, so it is safe to put in a URL'
);

set local role anon;

select is(
  (select array_agg(playback_id) from public.recordings),
  array['publicPlayback'],
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
  array['publicPlayback'],
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
