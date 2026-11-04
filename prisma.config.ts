import nextEnv from '@next/env';
import { defineConfig, env } from 'prisma/config';

nextEnv.loadEnvConfig(process.cwd());
const connection = new URL(env('DATABASE_URL_UNPOOLED'));
connection.searchParams.set('schema', 'escape_room');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: connection.toString() },
});
