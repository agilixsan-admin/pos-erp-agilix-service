import { Client } from 'pg';
import { Logger } from '@nestjs/common';

/**
 * Ensures the PostgreSQL database exists before TypeORM attempts connection.
 * - In Development & Staging: Checks and automatically creates the database if missing.
 * - In Production: Skipped by default (manual database provisioning is required),
 *   unless explicitly enabled via DB_AUTO_CREATE=true.
 * - Non-blocking: If maintenance database connection or creation fails (e.g. limited cloud permissions),
 *   it logs a helpful note and lets the main application connection proceed gracefully.
 */
export async function ensureDatabaseExists(logger?: Logger): Promise<void> {
  const log = logger ?? new Logger('DatabaseInit');

  // Skip in test environment or if DB_HOST is not configured
  if (process.env.NODE_ENV === 'test' || !process.env.DB_HOST) {
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const autoCreateEnv = process.env.DB_AUTO_CREATE;

  // In production, default to false (manual provisioning). In dev/staging, default to true.
  const shouldAutoCreate = isProd
    ? autoCreateEnv === 'true'
    : autoCreateEnv !== 'false';

  if (!shouldAutoCreate) {
    log.log(
      '[Database] Auto-create database is disabled (manual provisioning required in production)',
    );
    return;
  }

  const host = process.env.DB_HOST ?? 'localhost';
  const port = Number(process.env.DB_PORT ?? 5432);
  const user = process.env.DB_USERNAME ?? 'postgres';
  const password = process.env.DB_PASSWORD ?? '';
  const targetDb = process.env.DB_NAME ?? 'aglix_pos';
  const defaultDb = process.env.DB_DEFAULT_NAME ?? 'postgres';
  const ssl = process.env.DB_SSL === 'true';

  // Sanitize target database name to prevent SQL identifier injection
  if (!/^[a-zA-Z0-9_]+$/.test(targetDb)) {
    log.warn(
      `[Database] Target database name "${targetDb}" contains invalid characters. Skipping auto-creation.`,
    );
    return;
  }

  const client = new Client({
    host,
    port,
    user,
    password,
    database: defaultDb,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();

    const checkRes = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1;',
      [targetDb],
    );

    if (checkRes.rowCount === 0) {
      log.log(
        `[Database] Database "${targetDb}" does not exist on ${host}:${port}. Creating...`,
      );
      await client.query(`CREATE DATABASE "${targetDb}";`);
      log.log(
        `[Database] Database "${targetDb}" created successfully on ${host}:${port}`,
      );
    } else {
      log.log(`[Database] Database "${targetDb}" verified on ${host}:${port}`);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.warn(
      `[Database] Note: Could not auto-check/create database "${targetDb}" via maintenance DB "${defaultDb}": ${errorMsg}`,
    );
  } finally {
    try {
      await client.end();
    } catch {
      // Ignore client end error
    }
  }
}
