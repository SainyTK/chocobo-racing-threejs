import { test, expect, type Browser, type Page } from '@playwright/test';
const debug = (page: Page) => page.evaluate(() => (window as any).__raceDebug);
async function open(browser: Browser, path: string, phone = false) {
  const context = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
  await context.addInitScript(() => { localStorage.setItem('cbr-quality', 'retro'); localStorage.setItem('cbr-sound', 'false'); });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.goto(path);
  return { context, page, errors };
}
const roster = (page: Page) => page.getByRole('list', { name: 'Racers in this room' });

test('invite links and codes open the room, where every member picks a racer that the others see live', async ({ browser }) => {
  test.setTimeout(180000);
  const host = await open(browser, '/'), clients = [host];
  try {
    const a = host.page; await a.getByRole('button', { name: 'Online', exact: true }).click();
    // Creating and joining are separate choices of the same size.
    const create = (await a.getByRole('button', { name: 'Create room', exact: true }).boundingBox())!, join = (await a.getByRole('button', { name: 'Join room', exact: true }).boundingBox())!;
    expect([create.width, create.height]).toEqual([join.width, join.height]); await expect(a.getByRole('button', { name: 'Choose Mog' })).toHaveCount(0);
    await a.getByRole('textbox', { name: 'Your name' }).fill('Host'); await a.getByRole('button', { name: 'Create room', exact: true }).click();
    const code = await a.locator('#room-code').innerText(); expect(new URL(a.url()).searchParams.get('room')).toBe(code);

    const invited = await open(browser, `/?room=${code}`, true); clients.push(invited); const b = invited.page;
    await expect(b.locator('#room-code')).toHaveText(code); await expect(roster(a)).toContainText('Racer');
    await b.getByRole('textbox', { name: 'Your name' }).fill('Phone'); await b.getByRole('textbox', { name: 'Your name' }).press('Enter');
    await b.getByRole('button', { name: 'Choose Behemoth', exact: true }).tap(); await b.getByRole('combobox', { name: 'Ability', exact: true }).selectOption('flap');
    await expect(roster(a)).toContainText('Phone'); await expect(roster(a)).toContainText('Behemoth · Flap');

    const typed = await open(browser, '/'), c = typed.page; clients.push(typed);
    await c.getByRole('button', { name: 'Online', exact: true }).click(); await c.getByRole('textbox', { name: 'Room code' }).fill(code.toLowerCase()); await c.getByRole('textbox', { name: 'Room code' }).press('Enter');
    await expect(c.locator('#room-code')).toHaveText(code); await c.getByRole('button', { name: 'Choose Goblin', exact: true }).click();
    await expect(roster(b)).toContainText('Goblin'); await expect(c.getByRole('button', { name: 'START ONLINE RACE' })).toHaveCount(0);

    // Going home keeps the place; the same code brings the player back without a second roster entry.
    await b.getByRole('button', { name: 'Back to home' }).tap(); await expect(b.getByRole('textbox', { name: 'Room code' })).toHaveValue(code);
    await expect(roster(a).locator('li', { hasText: 'Phone' })).toContainText('Away');
    await b.getByRole('button', { name: 'Join room', exact: true }).tap(); await expect(b.locator('#room-code')).toHaveText(code);
    await expect(roster(a).locator('li', { hasText: 'Phone' })).toContainText('Ready'); await expect(roster(a).locator('li:not(.open)')).toHaveCount(3);
    expect((await debug(b)).settings).toMatchObject({ character: 7, abilityId: 'flap' });

    await a.getByRole('button', { name: 'START ONLINE RACE' }).click();
    for (const p of [a, b, c]) await expect(p.locator('#place')).toBeVisible();
    const racers = (await debug(a)).race.racers.filter((p: any) => !p.bot);
    expect(racers.map((p: any) => [p.name, p.character, p.abilityId])).toEqual([['Host', 0, 'dash'], ['Phone', 7, 'flap'], ['Racer', 3, 'mug']]);

    // Problems with a code show on the home page, in the join card. Three headless WebGL races would starve a fourth page of CPU, so two players drop out first.
    for (const client of [invited, typed]) { expect(client.errors).toEqual([]); await client.context.close(); }
    const late = await open(browser, `/?room=${code}`); clients.push(late);
    await expect(late.page.getByRole('alert')).toContainText('already racing'); await expect(late.page.getByRole('textbox', { name: 'Room code' })).toHaveValue(code);
    await late.page.goto('/?room=ZZ9'); await expect(late.page.getByRole('alert')).toContainText('is not a room code');
    await late.page.getByRole('textbox', { name: 'Room code' }).fill('ABC123'); await late.page.getByRole('button', { name: 'Join room', exact: true }).click(); await expect(late.page.getByRole('alert')).toContainText('was not found');
    expect([...host.errors, ...late.errors]).toEqual([]);
  } finally { for (const client of clients) await client.context.close(); }
});
