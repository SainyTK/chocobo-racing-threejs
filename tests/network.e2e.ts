import { test, expect } from '@playwright/test';
const debug = (p: any) => p.evaluate(() => (window as any).__raceDebug);
test('impaired two-human six-racer driving, one-shot recovery and reload', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [a,b] = await Promise.all(contexts.map(c=>c.newPage())); const errors: string[]=[];
  try {
    for (const c of contexts) await c.addInitScript(() => { localStorage.setItem('cbr-quality','retro'); localStorage.setItem('cbr-sound','false'); });
    for (const p of [a,b]) { p.on('pageerror',e=>errors.push(e.message)); await p.goto('/?netPerf&netDelay=80&netJitter=30&netDrop=0.1'); await p.getByRole('button',{name:'Online',exact:true}).click(); }
    await a.getByRole('button',{name:'CREATE ROOM',exact:true}).click(); const code=await a.locator('#room-code').innerText();
    await b.getByRole('textbox',{name:'Room code'}).fill(code); await b.getByRole('button',{name:'Join room'}).click(); await expect(b.locator('#room-code')).toHaveText(code);
    await a.getByRole('button',{name:'START ONLINE RACE'}).click(); await expect(b.locator('#place')).toBeVisible();
    await expect.poll(async()=>(await debug(a)).race.phase).toBe('racing');
    for(const p of [a,b]) await p.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true})));
    await expect.poll(async()=>{const d=await debug(a);return d.race.racers.find((p:any)=>p.id===d.playerId).speed;}).toBeGreaterThan(1);
    const d=await debug(a); expect(d.network.transport).toBe('websocket'); expect(d.race.racers).toHaveLength(6); expect(d.race.racers.filter((p:any)=>!p.bot)).toHaveLength(2);
    await a.evaluate(()=> { document.body.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true})); document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyR',bubbles:true})); });
    await expect.poll(async()=>{const d=await debug(a);return d.race.racers.find((p:any)=>p.id===d.playerId).lastRescue;}).toBeGreaterThan(0);
    const at=(await debug(a)).race.racers.find((p:any)=>p.id===d.playerId).lastRescue;
    await a.waitForTimeout(4200); expect((await debug(a)).race.racers.find((p:any)=>p.id===d.playerId).lastRescue).toBe(at);
    await a.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyR',bubbles:true})));
    const before=await debug(b); await b.reload(); await expect(b.locator('#place')).toBeVisible(); expect((await debug(b)).playerId).toBe(before.playerId); expect((await debug(b)).race.id).toBe(before.race.id);
    await contexts[0].setOffline(true); await a.evaluate(()=>(window as any).__dropNetwork()); await expect.poll(async()=>(await debug(a)).connected).toBe(false); await contexts[0].setOffline(false); await expect.poll(async()=>(await debug(a)).connected).toBe(true);
    expect((await debug(a)).network.samples.correctionMeters.length).toBeGreaterThan(0); expect(errors).toEqual([]);
    for(const p of [a,b]) { await p.getByRole('button',{name:'Pause menu'}).click(); await p.getByRole('button',{name:'Exit race',exact:true}).click(); await p.getByRole('button',{name:'Exit race',exact:true}).click(); }
  } finally { await Promise.all(contexts.map(c=>c.close())); }
});
