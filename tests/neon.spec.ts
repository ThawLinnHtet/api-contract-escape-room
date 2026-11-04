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
  await expect(page.getByRole('alert')).toContainText('not valid JSON');
  await expect(input).toHaveValue('{');
  await input.fill('{ "accessCode": "12" }');
  await send.click();
  await expect(page.getByRole('alert')).toContainText('exactly four digits');
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
