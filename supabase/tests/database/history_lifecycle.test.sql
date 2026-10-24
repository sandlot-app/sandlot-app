begin;
select plan(12);

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.games (id, engine_version, schema_version, rules, setup)
values ('11111111-1111-1111-1111-111111111111', '0.0.0', 1, '{}', '{}');

create temp table session_fixture as
select private.take_over('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a') as id;

select is(
  private.commit_group(
    '00000000-0000-0000-0000-00000000000a', (select id from session_fixture),
    '11111111-1111-1111-1111-111111111111', 0,
    '[{"id":"e1","gameId":"11111111-1111-1111-1111-111111111111","seq":1,"group":"g1","lockEpoch":1,"source":"tap","at":"2026-10-23T18:00:00.000Z","command":{"kind":"pitch","result":"ball"}}]',
    '{"count":{"balls":1,"strikes":0}}', 'hash-g1'
  ),
  '{"ok":true,"revision":1}'::jsonb,
  'the lifecycle fixture has accepted history and cached state'
);

create function pg_temp.history() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'user', (select to_jsonb(u) from auth.users u where id = '00000000-0000-0000-0000-00000000000a'),
    'game', (select to_jsonb(g) from public.games g where id = '11111111-1111-1111-1111-111111111111'),
    'sessions', (select jsonb_agg(to_jsonb(s) order by epoch) from public.scoring_sessions s where game_id = '11111111-1111-1111-1111-111111111111'),
    'groups', (select jsonb_agg(to_jsonb(g) order by group_id) from public.groups g where game_id = '11111111-1111-1111-1111-111111111111'),
    'events', (select jsonb_agg(to_jsonb(e) order by seq) from public.events e where game_id = '11111111-1111-1111-1111-111111111111')
  )
$$;
create temp table saved_history as select pg_temp.history() as value;

select throws_ok(
  $$ delete from public.scoring_sessions where id = (select id from session_fixture) $$,
  '23503', null, 'an accepted scoring session cannot be deleted'
);
select is(pg_temp.history(), (select value from saved_history),
  'refused session deletion preserves exact user, session, group, events, revision and cache');

select throws_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23503', null, 'a scorer with retained history cannot be deleted'
);
select is(pg_temp.history(), (select value from saved_history),
  'refused user deletion preserves exact user, session, group, events, revision and cache');

select lives_ok(
  $$ delete from public.games where id = '11111111-1111-1111-1111-111111111111' $$,
  'explicit whole-game cleanup succeeds'
);
select is((select count(*) from public.games where id = '11111111-1111-1111-1111-111111111111'),
  0::bigint, 'game cleanup removes the game');
select is((select count(*) from public.scoring_sessions where game_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint, 'game cleanup removes sessions');
select is((select count(*) from public.groups where game_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint, 'game cleanup removes groups');
select is((select count(*) from public.events where game_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint, 'game cleanup removes events');
select lives_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-00000000000a' $$,
  'a user can be deleted after their game history is deliberately removed'
);
select is((select count(*) from auth.users where id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint, 'cleanup removes the unreferenced user');

select * from finish();
rollback;
