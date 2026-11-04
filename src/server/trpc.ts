import 'server-only';
import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { getDb } from './db';
import { readSession } from './session';

export async function createContext(req: Request) {
  const session = await readSession(req);
  return { db: getDb(), sessionId: session?.id ?? null };
}

const t = initTRPC.context<Awaited<ReturnType<typeof createContext>>>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      message: error.code === 'INTERNAL_SERVER_ERROR'
        ? 'The database request could not finish. Retry in a moment.' : shape.message,
      data: {
        code: shape.data.code, httpStatus: shape.data.httpStatus, path: shape.data.path,
        validation: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.sessionId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Start a guest game to continue.' });
  return next({ ctx: { ...ctx, sessionId: ctx.sessionId } });
});
