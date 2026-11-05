import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { getDb } from './db';
import { lockActiveRun } from './session';
import { roomIds, type RoomId } from '@/shared/campaign';
import type { Prisma } from '@/generated/prisma/client';

type Tx = Prisma.TransactionClient;
export type Outcome = { outcome: 'INCORRECT' | 'PROGRESS' | 'SOLVED' | 'ALREADY_APPLIED'; message: string; data?: { artifact?: string; activated?: string[]; completedAt?: string } };
const switches = ['cooling', 'core', 'uplink'];
const token = (runId: string, value: string) => createHash('sha256').update(`${runId}:${value}`).digest('hex').slice(0, 32);
export async function requireRoom(tx: Tx, runId: string, room: RoomId) {
  const index = roomIds.indexOf(room);
  const run = await tx.gameRun.findUniqueOrThrow({ where: { id: runId }, include: { rooms: true, artifacts: true } });
  if (roomIds.slice(0, index).some(id => !run.rooms.find(r => r.roomId === id)?.solvedAt) || (index >= 2 && run.clearance !== 'archivist')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'This room is locked. Restore the preceding systems first.' });
  }
  return run;
}
export async function readRoom(sessionId: string, runId: string, room: RoomId) {
  const session = await getDb().guestSession.findUnique({ where: { id: sessionId }, select: { activeRunId: true } });
  if (session?.activeRunId !== runId) throw new TRPCError({ code: 'FORBIDDEN', message: 'This game is no longer active.' });
  return requireRoom(getDb(), runId, room);
}
const records = [
  { title: 'Cooling inspection', body: 'Fans passed the last inspection.' },
  { title: 'Service roster', body: 'The on-call archivist signed out at midnight.' },
  { title: 'Parts inventory', body: 'Three replacement relays remain in storage.' },
  { title: 'Repair note', body: 'Recover the record titled Emergency maintenance key. Its record ID is on this page.' },
  { title: 'Emergency maintenance key', body: 'Recovery package intact. Submit this record ID to archive.recover.' },
  { title: 'Shift handoff', body: 'Restore cooling before restarting the core.' },
];
export function searchArchive(runId: string, tag: string, cursor?: string) {
  const nextToken = token(runId, `archive:${tag}:3`);
  if (cursor && cursor !== nextToken) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cursor does not belong to this run and filter. Start a new search.' });
  const offset = cursor ? 3 : 0;
  return { records: tag === 'maintenance' ? records.slice(offset, offset + 3).map((r, i) => ({ ...r, id: token(runId, `record:${offset + i}`) })) : [], nextCursor: tag === 'maintenance' && !cursor ? nextToken : null };
}
export function powerStatus(revision: number) { return { activated: switches.slice(0, revision), switches }; }
export async function mutateCampaign(sessionId: string, payload: { runId: string; requestId: string; input: Record<string, string> }, procedure: string, room: RoomId): Promise<Outcome> {
  const start = Date.now();
  const fingerprint = createHash('sha256').update(JSON.stringify(payload.input)).digest('hex');
  return getDb().$transaction(async tx => {
    await lockActiveRun(tx, sessionId, payload.runId);
    const run = await requireRoom(tx, payload.runId, room);
    const prior = await tx.requestAttempt.findUnique({ where: { runId_requestId: { runId: run.id, requestId: payload.requestId } } });
    if (prior) {
      if (prior.procedure !== procedure || prior.fingerprint !== fingerprint) throw new TRPCError({ code: 'CONFLICT', message: 'This request ID was already used with a different input.' });
      return prior.response as unknown as Outcome;
    }
    const earned = (kind: string) => run.artifacts.find(a => a.kind === kind)?.value;
    const artifactKinds: Partial<Record<RoomId, string>> = { identity: 'vault-seal', archive: 'maintenance-key', power: 'power-checksum' };
    const kind = artifactKinds[room];
    let result: Outcome;
    const completedSwitch = room === 'power' && switches.indexOf(payload.input.switchId) < run.revision;
    if (run.rooms.find(r => r.roomId === room)?.solvedAt || completedSwitch) {
      result = { outcome: 'ALREADY_APPLIED', message: 'This operation is already applied. Your progress is unchanged.', data: room === 'control' ? { completedAt: run.completedAt!.toISOString() } : { ...(kind && earned(kind) ? { artifact: earned(kind) } : {}), ...(room === 'power' ? powerStatus(run.revision) : {}) } };
    } else {
      const correct = room === 'identity' ? payload.input.credential === earned('gateway-receipt')
        : room === 'archive' ? payload.input.recordId === token(run.id, 'record:4')
        : room === 'power' ? payload.input.switchId === switches[run.revision]
        : payload.input.vaultSeal === earned('vault-seal') && payload.input.maintenanceKey === earned('maintenance-key') && payload.input.powerChecksum === earned('power-checksum');
      if (!correct) result = { outcome: 'INCORRECT', message: room === 'power' ? 'That switch is out of sequence. Check the startup protocol; your active switches are unchanged.' : 'The evidence does not match. Check this room’s clue and your inventory.' };
      else {
        if (room === 'power') await tx.gameRun.update({ where: { id: run.id }, data: { revision: { increment: 1 } } });
        if (room === 'power' && run.revision < 2) result = { outcome: 'PROGRESS', message: 'Switch activated. Continue the startup sequence.', data: powerStatus(run.revision + 1) };
        else {
          await tx.roomProgress.upsert({ where: { runId_roomId: { runId: run.id, roomId: room } }, create: { runId: run.id, roomId: room, solvedAt: new Date() }, update: { solvedAt: new Date() } });
          if (room === 'identity') await tx.gameRun.update({ where: { id: run.id }, data: { clearance: 'archivist' } });
          const completedAt = new Date();
          if (room === 'control') await tx.gameRun.update({ where: { id: run.id }, data: { completedAt } });
          const artifact = kind ? `${kind}_${randomBytes(12).toString('hex')}` : undefined;
          if (kind && artifact) await tx.artifact.create({ data: { runId: run.id, kind, value: artifact } });
          result = { outcome: 'SOLVED', message: room === 'control' ? 'Server restored. You found your way out.' : 'System restored. Your artifact is saved in the inventory.', data: room === 'control' ? { completedAt: completedAt.toISOString() } : { artifact } };
        }
      }
    }
    await tx.requestAttempt.create({ data: { runId: run.id, requestId: payload.requestId, procedure, fingerprint, input: payload.input, response: result as Prisma.InputJsonValue, durationMs: Date.now() - start } });
    return result;
  }, { maxWait: 15000, timeout: 20000 });
}
