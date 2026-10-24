export type SqlValue = string | number | null;

export type SqlConnection = {
  exec(sql: string): Promise<void>;
  all<T>(sql: string, values?: SqlValue[]): Promise<T[]>;
  run(sql: string, values?: SqlValue[]): Promise<void>;
};

export type SqlDatabase = SqlConnection & {
  transaction(
    task: (connection: SqlConnection) => Promise<void>,
  ): Promise<void>;
  close(): Promise<void>;
};
