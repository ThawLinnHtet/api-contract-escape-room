import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext } from '@playwright/test';
import { createTRPCClient, httpLink } from '@trpc/client';
import type { AppRouter } from '../src/server/router';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3100';

async function api(context: BrowserContext) {
  const response = await context.request.post(`${baseURL}/api/session`, { headers: { origin: baseURL } });
  expect(response.status()).toBe(200);
  const cookie = (await context.cookies()).map(item => `${item.name}=${item.value}`).join('; ');
  return createTRPCClient<AppRouter>({ links: [httpLink({
    url: `${baseURL}/api/trpc`, headers: { origin: baseURL, cookie },
  })] });
}

test('Postgres health is verified through the running app', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', postgres: 'connected' });
});

test('browser game writes to Neon and survives reload with hints and history', async ({ page, context }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Start guest game', exact: true }).click();
  const send = page.getByRole('button', { name: 'Send request', exact: true });
  await expect(send).toBeEnabled();
  const input = page.getByLabel('JSON input', { exact: true });
  await input.fill('{');
  await send.click();
  await expect(page.getByRole('region', { name: 'Request', exact: true }).getByRole('alert')).toContainText('not valid JSON');
  await expect(input).toHaveValue('{');
  await input.fill('{ "accessCode": "12" }');
  await send.click();
  await expect(page.getByRole('region', { name: 'Request', exact: true }).getByRole('alert')).toContainText('exactly four digits');
  await expect(input).toHaveValue('{ "accessCode": "12" }');

  await input.fill('{ "accessCode": "0000" }');
  await send.click();
  await expect(page.getByTestId('response-json')).toContainText('INCORRECT');
  await page.getByRole('button', { name: 'Reveal hint 1 of 3' }).click();
  await expect(page.getByRole('button', { name: 'Reveal hint 2 of 3' })).toBeEnabled();
  await input.fill('{ "accessCode": "1991" }');
  await send.click();
  await expect(page.getByTestId('response-json')).toContainText('SOLVED');
  const receipt = await page.getByTestId('artifact-value').innerText();
  await expect(page.getByText('1 of 5 rooms solved', { exact: true })).toBeVisible();
  const session = (await context.cookies()).find(cookie => cookie.name === 'escape_room_session');
  expect(session?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('escape_room_session');

  await page.reload();
  await expect(page.getByTestId('artifact-value')).toHaveText(receipt);
  await expect(page.getByRole('button', { name: 'Reveal hint 2 of 3' })).toBeEnabled();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.locator('.history-entry')).toHaveCount(2);
  await page.locator('.history-entry summary').first().click();
  await expect(page.locator('.history-entry').first()).toContainText('SOLVED');
  expect(browserErrors).toEqual([]);
});

test('concurrent retries, ownership, restart isolation and same-origin protections hold', async ({ context, browser, request }) => {
  const client = await api(context);
  const initial = await client.game.progress.query();
  const payload = { runId: initial.id, requestId: randomUUID(), input: { accessCode: '1991' } };
  const [first, repeated] = await Promise.all([
    client.gateway.unlock.mutate(payload), client.gateway.unlock.mutate(payload),
  ]);
  expect(first).toEqual(repeated);
  expect(first.outcome).toBe('SOLVED');
  expect((await client.game.history.query({ runId: initial.id })).items).toHaveLength(1);
  expect((await client.game.progress.query()).artifacts).toHaveLength(1);
  await expect(client.gateway.unlock.mutate({ ...payload, input: { accessCode: '0000' } })).rejects.toMatchObject({ data: { code: 'CONFLICT' } });
  const nextAttempt = await client.gateway.unlock.mutate({ ...payload, requestId: randomUUID() });
  expect(nextAttempt.outcome).toBe('ALREADY_APPLIED');
  expect(nextAttempt.data).toEqual(first.data);

  const otherContext = await browser.newContext();
  try {
    const otherClient = await api(otherContext);
    expect((await otherClient.game.progress.query()).artifacts).toHaveLength(0);
    await expect(otherClient.gateway.unlock.mutate({ ...payload, requestId: randomUUID() })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    await expect(otherClient.game.history.query({ runId: initial.id })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  } finally { await otherContext.close(); }

  await client.game.restart.mutate({ runId: initial.id });
  const fresh = await client.game.progress.query();
  expect(fresh.id).not.toBe(initial.id);
  expect(fresh.artifacts).toHaveLength(0);
  expect((await client.game.history.query({ runId: fresh.id })).items).toHaveLength(0);
  await expect(client.gateway.unlock.mutate(payload)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  const csrf = await request.post('/api/session', { headers: { origin: 'https://example.invalid' } });
  expect(csrf.status()).toBe(403);
  const unsafeMutation = await request.post('/api/trpc/gateway.unlock', {
    headers: { origin: 'https://example.invalid' }, data: payload,
  });
  expect(unsafeMutation.status()).toBe(403);
});

test('the mobile workspace fits at 360px and restart requires confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start guest game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send request', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Restart game', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('gateway validation and incorrect answers preserve unsolved state', async ({ context }) => {
  const anonymous = createTRPCClient<AppRouter>({ links: [httpLink({ url: `${baseURL}/api/trpc`, headers: { origin: baseURL } })] });
  await expect(anonymous.game.progress.query()).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } });
  const client = await api(context);
  const initial = await client.game.progress.query();
  const payload = { runId: initial.id, requestId: randomUUID(), input: { accessCode: '12' } };
  await expect(client.gateway.unlock.mutate(payload)).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } });
  expect((await client.game.history.query({ runId: initial.id })).items).toHaveLength(0);
  const incorrect = { ...payload, input: { accessCode: '0000' } };
  const first = await client.gateway.unlock.mutate(incorrect);
  expect(first.outcome).toBe('INCORRECT');
  expect(await client.gateway.unlock.mutate(incorrect)).toEqual(first);
  const progress = await client.game.progress.query();
  expect(progress.artifacts).toHaveLength(0);
  expect(progress.rooms.find(room => room.roomId === 'gateway')?.solvedAt).toBeNull();
  expect((await client.game.history.query({ runId: initial.id })).items).toHaveLength(1);
});

test('campaign enforces locks, scoped evidence, pagination, atomic power and stable completion', async ({ context, browser }) => {
  test.setTimeout(180_000);
  const client = await api(context);
  const { id: runId } = await client.game.progress.query();
  const meta = () => ({ runId, requestId: randomUUID() });
  await expect(client.identity.status.query({ runId })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  await expect(client.archive.search.query({ runId, tag: 'maintenance' })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  await expect(client.power.activate.mutate({ ...meta(), input: { switchId: 'cooling' } })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  await expect(client.control.restore.mutate({ ...meta(), input: { vaultSeal: 'fake', maintenanceKey: 'fake', powerChecksum: 'fake' } })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  const gateway = await client.gateway.unlock.mutate({ ...meta(), input: { accessCode: '1991' } });
  expect((await client.identity.status.query({ runId })).clearance).toBe('guest');
  expect((await client.identity.claim.mutate({ ...meta(), input: { credential: 'fake' } })).outcome).toBe('INCORRECT');
  const vault = await client.identity.claim.mutate({ ...meta(), input: { credential: gateway.data!.artifact } });
  expect((await client.identity.status.query({ runId })).clearance).toBe('archivist');
  const before = (await client.game.history.query({ runId })).items.length;
  await expect(client.archive.search.query({ runId, tag: 'BAD TAG' })).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } });
  const page1 = await client.archive.search.query({ runId, tag: 'maintenance' });
  expect(page1.records).toHaveLength(3);
  expect(page1.nextCursor).toBeTruthy();
  const page2 = await client.archive.search.query({ runId, tag: 'maintenance', cursor: page1.nextCursor! });
  expect(page2.records).toHaveLength(3);
  expect(page2.nextCursor).toBeNull();
  expect((await client.game.history.query({ runId })).items).toHaveLength(before);
  await expect(client.archive.search.query({ runId, tag: 'other-tag', cursor: page1.nextCursor! })).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } });
  expect((await client.archive.recover.mutate({ ...meta(), input: { recordId: page1.records[0].id } })).outcome).toBe('INCORRECT');
  const keyRecord = page2.records.find(r => r.title === 'Emergency maintenance key')!;
  const maintenance = await client.archive.recover.mutate({ ...meta(), input: { recordId: keyRecord.id } });
  expect((await client.power.activate.mutate({ ...meta(), input: { switchId: 'uplink' } })).outcome).toBe('INCORRECT');
  expect((await client.power.status.query({ runId })).activated).toEqual([]);
  const cooling = { ...meta(), input: { switchId: 'cooling' as const } };
  const [a, b] = await Promise.all([client.power.activate.mutate(cooling), client.power.activate.mutate(cooling)]);
  expect(a).toEqual(b);
  expect(a.outcome).toBe('PROGRESS');
  expect((await client.power.status.query({ runId })).activated).toEqual(['cooling']);
  await expect(client.power.activate.mutate({ ...cooling, input: { switchId: 'core' } })).rejects.toMatchObject({ data: { code: 'CONFLICT' } });
  expect((await client.power.activate.mutate({ ...meta(), input: { switchId: 'cooling' } })).outcome).toBe('ALREADY_APPLIED');
  // A later switch racing the next transition may be accepted only after its prefix.
  await Promise.all([
    client.power.activate.mutate({ ...meta(), input: { switchId: 'uplink' } }),
    client.power.activate.mutate({ ...meta(), input: { switchId: 'core' } }),
  ]);
  const power = await client.power.activate.mutate({ ...meta(), input: { switchId: 'uplink' } });
  expect((await client.power.status.query({ runId })).activated).toEqual(['cooling', 'core', 'uplink']);
  const input = { vaultSeal: vault.data!.artifact!, maintenanceKey: maintenance.data!.artifact!, powerChecksum: power.data!.artifact! };
  expect((await client.control.restore.mutate({ ...meta(), input: { ...input, vaultSeal: 'wrong' } })).outcome).toBe('INCORRECT');
  expect((await client.game.progress.query()).completedAt).toBeNull();
  const completion = { ...meta(), input };
  const restored = await client.control.restore.mutate(completion);
  expect(restored.outcome).toBe('SOLVED');
  expect(await client.control.restore.mutate(completion)).toEqual(restored);
  expect((await client.control.restore.mutate({ ...meta(), input })).data?.completedAt).toBe(restored.data?.completedAt);
  expect((await client.game.progress.query()).rooms.filter(r => r.solvedAt)).toHaveLength(5);
  const other = await browser.newContext();
  try {
    const stranger = await api(other);
    await expect(stranger.power.status.query({ runId })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
    const fresh = await stranger.game.progress.query();
    await stranger.gateway.unlock.mutate({ runId: fresh.id, requestId: randomUUID(), input: { accessCode: '1991' } });
    expect((await stranger.identity.claim.mutate({ runId: fresh.id, requestId: randomUUID(), input: { credential: gateway.data!.artifact } })).outcome).toBe('INCORRECT');
    await stranger.identity.claim.mutate({ runId: fresh.id, requestId: randomUUID(), input: { credential: (await stranger.game.progress.query()).artifacts[0].value } });
    await expect(stranger.archive.search.query({ runId: fresh.id, tag: 'maintenance', cursor: page1.nextCursor! })).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } });
    expect((await stranger.archive.recover.mutate({ runId: fresh.id, requestId: randomUUID(), input: { recordId: keyRecord.id } })).outcome).toBe('INCORRECT');
  } finally { await other.close(); }
  await client.game.restart.mutate({ runId });
  await expect(client.archive.search.query({ runId, tag: 'maintenance' })).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
});

test('a player can finish all five rooms through the visible contracts', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start guest game', exact: true }).click();
  const editor = page.getByLabel('JSON input', { exact: true });
  const send = page.getByRole('button', { name: 'Send request', exact: true });
  async function submit(input: object, outcome: string) {
    await expect(send).toBeEnabled();
    await editor.fill(JSON.stringify(input, null, 2));
    await send.click();
    await expect(page.getByTestId('response-json')).toContainText(`"outcome": "${outcome}"`);
    await expect(send).toBeEnabled();
  }
  async function artifact(label: string) {
    return page.locator('.artifact').filter({ has: page.getByText(label, { exact: true }) }).locator('code').innerText();
  }
  if (process.env.UI_SCREENSHOT_DIR) {
    await mkdir(process.env.UI_SCREENSHOT_DIR, { recursive: true });
    await expect(send).toBeEnabled();
    await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/gateway-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 360, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/gateway-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await submit({ accessCode: '1991' }, 'SOLVED');
  await page.getByRole('button', { name: 'Continue to Identity Vault', exact: true }).click();
  await page.getByLabel('Procedure', { exact: true }).selectOption('identity.claim');
  await submit({ credential: await artifact('Gateway receipt') }, 'SOLVED');
  await page.getByRole('button', { name: 'Continue to Broken Archive', exact: true }).click();
  await submit({ tag: 'maintenance' }, 'QUERY');
  const first = JSON.parse(await page.getByTestId('response-json').innerText());
  await submit({ tag: 'maintenance', cursor: first.data.nextCursor }, 'QUERY');
  if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/archive-desktop.png`, fullPage: true });
  const second = JSON.parse(await page.getByTestId('response-json').innerText());
  const record = second.data.records.find((r: { title: string }) => r.title === 'Emergency maintenance key');
  await page.getByLabel('Procedure', { exact: true }).selectOption('archive.recover');
  await submit({ recordId: record.id }, 'SOLVED');
  await page.getByRole('button', { name: 'Continue to Power Grid', exact: true }).click();
  await page.getByLabel('Procedure', { exact: true }).selectOption('power.activate');
  await submit({ switchId: 'cooling' }, 'PROGRESS');
  await submit({ switchId: 'core' }, 'PROGRESS');
  await submit({ switchId: 'uplink' }, 'SOLVED');
  await page.getByRole('button', { name: 'Continue to Control Room', exact: true }).click();
  await submit({ vaultSeal: await artifact('Vault seal'), maintenanceKey: await artifact('Maintenance key'), powerChecksum: await artifact('Power checksum') }, 'SOLVED');
  await expect(page.getByText('5 of 5 rooms solved', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You’re out.' })).toBeVisible();
  if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/completion-desktop.png`, fullPage: true });
  await page.reload();
  await expect(page.getByText('5 of 5 rooms solved', { exact: true })).toBeVisible();
});
