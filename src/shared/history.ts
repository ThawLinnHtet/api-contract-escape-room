import { z } from 'zod';
import { schemas } from './campaign';

const meta = {
  runId: z.uuid(), requestId: z.uuid(), durationMs: z.number().int().min(0).max(600_000),
};
export const queryHistoryInput = z.discriminatedUnion('procedure', [
  z.object({ ...meta, procedure: z.literal('identity.status'), input: schemas['identity.status'], data: z.object({ clearance: z.enum(['guest', 'archivist']) }).strict() }).strict(),
  z.object({ ...meta, procedure: z.literal('archive.search'), input: schemas['archive.search'], data: z.object({ records: z.array(z.object({ id: z.string().max(100), title: z.string().max(100), body: z.string().max(500) }).strict()).max(3), nextCursor: z.string().max(100).nullable() }).strict() }).strict(),
  z.object({ ...meta, procedure: z.literal('power.status'), input: schemas['power.status'], data: z.object({ activated: z.array(z.enum(['cooling', 'core', 'uplink'])).max(3), switches: z.array(z.enum(['cooling', 'core', 'uplink'])).max(3) }).strict() }).strict(),
]);
export type QueryHistoryInput = z.infer<typeof queryHistoryInput>;
