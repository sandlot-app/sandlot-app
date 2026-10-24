import { DatabaseSync } from 'node:sqlite';
import type { SqlDatabase, SqlConnection, SqlValue } from '../src/scoring/database.ts';

export function connect(path: string, beforeOutbox?: () => void): SqlDatabase {
  const database = new DatabaseSync(path);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 1');
  if (beforeOutbox) database.function('before_outbox', () => { beforeOutbox(); return null; });
  const connection: SqlConnection = {
    async exec(sql) { database.exec(sql); },
    async all<T>(sql: string, values: SqlValue[] = []): Promise<T[]> {
      return database.prepare(sql).all(...values) as T[];
    },
    async run(sql, values = []) { database.prepare(sql).run(...values); },
  };
  return {
    ...connection,
    async transaction(task) {
      database.exec('BEGIN IMMEDIATE');
      try {
        await task(connection);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    async close() { database.close(); },
  };
}
