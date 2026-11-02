import { test, expect, type Browser, type Page } from '@playwright/test';
const debug = (page: Page) => page.evaluate(() => (window as any).__raceDebug);
/** `noWebRtc` removes RTCPeerConnection, as some privacy settings do, so the guest has to use the server relay. */
async function open(browser: Browser, path: string, { noWebRtc = false, phone = false } = {}) {
  const context = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
  await context.addInitScript(() => { localStorage.setItem('cbr-quality', 'retro'); localStorage.setItem('cbr-sound', 'false'); });
  if (noWebRtc) await context.addInitScript(() => { (window as any).RTCPeerConnection = function () { throw new Error('WebRTC disabled'); }; });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(path);
  return { context, page, errors };
}
const roster = (page: Page) => page.getByRole('list', { name: 'Racers in this room' });
/** What the signaling Worker says about a code. */
const roomInfo = async (code: string) => (await fetch(`${process.env.SIGNAL_URL}/rooms/${code}`)).json();

test('a room hosted on a player device races guests over direct WebRTC and the relay, and closes with its host', async ({ browser }) => {
  test.setTimeout(240000);
  const host = await open(browser, '/'), clients = [host];
  try {
    const a = host.page; await a.getByRole('button', { name: 'Online', exact: true }).click();
    await expect(a.getByText('keep this tab open while you play')).toBeVisible();
    await a.getByRole('textbox', { name: 'Your name' }).fill('Host'); await a.getByRole('button', { name: 'Create room', exact: true }).click();
    const code = await a.locator('#room-code').innerText(); expect(code).toMatch(/^[0-9A-F]{6}$/);
    await expect(a.getByText('HOSTED HERE')).toBeVisible(); expect((await debug(a)).network.route).toBe('host');
    // The signaling Worker knows the code; the room itself runs in the host's page.
    expect((await roomInfo(code)).ok).toBe(true);

    const direct = await open(browser, `/?room=${code}`, { phone: true }); clients.push(direct); const b = direct.page;
    await expect(b.locator('#room-code')).toHaveText(code, { timeout: 30000 }); await expect(b.getByText('DIRECT P2P')).toBeVisible();
    await b.getByRole('button', { name: 'Choose Behemoth', exact: true }).tap();
    await expect(roster(a)).toContainText('Behemoth');

    const relayed = await open(browser, '/', { noWebRtc: true }); clients.push(relayed); const c = relayed.page;
    await c.getByRole('button', { name: 'Online', exact: true }).click(); await c.getByRole('textbox', { name: 'Your name' }).fill('Relay');
    await c.getByRole('textbox', { name: 'Room code' }).fill(code); await c.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(c.locator('#room-code')).toHaveText(code, { timeout: 30000 }); await expect(c.getByText('P2P VIA RELAY')).toBeVisible();
    await expect(roster(a)).toContainText('Relay'); await expect(roster(b)).toContainText('Relay');
    await expect(c.getByRole('button', { name: 'START ONLINE RACE' })).toHaveCount(0);

    // A guest who reloads gets the same place back from the host.
    const before = (await debug(b)).playerId; await b.reload();
    await expect(b.locator('#room-code')).toHaveText(code, { timeout: 30000 }); expect((await debug(b)).playerId).toBe(before);
    await expect(roster(a).locator('li:not(.open)')).toHaveCount(3);

    await a.getByRole('button', { name: 'START ONLINE RACE' }).click();
    for (const p of [a, b, c]) await expect(p.locator('#place')).toBeVisible({ timeout: 20000 });
    for (const [p, word] of [[a, 'HOST'], [b, 'P2P'], [c, 'RELAY']] as const) await expect(p.locator('#ping')).toContainText(word);
    const humans = (await debug(a)).race.racers.filter((p: any) => !p.bot).map((p: any) => p.name).sort();
    expect(humans).toEqual(['Host', 'Racer', 'Relay']);

    await expect.poll(async () => (await debug(a)).race.phase, { timeout: 15000 }).toBe('racing');
    // Both guests drive and the host's authoritative race moves them, so their input reaches the host.
    const hold = (page: Page, type: 'keydown' | 'keyup') => page.evaluate(t => document.body.dispatchEvent(new KeyboardEvent(t, { code: 'KeyW', bubbles: true })), type);
    const onHost = async (guest: Page) => { const id = (await debug(guest)).playerId; return (await debug(a)).race.racers.find((p: any) => p.id === id).s as number; };
    const startB = await onHost(b), startC = await onHost(c);
    await hold(b, 'keydown'); await hold(c, 'keydown');
    await expect.poll(() => onHost(b), { timeout: 10000 }).toBeGreaterThan(startB + 5);
    await expect.poll(() => onHost(c), { timeout: 10000 }).toBeGreaterThan(startC + 5);
    await hold(b, 'keyup'); await hold(c, 'keyup');

    // When the host leaves, the room ends for everyone with a clear message.
    await a.getByRole('button', { name: 'Pause menu' }).click(); await a.locator('[data-action="exit"]').click(); await a.locator('[data-action="leave"]').click();
    for (const p of [b, c]) await expect(p.getByRole('alert')).toContainText(`The host closed room ${code}`, { timeout: 15000 });
    await expect.poll(async () => (await roomInfo(code)).error).toMatch(/has closed/);
    for (const client of clients) expect(client.errors).toEqual([]);
  } finally { for (const client of clients) await client.context.close(); }
});

test('guests learn the room is gone when the host tab closes without a goodbye', async ({ browser }) => {
  test.setTimeout(180000);
  const host = await open(browser, '/'), clients = [host];
  try {
    const a = host.page; await a.getByRole('button', { name: 'Online', exact: true }).click();
    await a.getByRole('button', { name: 'Create room', exact: true }).click();
    const code = await a.locator('#room-code').innerText();
    const direct = await open(browser, `/?room=${code}`), relayed = await open(browser, `/?room=${code}`, { noWebRtc: true }); clients.push(direct, relayed);
    for (const guest of [direct, relayed]) await expect(guest.page.locator('#room-code')).toHaveText(code, { timeout: 30000 });
    await host.context.close(); clients.shift();
    // The signaling Worker holds the code for a returning host, so each guest keeps retrying for a while before giving up.
    for (const guest of [direct, relayed]) await expect(guest.page.getByRole('alert')).toContainText(/Lost the connection to the host|has closed/, { timeout: 90000 });
    for (const client of clients) expect(client.errors).toEqual([]);
  } finally { for (const client of clients) await client.context.close(); }
});
