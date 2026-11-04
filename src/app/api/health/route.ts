import { getDb } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await getDb().$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok', postgres: 'connected' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable', postgres: 'disconnected' }, { status: 503 });
  }
}
