begin;
select no_plan();

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

insert into public.games (id, visibility, engine_version, schema_version, rules, setup) values
  ('11111111-1111-1111-1111-111111111111', 'private', '0.0.0', 1, '{"innings": 6}', '{"home": "h"}'),
  ('22222222-2222-2222-2222-222222222222', 'public', '0.0.0', 1, '{"innings": 7}', '{"home": "p"}');

create temp table sessions on commit drop as select
  private.take_over('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a') as private_id,
  private.take_over('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000b') as public_id;

do $commit$ begin perform private.commit_group(
  '00000000-0000-0000-0000-00000000000a', (select private_id from sessions),
  '11111111-1111-1111-1111-111111111111', 0,
  '[{"id":"p1","gameId":"11111111-1111-1111-1111-111111111111","seq":1,"group":"pg1","lockEpoch":1,"source":"tap","at":"2026-10-25T18:00:00.000Z","command":{"kind":"pitch","result":"ball"}},
    {"id":"p2","gameId":"11111111-1111-1111-1111-111111111111","seq":2,"group":"pg1","lockEpoch":1,"source":"voice","at":"2026-10-25T18:00:05.000Z","command":{"kind":"pitch","result":"strike"}}]',
  '{"count":{"balls":1,"strikes":1}}', 'hash-pg1'
);
end $commit$;

do $commit$ begin perform private.commit_group(
  '00000000-0000-0000-0000-00000000000b', (select public_id from sessions),
  '22222222-2222-2222-2222-222222222222', 0,
  '[{"id":"e1","gameId":"22222222-2222-2222-2222-222222222222","seq":1,"group":"g1","lockEpoch":1,"source":"tap","at":"2026-10-25T18:00:00.000Z","command":{"kind":"pitch","result":"ball"}},
    {"id":"e2","gameId":"22222222-2222-2222-2222-222222222222","seq":2,"group":"g1","lockEpoch":1,"source":"voice","at":"2026-10-25T18:00:05.000Z","command":{"kind":"pitch","result":"strike"}}]',
  '{"count":{"balls":1,"strikes":1}}', 'hash-g1'
);
end $commit$;
do $commit$ begin perform private.commit_group(
  '00000000-0000-0000-0000-00000000000b', (select public_id from sessions),
  '22222222-2222-2222-2222-222222222222', 2,
  '[{"id":"e3","gameId":"22222222-2222-2222-2222-222222222222","seq":3,"group":"g2","lockEpoch":1,"source":"tap","at":"2026-10-25T18:00:10.000Z","command":{"kind":"pitch","result":"foul"}}]',
  '{"count":{"balls":1,"strikes":2}}', 'hash-g2'
);
end $commit$;

create temp table expected on commit drop as select
  private.get_base('22222222-2222-2222-2222-222222222222') as public_base,
  private.get_base('11111111-1111-1111-1111-111111111111') as private_base;
grant select on expected to anon, authenticated;

select is(
  (select provolatile from pg_proc where oid = 'public.get_snapshot(uuid, integer)'::regprocedure),
  's',
  'get_snapshot is stable'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.get_snapshot(uuid, integer)'::regprocedure),
  false,
  'get_snapshot is security invoker, so row-level security decides access'
);

set local role anon;

select is(
  public.get_snapshot('22222222-2222-2222-2222-222222222222') -> 'events',
  (select public_base -> 'events' from expected),
  'anon gets every event of a public game at after_seq 0, in get_base''s shape and seq order'
);
select is(
  public.get_snapshot('22222222-2222-2222-2222-222222222222', 2) -> 'events' -> 0 ->> 'id',
  'e3',
  'after_seq 2 returns the event after seq 2'
);
select is(
  jsonb_array_length(public.get_snapshot('22222222-2222-2222-2222-222222222222', 2) -> 'events'),
  1,
  'after_seq 2 returns only the later events'
);
select is(
  public.get_snapshot('22222222-2222-2222-2222-222222222222', 3) -> 'events',
  '[]'::jsonb,
  'an after_seq at the revision returns an empty events array'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.get_snapshot('22222222-2222-2222-2222-222222222222')) k),
  array['engineVersion', 'events', 'gameId', 'revision', 'rules', 'schemaVersion', 'setup', 'state'],
  'the snapshot has the documented keys'
);
select is(
  public.get_snapshot('22222222-2222-2222-2222-222222222222') - 'events',
  (select public_base - 'events' || '{"gameId": "22222222-2222-2222-2222-222222222222"}' from expected),
  'the snapshot carries the game''s pins, rules, setup, revision and state'
);
select is(
  (public.get_snapshot('22222222-2222-2222-2222-222222222222') ->> 'revision')::integer,
  (select revision from public.games where id = '22222222-2222-2222-2222-222222222222'),
  'the snapshot revision matches the games row'
);
select is(
  public.get_snapshot('22222222-2222-2222-2222-222222222222') -> 'state',
  (select state from public.games where id = '22222222-2222-2222-2222-222222222222'),
  'the snapshot state matches the games row'
);
select is(
  public.get_snapshot('11111111-1111-1111-1111-111111111111'),
  null::jsonb,
  'anon gets null for a private game'
);
select is(
  public.get_snapshot('33333333-3333-3333-3333-333333333333'),
  null::jsonb,
  'a game that does not exist gets null'
);
select throws_ok(
  $$ select private.get_base('22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'anon still cannot call private.get_base'
);
select throws_ok(
  $$ select private.commit_group('00000000-0000-0000-0000-00000000000b', gen_random_uuid(),
       '22222222-2222-2222-2222-222222222222', 3, '[]', '{}', 'x') $$,
  '42501', null,
  'anon still cannot call private.commit_group'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b"}';

select is(
  public.get_snapshot('11111111-1111-1111-1111-111111111111'),
  null::jsonb,
  'an authenticated user who is not the scorer gets null for a private game'
);
select is(
  public.get_snapshot('22222222-2222-2222-2222-222222222222', 1) -> 'events' -> 0 ->> 'id',
  'e2',
  'an authenticated user gets a public game''s later events'
);
select throws_ok(
  $$ select private.get_base('22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'authenticated still cannot call private.get_base'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a"}';

select is(
  public.get_snapshot('11111111-1111-1111-1111-111111111111') -> 'events',
  (select private_base -> 'events' from expected),
  'the scorer gets their private game with all its events'
);
select is(
  (public.get_snapshot('11111111-1111-1111-1111-111111111111', 1) -> 'events' -> 0 ->> 'id'),
  'p2',
  'the scorer gets only the events after after_seq'
);
select is(
  (public.get_snapshot('11111111-1111-1111-1111-111111111111') ->> 'revision')::integer,
  2,
  'the scorer''s snapshot is at the private game''s revision'
);

reset role;

select is(
  (select revision from public.games where id = '22222222-2222-2222-2222-222222222222'),
  3,
  'reading snapshots left the game''s revision unchanged'
);
select is((select count(*) from public.events), 5::bigint, 'reading snapshots added no events');

select * from finish();
rollback;
