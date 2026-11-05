import { z } from 'zod';
export const roomIds = ['gateway', 'identity', 'archive', 'power', 'control'] as const;
export type RoomId = typeof roomIds[number];
export const schemas = {
  'gateway.unlock': z.object({ accessCode: z.string().regex(/^\d{4}$/, 'accessCode must contain exactly four digits.') }).strict(),
  'identity.status': z.object({}).strict(),
  'identity.claim': z.object({ credential: z.string().min(1).max(200) }).strict(),
  'archive.search': z.object({ tag: z.string().regex(/^[a-z][a-z-]{1,31}$/, 'Use 2–32 lowercase letters or hyphens, starting with a letter.'), cursor: z.string().max(100).optional() }).strict(),
  'archive.recover': z.object({ recordId: z.string().min(1).max(100) }).strict(),
  'power.status': z.object({}).strict(),
  'power.activate': z.object({ switchId: z.enum(['cooling', 'core', 'uplink']) }).strict(),
  'control.restore': z.object({ vaultSeal: z.string().min(1).max(200), maintenanceKey: z.string().min(1).max(200), powerChecksum: z.string().min(1).max(200) }).strict(),
};
export type Procedure = keyof typeof schemas;
export const rooms: { id: RoomId; name: string; title: string; story: string; clueTitle: string; clue: string; concept: string; procedures: Procedure[] }[] = [
  { id: 'gateway', name: 'The Locked Gateway', title: 'Restore the gateway.', story: 'You are inside a server that has stopped responding. Restore its five systems to find your way out.', clueTitle: 'Incident plaque', clue: '“Commissioned in 1991. The gateway still remembers its first year.”', concept: 'A valid input shape is different from a correct answer.', procedures: ['gateway.unlock'] },
  { id: 'identity', name: 'Identity Vault', title: 'Prove you belong.', story: 'The archive accepts archivists only. Inspect your clearance, then present the receipt from the gateway.', clueTitle: 'Credential reader', clue: 'Your gateway receipt is your proof of entry. Find it in the inventory and submit it as credential.', concept: 'The server derives permissions from your session.', procedures: ['identity.status', 'identity.claim'] },
  { id: 'archive', name: 'Broken Archive', title: 'Recover the missing key.', story: 'The maintenance index survived the outage. Search it, follow the pages, and find the repair note identifying the key record.', clueTitle: 'Archive index', clue: 'Search the maintenance tag. Each page holds three records; use nextCursor unchanged to read the next page.', concept: 'Queries read paginated data; mutations change state.', procedures: ['archive.search', 'archive.recover'] },
  { id: 'power', name: 'Power Grid', title: 'Bring the systems online.', story: 'Three switches remain operational: cooling, core, and uplink. Activate them in the safe sequence.', clueTitle: 'Startup protocol', clue: 'Stabilize cooling before booting the core. Reconnect communications last. Inspect power.status to see what is already active.', concept: 'Atomic transitions keep concurrent requests in order.', procedures: ['power.status', 'power.activate'] },
  { id: 'control', name: 'Control Room', title: 'Restore the server.', story: 'The systems are ready. Combine the three recovered artifacts to authorize the final restoration.', clueTitle: 'Restoration checklist', clue: 'Use the vault seal, maintenance key, and power checksum from your inventory. Each value belongs to this run.', concept: 'The server verifies evidence and records completion once.', procedures: ['control.restore'] },
];
export const contracts: Record<Procedure, { shape: string; description: string; example: object; query?: boolean }> = {
  'gateway.unlock': { shape: '{ accessCode: string }', description: 'accessCode must contain exactly four digits. Send the value as a string.', example: { accessCode: '0000' } },
  'identity.status': { shape: '{}', description: 'No puzzle input. Read the current clearance without changing progress.', example: {}, query: true },
  'identity.claim': { shape: '{ credential: string }', description: 'Present the gateway receipt earned in this run.', example: { credential: 'paste your gateway receipt' } },
  'archive.search': { shape: '{ tag: string, cursor?: string }', description: 'Tag: 2–32 lowercase letters or hyphens, starting with a letter. Three records per page. Omit cursor on the first page; copy nextCursor for later pages.', example: { tag: 'example-tag' }, query: true },
  'archive.recover': { shape: '{ recordId: string }', description: 'Submit the record ID identified by the repair note.', example: { recordId: 'paste the key record ID' } },
  'power.status': { shape: '{}', description: 'Read activated switches and available switch IDs. No puzzle input.', example: {}, query: true },
  'power.activate': { shape: '{ switchId: string }', description: 'Choose cooling, core, or uplink. Already active switches are safe to repeat.', example: { switchId: 'uplink' } },
  'control.restore': { shape: '{ vaultSeal: string, maintenanceKey: string, powerChecksum: string }', description: 'Copy all three earned values from the inventory.', example: { vaultSeal: 'paste vault seal', maintenanceKey: 'paste maintenance key', powerChecksum: 'paste power checksum' } },
};
export const artifactNames: Record<string, string> = { 'gateway-receipt': 'Gateway receipt', 'vault-seal': 'Vault seal', 'maintenance-key': 'Maintenance key', 'power-checksum': 'Power checksum' };
