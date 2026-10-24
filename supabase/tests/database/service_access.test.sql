begin;
select no_plan();

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');
insert into public.games (id, engine_version, schema_version, rules, setup)
values ('11111111-1111-1111-1111-111111111111', '0.0.0', 1, '{}', '{}');

set local role service_role;
select lives_ok(
  $$ select private.take_over('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a') $$,
  'service_role can take over a game through the private API'
);
select is((select count(*) from public.scoring_sessions where game_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint, 'service_role created and can read the scoring session');

select lives_ok($test$
  do $$
  declare result jsonb;
  begin
    result := private.commit_group(
      '00000000-0000-0000-0000-00000000000a',
      (select id from public.scoring_sessions where game_id = '11111111-1111-1111-1111-111111111111'),
      '11111111-1111-1111-1111-111111111111', 0,
      '[{"id":"e1","gameId":"11111111-1111-1111-1111-111111111111","seq":1,"group":"g1","lockEpoch":1,"source":"tap","at":"2026-10-23T18:00:00.000Z","command":{"kind":"pitch","result":"ball"}}]',
      '{"count":{"balls":1}}', 'hash-g1'
    );
    if result is distinct from '{"ok":true,"revision":1}'::jsonb then
      raise exception 'unexpected acknowledgment: %', result;
    end if;
  end $$;
$test$, 'service_role commits a group and receives its acknowledgment');

select is((select content_hash from public.groups where game_id = '11111111-1111-1111-1111-111111111111' and group_id = 'g1'),
  'hash-g1', 'service_role can look up the accepted group');
select lives_ok($test$
  do $$
  declare base jsonb;
  begin
    base := private.get_base('11111111-1111-1111-1111-111111111111');
    if base -> 'revision' is distinct from '1'::jsonb
      or base -> 'state' is distinct from '{"count":{"balls":1}}'::jsonb
      or base -> 'events' -> 0 ->> 'id' is distinct from 'e1' then
      raise exception 'get_base did not return the committed revision, cache and event';
    end if;
  end $$;
$test$, 'service_role reads the committed base through the private API');

select lives_ok($test$
  do $$
  declare result jsonb;
  begin
    result := private.commit_group(
      '00000000-0000-0000-0000-00000000000a',
      (select id from public.scoring_sessions where game_id = '11111111-1111-1111-1111-111111111111'),
      '11111111-1111-1111-1111-111111111111', 0,
      '[{"id":"e1","gameId":"11111111-1111-1111-1111-111111111111","seq":1,"group":"g1","lockEpoch":1,"source":"tap","at":"2026-10-23T18:00:00.000Z","command":{"kind":"pitch","result":"ball"}}]',
      '{"count":{"balls":1}}', 'hash-g1'
    );
    if result is distinct from '{"ok":true,"revision":1}'::jsonb then
      raise exception 'unexpected retry acknowledgment: %', result;
    end if;
  end $$;
$test$, 'service_role retries a committed group and receives its saved acknowledgment');
select is((select count(*) from public.events where game_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint, 'service_role retry stores one event');

reset role;
select ok(not exists (
  select 1 from pg_proc p
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  where p.pronamespace = 'private'::regnamespace
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'
), 'PUBLIC has no default or explicit execute permission on private functions');

set local role anon;
select throws_ok(statement, '42501', null, 'anon cannot call ' || name)
from (values
  ('get_base', $$ select private.get_base('11111111-1111-1111-1111-111111111111') $$),
  ('take_over', $$ select private.take_over('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a') $$),
  ('commit_group', $$ select private.commit_group('00000000-0000-0000-0000-00000000000a', null, '11111111-1111-1111-1111-111111111111', 0, '[]', '{}', 'hash') $$)
) as routines(name, statement);
select throws_ok(format(statement, table_name), '42501', null, 'anon cannot ' || operation || ' ' || table_name)
from (values ('games'), ('events'), ('groups'), ('scoring_sessions')) as tables(table_name)
cross join (values
  ('insert', 'insert into public.%I default values'),
  ('update', 'update public.%I set game_id = game_id where false'),
  ('delete', 'delete from public.%I where false'),
  ('truncate', 'truncate public.%I cascade')
) as writes(operation, statement)
where operation <> 'update' or table_name <> 'games';
select throws_ok('update public.games set revision = revision where false', '42501', null, 'anon cannot update games');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","is_anonymous":true}';
select is((select count(*) from public.games where id = '11111111-1111-1111-1111-111111111111'),
  0::bigint, 'an anonymous signed-in user cannot read another scorer''s private game');
select is((select count(*) from public.events where game_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint, 'an anonymous signed-in user cannot read another scorer''s private events');
select throws_ok(statement, '42501', null, 'authenticated cannot call ' || name)
from (values
  ('get_base', $$ select private.get_base('11111111-1111-1111-1111-111111111111') $$),
  ('take_over', $$ select private.take_over('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a') $$),
  ('commit_group', $$ select private.commit_group('00000000-0000-0000-0000-00000000000a', null, '11111111-1111-1111-1111-111111111111', 0, '[]', '{}', 'hash') $$)
) as routines(name, statement);
select throws_ok(format(statement, table_name), '42501', null, 'authenticated cannot ' || operation || ' ' || table_name)
from (values ('games'), ('events'), ('groups'), ('scoring_sessions')) as tables(table_name)
cross join (values
  ('insert', 'insert into public.%I default values'),
  ('update', 'update public.%I set game_id = game_id where false'),
  ('delete', 'delete from public.%I where false'),
  ('truncate', 'truncate public.%I cascade')
) as writes(operation, statement)
where operation <> 'update' or table_name <> 'games';
select throws_ok('update public.games set revision = revision where false', '42501', null, 'authenticated cannot update games');

reset role;
select * from finish();
rollback;
