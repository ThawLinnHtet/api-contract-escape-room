import 'server-only';
import { PrismaNeon } from '@prisma/adapter-neon';
import { configureNeonTransport } from './neon-transport';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalDb = globalThis as unknown as { escapeRoomDb?: PrismaClient };

export function getDb(): PrismaClient {
  if (globalDb.escapeRoomDb) return globalDb.escapeRoomDb;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required. Run neon deploy.');
  const websocket = process.env.DATABASE_TRANSPORT === 'neon-websocket';
  if (websocket) configureNeonTransport();
  const Adapter = websocket ? PrismaNeon : PrismaPg;
  const adapter = new Adapter({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  }, { schema: 'escape_room' });
  globalDb.escapeRoomDb = new PrismaClient({ adapter });
  return globalDb.escapeRoomDb;
}
