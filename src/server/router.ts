import 'server-only';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure } from './trpc';
import { gatewayHints, unlockGateway } from './gateway';
import { lockActiveRun } from './session';

const runInput = z.object({ runId: z.uuid() }).strict();

export const appRouter = router({
  gateway: router({
    unlock: protectedProcedure.input(z.object({
      runId: z.uuid(), requestId: z.uuid(),
      input: z.object({ accessCode: z.string().regex(/^\d{4}$/, 'accessCode must contain exactly four digits.') }).strict(),
    }).strict()).mutation(({ ctx, input }) => unlockGateway(ctx.sessionId, input)),
  }),
  game: router({
    progress: protectedProcedure.query(async ({ ctx }) => {
      const session = await ctx.db.guestSession.findUnique({
        where: { id: ctx.sessionId },
        select: { activeRun: { select: {
          id: true, startedAt: true, completedAt: true,
          rooms: { select: { roomId: true, solvedAt: true, hintLevel: true } },
          artifacts: { select: { kind: true, value: true } },
        } } },
      });
      if (!session?.activeRun) throw new TRPCError({ code: 'NOT_FOUND', message: 'No active game. Start a guest game.' });
      const run = session.activeRun;
      return {
        id: run.id, startedAt: run.startedAt.toISOString(), completedAt: run.completedAt?.toISOString() ?? null,
        rooms: run.rooms.map(room => ({ ...room, solvedAt: room.solvedAt?.toISOString() ?? null })),
        artifacts: run.artifacts,
        hints: gatewayHints.slice(0, run.rooms.find(room => room.roomId === 'gateway')?.hintLevel ?? 0),
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
        select: { id: true, procedure: true, input: true, response: true, createdAt: true, durationMs: true },
      });
      const hasMore = attempts.length > 20;
      const items = attempts.slice(0, 20).map(attempt => ({ ...attempt, createdAt: attempt.createdAt.toISOString() }));
      return { items, nextCursor: hasMore ? items.at(-1)!.id : null };
    }),
    hint: protectedProcedure.input(runInput).mutation(({ ctx, input }) => ctx.db.$transaction(async tx => {
      await lockActiveRun(tx, ctx.sessionId, input.runId);
      const room = await tx.roomProgress.findUniqueOrThrow({ where: { runId_roomId: { runId: input.runId, roomId: 'gateway' } } });
      const level = Math.min(3, room.hintLevel + 1);
      await tx.roomProgress.update({ where: { id: room.id }, data: { hintLevel: level } });
      return gatewayHints.slice(0, level);
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
