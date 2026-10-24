import { test, expect, type Browser, type Page } from '@playwright/test';
const debug = (page: Page) => page.evaluate(() => (window as any).__raceDebug);
/**
 * `stall` holds every game-server message for that many milliseconds after the page opens, so the first connection
 * attempts time out and Socket.IO has to retry; `cpu` slows the page like a cheap phone.
 */
async function open(browser: Browser, path: string, { phone = false, stall = 0, cpu = 1 } = {}) {
  const context = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
  await context.addInitScript(() => { localStorage.setItem('cbr-quality', 'retro'); localStorage.setItem('cbr-sound', 'false'); });
  const until = Date.now() + stall; let attempts = 0;
  await context.routeWebSocket(/\/socket\.io\//, ws => {
    attempts++; const server = ws.connectToServer(), held: (string | Buffer)[] = [];
    server.onMessage(message => {
      if (Date.now() >= until && !held.length) { ws.send(message); return; }
      if (!held.length) setTimeout(() => { for (const m of held.splice(0)) ws.send(m); }, Math.max(0, until - Date.now()));
      held.push(message);
    });
  });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(path);
  return { context, page, errors, attempts: () => attempts, fullSpeed: () => cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }) };
}
const roster = (page: Page) => page.getByRole('list', { name: 'Racers in this room' });

test('invite links and codes open the room, where every member picks a racer that the others see live', async ({ browser }) => {
  test.setTimeout(300000);
  const host = await open(browser, '/'), clients = [host];
  try {
    const a = host.page; await a.getByRole('button', { name: 'Online', exact: true }).click();
    // Creating and joining are separate choices of the same size.
    const create = (await a.getByRole('button', { name: 'Create room', exact: true }).boundingBox())!, join = (await a.getByRole('button', { name: 'Join room', exact: true }).boundingBox())!;
    expect([create.width, create.height]).toEqual([join.width, join.height]); await expect(a.getByRole('button', { name: 'Choose Mog' })).toHaveCount(0);
    await a.getByRole('textbox', { name: 'Your name' }).fill('Host'); await a.getByRole('button', { name: 'Create room', exact: true }).click();
    const code = await a.locator('#room-code').innerText(); expect(new URL(a.url()).searchParams.get('room')).toBe(code);

    // A slow phone whose first connection attempts fail waits in a connecting state and still lands in the room.
    const invited = await open(browser, `/?room=${code}`, { phone: true, stall: 10000, cpu: 4 }); clients.push(invited); const b = invited.page;
    await expect(b.getByRole('status').filter({ hasText: `Connecting to room ${code}` })).toBeVisible();
    await expect(b.locator('#room-code')).toHaveText(code, { timeout: 30000 }); expect(invited.attempts()).toBeGreaterThan(1); await invited.fullSpeed(); await expect(roster(a)).toContainText('Racer');
    await b.getByRole('textbox', { name: 'Your name' }).fill('Phone'); await b.getByRole('textbox', { name: 'Your name' }).press('Enter');
    await b.getByRole('button', { name: 'Choose Behemoth', exact: true }).tap(); await b.getByRole('radio', { name: 'Flap', exact: true }).tap();
    await expect(roster(a)).toContainText('Phone'); await expect(roster(a)).toContainText('Behemoth · Flap');

    const typed = await open(browser, '/'), c = typed.page; clients.push(typed);
    await c.getByRole('button', { name: 'Online', exact: true }).click(); await c.getByRole('textbox', { name: 'Room code' }).fill(code.toLowerCase()); await c.getByRole('textbox', { name: 'Room code' }).press('Enter');
    await expect(c.locator('#room-code')).toHaveText(code); await c.getByRole('button', { name: 'Choose Goblin', exact: true }).click();
    // Arrow keys move through the ability picker; the roster update from each step keeps focus in place.
    await c.getByRole('radio', { name: 'Charge', exact: true }).click(); await c.keyboard.press('ArrowLeft');
    await expect(roster(b)).toContainText('Goblin · Receive'); await expect(c.getByRole('radio', { name: 'Receive (auto)', exact: true })).toBeFocused(); await expect(c.getByRole('button', { name: 'START ONLINE RACE' })).toHaveCount(0);

    // Going home keeps the place; the same code brings the player back without a second roster entry.
    await b.getByRole('button', { name: 'Back to home' }).tap(); await expect(b.getByRole('textbox', { name: 'Room code' })).toHaveValue(code);
    await expect(roster(a).locator('li', { hasText: 'Phone' })).toContainText('Away');
    await b.getByRole('button', { name: 'Join room', exact: true }).tap(); await expect(b.locator('#room-code')).toHaveText(code);
    await expect(roster(a).locator('li', { hasText: 'Phone' })).toContainText('Ready'); await expect(roster(a).locator('li:not(.open)')).toHaveCount(3);
    expect((await debug(b)).settings).toMatchObject({ character: 7, abilityId: 'flap' });

    await a.getByRole('button', { name: 'START ONLINE RACE' }).click();
    for (const p of [a, b, c]) await expect(p.locator('#place')).toBeVisible();
    const racers = (await debug(a)).race.racers.filter((p: any) => !p.bot);
    expect(racers.map((p: any) => [p.name, p.character, p.abilityId])).toEqual([['Host', 0, 'dash'], ['Phone', 7, 'flap'], ['Racer', 3, 'receive']]);

    // Problems with a code show on the home page, in the join card, even after a slow first connection while three races run.
    const late = await open(browser, `/?room=${code}`, { stall: 8000 }); clients.push(late);
    await expect(late.page.getByRole('alert')).toContainText('already racing', { timeout: 30000 }); await expect(late.page.getByRole('textbox', { name: 'Room code' })).toHaveValue(code);
    await late.page.goto('/?room=ZZ9'); await expect(late.page.getByRole('alert')).toContainText('is not a room code');
    await late.page.getByRole('textbox', { name: 'Room code' }).fill('ABC123'); await late.page.getByRole('button', { name: 'Join room', exact: true }).click(); await expect(late.page.getByRole('alert')).toContainText('was not found');
    for (const client of clients) expect(client.errors).toEqual([]);
  } finally { for (const client of clients) await client.context.close(); }
});
