import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { getDb } from './db';
import { lockActiveRun } from './session';

export const gatewayHints = [
  'The gateway expects a four-digit year. Read the incident plaque.',
  'Use the commissioning year, not the current year.',
  'Submit { "accessCode": "1991" } to the gateway.unlock procedure.',
];

export type GatewayResult = {
  outcome: 'INCORRECT' | 'SOLVED' | 'ALREADY_APPLIED';
  message: string;
  data?: { artifact: string };
};

export async function unlockGateway(sessionId: string, payload: {
  runId: string; requestId: string; input: { accessCode: string };
}): Promise<GatewayResult> {
  const start = Date.now();
  const fingerprint = createHash('sha256').update(JSON.stringify(payload.input)).digest('hex');
  return getDb().$transaction(async tx => {
    await lockActiveRun(tx, sessionId, payload.runId);
    const existing = await tx.requestAttempt.findUnique({
      where: { runId_requestId: { runId: payload.runId, requestId: payload.requestId } },
    });
    if (existing) {
      if (existing.fingerprint !== fingerprint || existing.procedure !== 'gateway.unlock') {
        throw new TRPCError({ code: 'CONFLICT', message: 'This request ID was already used with a different input.' });
      }
      return existing.response as unknown as GatewayResult;
    }

    const room = await tx.roomProgress.findUniqueOrThrow({
      where: { runId_roomId: { runId: payload.runId, roomId: 'gateway' } },
    });
    let result: GatewayResult;
    if (room.solvedAt) {
      const artifact = await tx.artifact.findUniqueOrThrow({
        where: { runId_kind: { runId: payload.runId, kind: 'gateway-receipt' } },
      });
      result = { outcome: 'ALREADY_APPLIED', message: 'The gateway is already restored. Your receipt is unchanged.', data: { artifact: artifact.value } };
    } else if (payload.input.accessCode !== '1991') {
      result = { outcome: 'INCORRECT', message: 'The input is valid, but the code does not match the commissioning year. Check the incident plaque.' };
    } else {
      const artifact = `gw_${randomBytes(12).toString('hex')}`;
      await tx.roomProgress.update({ where: { id: room.id }, data: { solvedAt: new Date() } });
      await tx.artifact.create({ data: { runId: payload.runId, kind: 'gateway-receipt', value: artifact } });
      result = { outcome: 'SOLVED', message: 'Gateway restored. Your gateway receipt is saved in the inventory.', data: { artifact } };
    }

    await tx.requestAttempt.create({ data: {
      runId: payload.runId, requestId: payload.requestId, procedure: 'gateway.unlock', fingerprint,
      input: payload.input, response: result, durationMs: Math.max(0, Date.now() - start),
    } });
    return result;
  }, { maxWait: 15_000, timeout: 20_000 });
}
