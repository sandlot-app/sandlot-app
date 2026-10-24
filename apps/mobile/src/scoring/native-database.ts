import { openDatabaseAsync } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { SqlConnection, SqlDatabase } from './database.ts';

function connection(database: SQLiteDatabase): SqlConnection {
  return {
    exec: (sql) => database.execAsync(sql),
    all: (sql, values = []) => database.getAllAsync(sql, values),
    async run(sql, values = []) {
      await database.runAsync(sql, values);
    },
  };
}

export async function openNativeDatabase(): Promise<SqlDatabase> {
  const database = await openDatabaseAsync('sandlot-games.db', {
    useNewConnection: true,
  });
  try {
    await database.execAsync(
      'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON',
    );
  } catch (error) {
    await database.closeAsync();
    throw error;
  }
  return {
    ...connection(database),
    transaction: (task) =>
      database.withExclusiveTransactionAsync(async (transaction) => {
        await task(connection(transaction));
      }),
    close: () => database.closeAsync(),
  };
}
