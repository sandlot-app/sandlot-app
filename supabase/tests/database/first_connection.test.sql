begin;
select plan(18);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

insert into public.games (id, visibility, engine_version, schema_version, rules, setup) values
  ('11111111-1111-1111-1111-111111111111', 'private', '0.0.0', 1, '{}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'public', '0.0.0', 1, '{}', '{}');

create temp table s on commit drop as
select private.take_over('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a') as id;

create temp table g1 on commit drop as select '[
  {"id":"e1","gameId":"11111111-1111-1111-1111-111111111111","seq":1,"group":"g1","lockEpoch":1,"source":"tap","at":"2026-10-23T18:00:00.000Z","command":{"kind":"pitch","result":"ball"}},
  {"id":"e2","gameId":"11111111-1111-1111-1111-111111111111","seq":2,"group":"g1","lockEpoch":1,"source":"tap","at":"2026-10-23T18:00:00.000Z","command":{"kind":"pitch","result":"ball"}}
]'::jsonb as events;

select is(
  private.commit_group('00000000-0000-0000-0000-00000000000a', (select id from s), '11111111-1111-1111-1111-111111111111', 0, (select events from g1), '{}', 'hash-g1'),
  '{"ok": true, "revision": 2}'::jsonb,
  'the first group commits and moves the revision to its last seq'
);

select is(
  private.commit_group('00000000-0000-0000-0000-00000000000a', (select id from s), '11111111-1111-1111-1111-111111111111', 0, (select events from g1), '{}', 'hash-g1'),
  '{"ok": true, "revision": 2}'::jsonb,
  'resending the same group returns the stored acknowledgment'
);

select is((select count(*) from public.events), 2::bigint, 'a resend adds no events');

select is(
  private.commit_group('00000000-0000-0000-0000-00000000000a', (select id from s), '11111111-1111-1111-1111-111111111111', 0, (select events from g1), '{}', 'hash-other'),
  '{"ok": false, "code": "id_conflict"}'::jsonb,
  'a reused group ID with different content is an id_conflict'
);

select is(
  private.commit_group('00000000-0000-0000-0000-00000000000b', (select id from s), '11111111-1111-1111-1111-111111111111', 0, (select events from g1), '{}', 'hash-g1'),
  '{"ok": false, "code": "id_conflict"}'::jsonb,
  'the same group from another user is an id_conflict'
);

select is(
  private.commit_group('00000000-0000-0000-0000-00000000000a', (select id from s), '11111111-1111-1111-1111-111111111111', 2,
    '[{"id":"e4","gameId":"11111111-1111-1111-1111-111111111111","seq":4,"group":"g2","lockEpoch":1,"source":"tap","at":"2026-10-23T18:01:00.000Z","command":{"kind":"pitch","result":"foul"}}]',
    '{}', 'hash-g2'),
  '{"ok": false, "code": "stale_revision"}'::jsonb,
  'a group that skips a seq is stale_revision'
);

select is(
  private.commit_group('00000000-0000-0000-0000-00000000000a', (select id from s), '11111111-1111-1111-1111-111111111111', 2,
    '[{"id":"e1","gameId":"11111111-1111-1111-1111-111111111111","seq":3,"group":"g2","lockEpoch":1,"source":"tap","at":"2026-10-23T18:01:00.000Z","command":{"kind":"pitch","result":"foul"}}]',
    '{}', 'hash-g2'),
  '{"ok": false, "code": "id_conflict"}'::jsonb,
  'an event ID reused in a new group is an id_conflict'
);

select is(
  private.commit_group('00000000-0000-0000-0000-00000000000b', (select id from s), '11111111-1111-1111-1111-111111111111', 2,
    '[{"id":"e3","gameId":"11111111-1111-1111-1111-111111111111","seq":3,"group":"g2","lockEpoch":1,"source":"tap","at":"2026-10-23T18:01:00.000Z","command":{"kind":"pitch","result":"foul"}}]',
    '{}', 'hash-g2'),
  '{"ok": false, "code": "stale_session"}'::jsonb,
  'a user who does not own the session cannot write'
);

select isnt(
  private.take_over('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b'),
  null,
  'a takeover starts a new session'
);

select is(
  private.commit_group('00000000-0000-0000-0000-00000000000a', (select id from s), '11111111-1111-1111-1111-111111111111', 2,
    '[{"id":"e3","gameId":"11111111-1111-1111-1111-111111111111","seq":3,"group":"g2","lockEpoch":1,"source":"tap","at":"2026-10-23T18:01:00.000Z","command":{"kind":"pitch","result":"foul"}}]',
    '{}', 'hash-g2'),
  '{"ok": false, "code": "stale_session"}'::jsonb,
  'the old scorer cannot write after a takeover'
);

select is(
  (private.get_base('11111111-1111-1111-1111-111111111111') -> 'events' -> 1 ->> 'id'),
  'e2',
  'get_base returns the accepted events in seq order'
);

select throws_ok(
  $$ update public.games set rules = '{"innings": 7}' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'rules cannot change after the game is created'
);

set local role anon;

select is((select count(*) from public.games), 1::bigint, 'anon sees only the public game');
select is((select count(*) from public.events), 0::bigint, 'anon sees no events from a private game');
select throws_ok(
  $$ select private.get_base('11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'anon cannot reach the private schema'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a"}';

select is((select count(*) from public.games), 2::bigint, 'the scorer sees their private game and the public game');
select is((select count(*) from public.events), 2::bigint, 'the scorer sees their game''s events');
select throws_ok(
  $$ insert into public.events (game_id, id, seq, group_id, lock_epoch, source, at, command)
     values ('11111111-1111-1111-1111-111111111111', 'x', 9, 'g1', 1, 'tap', 'now', '{}') $$,
  '42501', null,
  'a client cannot insert events directly'
);

reset role;
select * from finish();
rollback;
