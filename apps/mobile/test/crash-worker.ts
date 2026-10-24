import { randomUUID } from 'node:crypto';
import { openOfflineGame } from '../src/scoring/offline-game.ts';
import { connect } from './database.ts';

const [path, mode] = process.argv.slice(2);
if (!path || !mode)
  throw new Error('A database path and crash or commit mode are required');
const database = connect(path, () => {
  process.exit(67);
});
const opened = await openOfflineGame(database, {
  newId: randomUUID,
  now: () => '2026-10-24T17:00:00.000Z',
});
if (opened.kind !== 'ready') throw new Error('The saved game must open');
if (mode === 'crash')
  await database.exec(
    'CREATE TRIGGER crash_outbox BEFORE INSERT ON local_outbox BEGIN SELECT before_outbox(); END',
  );
const result = await opened.record({ kind: 'pitch', result: 'called_strike' });
if (result.kind !== 'saved') throw new Error('The pitch must commit');
await database.close();
