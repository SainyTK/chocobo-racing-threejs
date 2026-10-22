import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/** Served through the Studio's Vite server, which may read the whole repository. */
const source = (path: string) => `/@fs${fileURLToPath(new URL(`../${path}`, import.meta.url))}`;

test('racer heads hold still while the clock is paused and stay within their turn range while it runs', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#panes canvas');
  const results = await page.evaluate(async ({ characters, game, three }) => {
    const THREE = await import(three);
    const { createCharacter, loadCharacterModels } = await import(characters);
    const { RACERS } = await import(game);
    await loadCharacterModels();
    // Every Studio driving state and reaction: steering, menu look-around and the poses that nod or shake the head.
    const states: Record<string, (t: number) => object> = {
      menu: () => ({ menu: true }),
      drift: () => ({ speed: 28, steer: 1, drifting: true }),
      cast: t => ({ speed: 30, pose: { kind: 'cast', t: t % 1.2 } }),
      overtake: t => ({ speed: 30, pose: { kind: 'overtake', t: t % 1.4 } }),
      win: t => ({ pose: { kind: 'win', t: t % 6 } }),
      lose: t => ({ pose: { kind: 'lose', t: t % 4 } }),
    };
    const out: { racer: string; state: string; pausedDrift: number; widest: number }[] = [];
    const base = new THREE.Quaternion(), q = new THREE.Quaternion();
    RACERS.forEach((r: { name: string }, index: number) => {
      for (const [state, at] of Object.entries(states)) {
        const c = createCharacter(index), head = c.root.getObjectByName('head') ?? c.head;
        // The head's rotation relative to the model, composed from local rotations so the reactions' squash and stretch
        // of the model cannot leak in, as it would through a world matrix with non-uniform scale.
        const orientation = () => { q.identity(); for (let o = head; o && o !== c.model; o = o.parent) q.premultiply(o.quaternion); return q.normalize(); };
        const angle = () => 2 * Math.acos(Math.min(1, Math.abs(orientation().dot(base))));
        const step = (t: number, dt: number) => c.animate({ t, dt, speed: 0, steer: 0, drifting: false, flying: 0, stun: 0, boost: 0, menu: false, ...at(t) });
        step(0, 0); base.copy(orientation());
        let widest = 0;
        for (let f = 1; f <= 180; f++) { step(f / 60, 1 / 60); widest = Math.max(widest, angle()); }
        // Paused: the same time over and over, as when the Studio or a race is paused. Nothing may move.
        const held = orientation().clone();
        let pausedDrift = 0;
        for (let f = 0; f < 60; f++) { step(3, 0); pausedDrift = Math.max(pausedDrift, 2 * Math.acos(Math.min(1, Math.abs(orientation().dot(held))))); }
        c.dispose();
        out.push({ racer: r.name, state, pausedDrift, widest });
      }
    });
    return out;
  }, { characters: source('src/gfx/characters/index.ts'), game: source('shared/game/index.ts'), three: source('node_modules/three/build/three.module.js') });
  for (const r of results) {
    expect(r.pausedDrift, `${r.racer} ${r.state}: the head moved while paused`).toBeLessThan(.01);
    // The widest intended turn is Bahamut rearing back to cast, about 65 degrees: his Roar clip plus the shared nod.
    expect(r.widest, `${r.racer} ${r.state}: the head turned too far`).toBeLessThan(Math.PI * 75 / 180);
  }
});
