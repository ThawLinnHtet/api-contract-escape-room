import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { createToken, hashToken, hasSameOrigin, readSession, SESSION_COOKIE } from '@/server/session';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!hasSameOrigin(req)) return NextResponse.json({ error: 'A same-origin request is required.' }, { status: 403 });
  try {
    const current = await readSession(req);
    if (current?.activeRunId) return NextResponse.json({ ready: true }, { headers: { 'Cache-Control': 'no-store' } });
    const token = createToken();
    await getDb().$transaction(async tx => {
      const session = await tx.guestSession.create({ data: { tokenHash: hashToken(token) } });
      const run = await tx.gameRun.create({ data: { sessionId: session.id, rooms: { create: { roomId: 'gateway' } } } });
      await tx.guestSession.update({ where: { id: session.id }, data: { activeRunId: run.id } });
    });
    const response = NextResponse.json({ ready: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', secure: new URL(req.url).protocol === 'https:',
      path: '/', maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Could not start a game. Check the database connection and try again.' }, { status: 503 });
  }
}
