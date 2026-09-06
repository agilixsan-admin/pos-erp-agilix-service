declare module 'pg' {
  export interface ClientConfig {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssl?: boolean | { rejectUnauthorized?: boolean };
    connectionTimeoutMillis?: number;
  }

  export interface QueryResult<R = Record<string, unknown>> {
    rows: R[];
    rowCount: number | null;
    command: string;
  }

  export class Client {
    constructor(config?: ClientConfig);
    connect(): Promise<void>;
    query<R = Record<string, unknown>>(
      queryText: string,
      values?: unknown[],
    ): Promise<QueryResult<R>>;
    end(): Promise<void>;
  }
}
