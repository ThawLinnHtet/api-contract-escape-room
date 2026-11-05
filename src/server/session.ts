import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@/generated/prisma/client';
import { getDb } from './db';

export const SESSION_COOKIE = 'escape_room_session';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const createToken = () => randomBytes(32).toString('base64url');

export function hasSameOrigin(req: Request): boolean {
  const url = new URL(req.url);
  const host = req.headers.get('host');
  if (!host) return false;
  return req.headers.get('origin') === `${url.protocol}//${host}`;
}

export async function readSession(req: Request) {
  const token = req.headers.get('cookie')?.split(';').map(v => v.trim())
    .find(v => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return getDb().guestSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, activeRunId: true },
  });
}

// Serializes mutations for one guest, including restart and duplicate requests.
export async function lockActiveRun(tx: Prisma.TransactionClient, sessionId: string, runId: string) {
  await tx.$queryRaw`SELECT "id" FROM "escape_room"."GuestSession" WHERE "id" = ${sessionId} FOR UPDATE`;
  const session = await tx.guestSession.findUnique({ where: { id: sessionId }, select: { activeRunId: true } });
  if (session?.activeRunId !== runId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'This game is no longer active. Reload to continue.' });
  }
}
