import { openDatabaseAsync } from 'expo-sqlite';
import type { SqlConnection, SqlDatabase } from './database.ts';

export async function openNativeDatabase(name: string): Promise<SqlDatabase> {
  const database = await openDatabaseAsync(name, {
    useNewConnection: true,
  });
  const connection: SqlConnection = {
    exec: (sql) => database.execAsync(sql),
    all: (sql, values = []) => database.getAllAsync(sql, values),
    async run(sql, values = []) {
      await database.runAsync(sql, values);
    },
  };
  let pending = Promise.resolve();
  return {
    ...connection,
    transaction(task) {
      const result = pending.then(() =>
        database.withTransactionAsync(() => task(connection)),
      );
      pending = result.catch(() => {});
      return result;
    },
    async close() {
      await pending;
      await database.closeAsync();
    },
  };
}
