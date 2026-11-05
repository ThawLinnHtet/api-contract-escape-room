import 'server-only';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure } from './trpc';
import { gatewayHints, unlockGateway } from './gateway';
import { lockActiveRun } from './session';
import { queryHistoryInput } from '@/shared/history';
import { recordQuery } from './history';
import { schemas, roomIds } from '@/shared/campaign';
import { mutateCampaign, readRoom, searchArchive, powerStatus, requireRoom } from './campaign';

const roomHints = {
  gateway: gatewayHints,
  identity: ['Inspect your clearance with identity.status.', 'Your gateway receipt is a credential for this run.', 'Copy the gateway receipt from Inventory into the credential field.'],
  archive: ['Read beyond the first page.', 'Search maintenance and copy nextCursor into the next search.', 'The repair note identifies Emergency maintenance key. Recover its record ID.'],
  power: ['The startup protocol describes an order.', 'Cooling must be active before core; uplink comes last.', 'Activate cooling, then core, then uplink using separate requests.'],
  control: ['Three earned artifacts authorize restoration.', 'The contract names the vault seal, maintenance key, and power checksum.', 'Copy those three values from Inventory into their matching fields.'],
};
const runInput = z.object({ runId: z.uuid() }).strict();

const mutationInput = <T extends z.ZodType>(schema: T) => z.object({ runId: z.uuid(), requestId: z.uuid(), input: schema }).strict();
const roomQuery = (room: 'identity' | 'archive' | 'power') => protectedProcedure.input(runInput).use(async ({ ctx, input, next }) => {
  const run = await readRoom(ctx.sessionId, input.runId, room);
  return next({ ctx: { ...ctx, run } });
});
export const appRouter = router({
  identity: router({
    status: roomQuery('identity').query(({ ctx }) => ({ clearance: ctx.run.clearance })),
    claim: protectedProcedure.input(mutationInput(schemas['identity.claim'])).mutation(({ ctx, input }) => mutateCampaign(ctx.sessionId, input, 'identity.claim', 'identity')),
  }),
  archive: router({
    search: protectedProcedure.input(runInput.extend(schemas['archive.search'].shape)).query(async ({ ctx, input }) => {
      await readRoom(ctx.sessionId, input.runId, 'archive');
      return searchArchive(input.runId, input.tag, input.cursor);
    }),
    recover: protectedProcedure.input(mutationInput(schemas['archive.recover'])).mutation(({ ctx, input }) => mutateCampaign(ctx.sessionId, input, 'archive.recover', 'archive')),
  }),
  power: router({
    status: roomQuery('power').query(({ ctx }) => powerStatus(ctx.run.revision)),
    activate: protectedProcedure.input(mutationInput(schemas['power.activate'])).mutation(({ ctx, input }) => mutateCampaign(ctx.sessionId, input, 'power.activate', 'power')),
  }),
  control: router({
    restore: protectedProcedure.input(mutationInput(schemas['control.restore'])).mutation(({ ctx, input }) => mutateCampaign(ctx.sessionId, input, 'control.restore', 'control')),
  }),
  gateway: router({
    unlock: protectedProcedure.input(z.object({
      runId: z.uuid(), requestId: z.uuid(),
      input: schemas['gateway.unlock'],
    }).strict()).mutation(({ ctx, input }) => unlockGateway(ctx.sessionId, input)),
  }),
  game: router({
    recordQuery: protectedProcedure.input(queryHistoryInput).mutation(({ ctx, input }) => recordQuery(ctx.sessionId, input)),
    progress: protectedProcedure.query(async ({ ctx }) => {
      const session = await ctx.db.guestSession.findUnique({
        where: { id: ctx.sessionId },
        select: { activeRun: { select: {
          id: true, startedAt: true, completedAt: true,
          rooms: { select: { roomId: true, solvedAt: true, hintLevel: true } },
          artifacts: { select: { kind: true, value: true } },
          _count: { select: { attempts: true } },
        } } },
      });
      if (!session?.activeRun) throw new TRPCError({ code: 'NOT_FOUND', message: 'No active game. Start a guest game.' });
      const run = session.activeRun;
      return {
        id: run.id, startedAt: run.startedAt.toISOString(), completedAt: run.completedAt?.toISOString() ?? null,
        rooms: run.rooms.map(room => ({ ...room, solvedAt: room.solvedAt?.toISOString() ?? null })),
        artifacts: run.artifacts,
        hintsUsed: run.rooms.reduce((sum, room) => sum + room.hintLevel, 0),
        requestCount: run._count.attempts,
        hints: gatewayHints.slice(0, run.rooms.find(room => room.roomId === 'gateway')?.hintLevel ?? 0),
        roomHints: Object.fromEntries(roomIds.map(id => [id, roomHints[id].slice(0, run.rooms.find(r => r.roomId === id)?.hintLevel ?? 0)])),
      };
    }),
    history: protectedProcedure.input(z.object({
      runId: z.uuid(), cursor: z.uuid().optional(),
    }).strict()).query(async ({ ctx, input }) => {
      const session = await ctx.db.guestSession.findUnique({ where: { id: ctx.sessionId }, select: { activeRunId: true } });
      if (session?.activeRunId !== input.runId) throw new TRPCError({ code: 'FORBIDDEN', message: 'This game is no longer active.' });
      if (input.cursor) {
        const cursor = await ctx.db.requestAttempt.findFirst({ where: { id: input.cursor, runId: input.runId }, select: { id: true } });
        if (!cursor) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown history cursor.' });
      }
      const attempts = await ctx.db.requestAttempt.findMany({
        where: { runId: input.runId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: { id: true, procedure: true, input: true, response: true, createdAt: true, durationMs: true, source: true },
      });
      const hasMore = attempts.length > 20;
      const items = attempts.slice(0, 20).map(attempt => ({ ...attempt, createdAt: attempt.createdAt.toISOString() }));
      return { items, nextCursor: hasMore ? items.at(-1)!.id : null };
    }),
    hint: protectedProcedure.input(runInput.extend({ roomId: z.enum(roomIds).default('gateway'), level: z.number().int().min(1).max(3).optional() })).mutation(({ ctx, input }) => ctx.db.$transaction(async tx => {
      await lockActiveRun(tx, ctx.sessionId, input.runId);
      await requireRoom(tx, input.runId, input.roomId);
      const room = await tx.roomProgress.upsert({ where: { runId_roomId: { runId: input.runId, roomId: input.roomId } }, create: { runId: input.runId, roomId: input.roomId }, update: {} });
      const level = input.level ?? Math.min(3, room.hintLevel + 1);
      if (level > room.hintLevel + 1) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Reveal the preceding hint first.' });
      if (level <= room.hintLevel) return roomHints[input.roomId].slice(0, room.hintLevel);
      await tx.roomProgress.update({ where: { id: room.id }, data: { hintLevel: level } });
      return roomHints[input.roomId].slice(0, level);
    })),
    restart: protectedProcedure.input(runInput).mutation(({ ctx, input }) => ctx.db.$transaction(async tx => {
      await lockActiveRun(tx, ctx.sessionId, input.runId);
      const run = await tx.gameRun.create({ data: { sessionId: ctx.sessionId, rooms: { create: { roomId: 'gateway' } } } });
      await tx.guestSession.update({ where: { id: ctx.sessionId }, data: { activeRunId: run.id } });
      return { runId: run.id };
    })),
  }),
});

export type AppRouter = typeof appRouter;
