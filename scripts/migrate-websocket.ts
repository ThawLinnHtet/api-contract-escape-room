import nextEnv from '@next/env';
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Pool } from '@neondatabase/serverless';
import { configureNeonTransport } from '../src/server/neon-transport';

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL_UNPOOLED) throw new Error('DATABASE_URL_UNPOOLED is required');
configureNeonTransport();
const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED, connectionTimeoutMillis: 15000 });
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(72707369)');
  await client.query('CREATE SCHEMA IF NOT EXISTS escape_room');
  // Use the Prisma migration ledger so TCP and WebSocket deployments agree.
  await client.query(`CREATE TABLE IF NOT EXISTS escape_room._prisma_migrations (
    id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL,
    finished_at timestamptz, migration_name varchar(255) NOT NULL, logs text,
    rolled_back_at timestamptz, started_at timestamptz NOT NULL DEFAULT now(),
    applied_steps_count integer NOT NULL DEFAULT 0)`);
  for (const name of (await readdir('prisma/migrations')).sort()) {
    if (!/^\d+_/.test(name)) continue;
    const sql = await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const { rows } = await client.query('SELECT checksum, finished_at FROM escape_room._prisma_migrations WHERE migration_name=$1 AND rolled_back_at IS NULL', [name]);
    if (rows.length) {
      if (!rows[0].finished_at || rows[0].checksum !== checksum) throw new Error(`Migration ${name} is incomplete or has changed`);
      console.log(`${name}: already applied`);
      continue;
    }
    // Only explicitly transactional migrations are supported by this runner.
    if (!/^\s*BEGIN;[\s\S]*COMMIT;\s*$/.test(sql)) throw new Error(`${name}: explicit BEGIN/COMMIT required`);
    await client.query('BEGIN');
    try {
      await client.query(sql.replace(/^\s*BEGIN;/, '').replace(/COMMIT;\s*$/, ''));
      await client.query('INSERT INTO escape_room._prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1,$2,$3,now(),1)', [randomUUID(), checksum, name]);
      await client.query('COMMIT');
      console.log(`${name}: applied`);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(72707369)');
  client.release();
  await pool.end();
}
