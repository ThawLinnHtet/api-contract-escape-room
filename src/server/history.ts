import 'server-only';
import { createHash } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { getDb } from './db';
import { lockActiveRun } from './session';
import { requireRoom } from './campaign';
import type { QueryHistoryInput } from '@/shared/history';

// This is a client-supplied display record, never puzzle evidence.
export async function recordQuery(sessionId: string, input: QueryHistoryInput) {
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return getDb().$transaction(async tx => {
    await lockActiveRun(tx, sessionId, input.runId);
    const room = input.procedure === 'identity.status' ? 'identity' : input.procedure === 'archive.search' ? 'archive' : 'power';
    await requireRoom(tx, input.runId, room);
    const prior = await tx.requestAttempt.findUnique({ where: { runId_requestId: { runId: input.runId, requestId: input.requestId } } });
    if (prior) {
      if (prior.source !== 'query' || prior.fingerprint !== fingerprint) throw new TRPCError({ code: 'CONFLICT', message: 'This request ID was already used with different data.' });
      return { saved: true };
    }
    await tx.requestAttempt.create({ data: {
      runId: input.runId, requestId: input.requestId, procedure: input.procedure, source: 'query', fingerprint,
      input: input.input, response: { outcome: 'QUERY', message: 'Client-recorded query response.', data: input.data }, durationMs: input.durationMs,
    } });
    return { saved: true };
  }, { maxWait: 15_000, timeout: 20_000 });
}
