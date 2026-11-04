import nextEnv from '@next/env';
import pg from 'pg';

nextEnv.loadEnvConfig(process.cwd());
const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
try {
  await client.connect();
  const result = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'escape_room' ORDER BY table_name`);
  console.log('escape_room schema tables:', result.rows.map(row => row.table_name).join(', ') || '(none)');
} catch (error) {
  console.error('Database inspection failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally { await client.end(); }
