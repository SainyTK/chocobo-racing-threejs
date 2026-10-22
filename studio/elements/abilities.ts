import * as THREE from 'three';
import { MEGAFLARE, RACERS, makeRacer, stackPositions, type AbilityId, type Item, type Racer } from '../../shared/game/index.ts';
import { ABILITY_SECONDS } from '../../shared/game/abilities.ts';
import { BARRIER_SECONDS, HASTE_SECONDS } from '../../shared/game/spells.ts';
import { HANDLING } from '../../shared/game/handling.ts';
import { createCharacter, type Character, type Pose } from '../../src/gfx/characters/index.ts';
import { flapLift, type BoostKind } from '../../src/gfx/effects/abilities/index.ts';
import { chaseFraming } from '../../src/gfx/camera/framing.ts';
import { HELD_STONE } from '../../src/gfx/stones/looks.ts';
import { MugHelper } from '../../src/gfx/effects/abilities/mug-helper.ts';
import type { Instance, StudioContext, StudioElement } from '../types.ts';
import type { ViewState } from '../viewport.ts';

/** A scripted racer: the simulation fields the effects read, its model and where it stands. */
interface Actor { p: Racer; c: Character; at: THREE.Vector3; pose?: Pose }
/** Sets every actor's state for time `u` into the loop; `prev` is last frame's `u`, so one-off triggers fire once. */
type Script = (u: number, prev: number, actors: Actor[], ctx: StudioContext) => void;

const VIEWS = [{ id: 'chase', label: 'Chase camera' }, { id: 'side', label: 'From the side' }, { id: 'rival', label: 'Ahead of the player' }];
const index = (name: string) => RACERS.findIndex(r => r.name === name);
const crossed = (u: number, prev: number, at: number) => prev < at && u >= at;
const tint = new THREE.Color();

function actor(name: string, id: string, x: number, z: number): Actor {
  const character = index(name), c = createCharacter(character), p = makeRacer(id, name, character);
  p.px = x; p.pz = z;
  return { p, c, at: new THREE.Vector3(x, 0, z) };
}

/** Every actor's held stones in their line behind it, drawn as a race draws them. */
function drawHeld({ fx }: StudioContext, actors: Actor[], t: number) {
  fx.held.begin(t);
  for (const a of actors) stackPositions(a.p).forEach((at, i) => {
    const stack = a.p.stones[i], look = fx.abilities.heldLook(a.p.id, i), scale = a.c.root.scale.x;
    if (!look.hidden) fx.held.add(new THREE.Vector3(at.x, a.at.y + HELD_STONE.lift * scale, at.z), stack.kind, stack.level, scale, i * 2.1, look.blink);
  });
  fx.held.end();
}

/** Where the camera sits for a view of `a`. Dragging turns it round the racer from that starting angle. */
function aim(camera: THREE.PerspectiveCamera, view: ViewState, variant: string, a: Actor) {
  const f = chaseFraming(camera.aspect), turn = view.az - .6, focus = a.c.root.position;
  const [back, height, lookUp] = variant === 'side' ? [10, 2.2, 1.2] : variant === 'rival' ? [20, f.height, f.lookHeight] : [f.back, f.height, f.lookHeight];
  const yaw = (variant === 'side' ? Math.PI / 2 : 0) + turn, ahead = variant === 'side' ? 0 : f.lookAhead;
  camera.position.set(focus.x - Math.sin(yaw) * back, focus.y + height * view.zoom, focus.z - Math.cos(yaw) * back);
  camera.lookAt(focus.x + Math.sin(yaw) * ahead, focus.y + lookUp, focus.z + Math.cos(yaw) * ahead);
  // The race camera's field of view while boosting, so effects fill the frame as they do in a race.
  const fov = variant === 'side' ? 35 : 64; if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  return focus;
}

/** A looping scene of scripted racers using an ability, with the effects drawn exactly as in a race. */
function abilityScene(variant: string, ctx: StudioContext, actors: Actor[], period: number, script: Script, focus = 0): Instance {
  const group = new THREE.Group(), chars = new Map(actors.map(a => [a.p.id, a.c])), racers = actors.map(a => a.p);
  for (const a of actors) group.add(a.c.root);
  let prev = -1;
  return {
    object: group,
    camera: (camera, view) => aim(camera, view, variant, actors[focus]),
    update(t, dt) {
      const u = t % period; if (u < prev) { prev = -1; ctx.fx.abilities.reset(); }
      script(u, prev, actors, ctx); prev = u;
      for (const a of actors) {
        a.c.root.position.set(a.at.x, a.at.y + flapLift(a.p.flying), a.at.z);
        a.c.animate({ t, dt, speed: a.pose ? 6 : 30, steer: 0, drifting: false, flying: a.p.flying, stun: a.p.stun, boost: a.p.boost, menu: false, pose: a.pose });
        const k = ctx.fx.abilities.tint(a.p, tint); a.c.skin.flash.value = k; a.c.skin.flashColor.value.copy(tint);
      }
      group.updateMatrixWorld(true);
      ctx.fx.abilities.update(dt, ctx.camera, racers, chars); drawHeld(ctx, actors, t);
    },
    dispose() { for (const a of actors) a.c.dispose(); },
  };
}

/** Runs a boost of `seconds` from 0.3 s into each loop. */
function boostScript(kind: BoostKind, seconds: number, ability?: AbilityId): Script {
  return (u, prev, [a], { fx }) => {
    if (crossed(u, prev, .3)) { if (ability) fx.abilities.used(ability, a.p.id); else fx.abilities.boosted(a.p.id, kind); }
    a.p.boost = u >= .3 ? Math.max(0, .3 + seconds - u) : 0;
  };
}

function element(id: string, name: string, tags: string[], variants: { id: string; label: string }[], create: (variant: string, ctx: StudioContext) => Instance): StudioElement {
  return { id: `fx.ability.${id}`, name, category: 'Effects', tags: ['ability', ...tags], variants, view: { y: 1.5, distance: 10 }, create };
}

const boost = (id: string, name: string, racer: string, kind: BoostKind, seconds: number, tags: string[], ability?: AbilityId) =>
  element(id, name, ['boost', 'spikes', ...tags], VIEWS, (variant, ctx) => abilityScene(variant, ctx, [actor(racer, 'player', 0, 0)], seconds + 1.4, boostScript(kind, seconds, ability)));

/** Sets a racer's held line, as each loop starts. */
const hold = (a: Actor, ...stacks: [Item, number][]) => { a.p.stones = stacks.map(([kind, level]) => ({ kind, level })); };

export const abilities: StudioElement[] = [
  boost('dash', 'Dash', 'Chocobo', 'dash', ABILITY_SECONDS.dash, ['chocobo', 'cloud'], 'dash'),
  boost('haste', 'Haste Boost', 'Chubby Chocobo', 'haste', HASTE_SECONDS[0], ['haste', 'spell', 'stone']),
  boost('start-dash', 'Start Dash', 'Chocobo', 'start', HANDLING.startDash, ['start', 'spin dash']),
  boost('pad', 'Boost Pad', 'Golem', 'pad', HANDLING.boostPad, ['pad']),
  element('charge', 'Charge', ['behemoth', 'ram', 'boost', 'spikes'], [...VIEWS, { id: 'ram', label: 'Ramming a rival' }], (variant, ctx) => {
    const actors = [actor('Behemoth', 'player', 0, 0), ...variant === 'ram' ? [actor('Chocobo', 'victim', 2.6, 1.2)] : []], start = .3, hit = .65;
    return abilityScene(variant === 'ram' ? 'chase' : variant, ctx, actors, ABILITY_SECONDS.charge + 1.6, (u, prev, [b, victim], { fx }) => {
      if (crossed(u, prev, start)) fx.abilities.used('charge', b.p.id);
      b.p.charging = b.p.boost = u >= start ? Math.max(0, start + ABILITY_SECONDS.charge - u) : 0;
      if (!victim) return;
      if (crossed(u, prev, hit)) fx.abilities.ram(victim.at.clone().setY(1.5));
      victim.pose = u >= hit && u < hit + 1.6 ? { kind: 'hit', t: u - hit, tier: 1 } : undefined; victim.p.stun = victim.pose ? 1 : 0;
    });
  }),
  element('flap', 'Flap', ['mog', 'wings', 'fly'], VIEWS, (variant, ctx) => abilityScene(variant, ctx, [actor('Mog', 'player', 0, 0)], ABILITY_SECONDS.flap + 1.5, (u, _prev, [m]) => {
    m.p.flying = u >= .3 ? Math.max(0, .3 + ABILITY_SECONDS.flap - u) : 0;
  })),
  element('megaflare', 'Megaflare', ['bahamut', 'flare', 'crash'], [{ id: 'caster', label: 'Chase camera on Bahamut' }, { id: 'victim', label: 'Chase camera on a rival' }, { id: 'side', label: 'From the side' }], (variant, ctx) => {
    const actors = [actor('Bahamut', 'bahamut', 0, 24), actor('Behemoth', 'player', 0, 0), actor('Mog', 'rival-1', -4.5, 7), actor('Golem', 'rival-2', 4.5, 12)], start = .3, strike = start + ABILITY_SECONDS.megaflare;
    return abilityScene(variant === 'caster' ? 'chase' : variant, ctx, actors, 6, (u, prev, [bahamut, ...rivals], { fx }) => {
      bahamut.p.flare = u >= start ? Math.max(0, strike - u) : 0;
      for (const r of rivals) {
        if (crossed(u, prev, strike)) fx.spells.impact({ kind: 'megaflare', level: 3, tier: MEGAFLARE.tier }, r.at.clone().setY(1.5), r.p.id, variant === 'victim' && r.p.id === 'player');
        r.pose = u >= strike && u < strike + 2.4 ? { kind: 'hit', t: u - strike, tier: 3 } : undefined; r.p.stun = r.pose ? 1 : 0;
      }
    }, variant === 'caster' ? 0 : 1);
  }),
  element('grip', 'Grip-Up', ['golem', 'rings', 'traction'], VIEWS, (variant, ctx) => abilityScene(variant, ctx, [actor('Golem', 'player', 0, 0)], ABILITY_SECONDS.grip + 1.2, (u, prev, [g], { fx }) => {
    if (crossed(u, prev, .3)) fx.abilities.used('grip', g.p.id);
    g.p.gripUp = u >= .3 ? Math.max(0, .3 + ABILITY_SECONDS.grip - u) : 0;
  })),
  element('mug', 'Mug', ['goblin', 'steal', 'stone', 'helper'], [{ id: 'chase', label: 'Chase camera on Goblin' }, { id: 'victim', label: 'Chase camera on the victim' }, { id: 'side', label: 'From the side' }, { id: 'nobody', label: 'Nobody to rob' }, { id: 'helper', label: 'The helper running' }], (variant, ctx) => {
    if (variant === 'helper') {
      const h = new MugHelper(), dir = new THREE.Vector3(1, 0, 0);
      return { object: h.root, focus: { target: new THREE.Vector3(0, 1.1, 0), distance: 6 }, update(t) { h.place(h.root.position.set(0, 0, 0), dir, t, 0); }, dispose() { h.dispose(); } };
    }
    const actors = [actor('Goblin', 'player', 0, 0), ...variant === 'nobody' ? [] : [actor('Chocobo', 'victim', 3, 14)]];
    return abilityScene(variant === 'victim' || variant === 'nobody' ? 'chase' : variant, ctx, actors, 3.2, (u, prev, [thief, victim], { fx }) => {
      if (crossed(u, prev, 0)) { hold(thief, ['thunder', 1]); if (victim) hold(victim, ['fire', 1], ['haste', 1]); }
      if (!crossed(u, prev, .3)) return;
      const kind = victim ? victim.p.stones.pop()!.kind : 'ice' as Item;
      thief.p.stones.push({ kind, level: 1 });
      fx.abilities.used('mug', thief.p.id); fx.abilities.mugged(thief.p.id, victim?.p.id, kind, thief.p.stones.length - 1);
    }, variant === 'victim' ? 1 : 0);
  }),
  element('magic-plus', 'Magic Plus', ['black magician', 'level', 'stone', 'passive'], VIEWS, (variant, ctx) => abilityScene(variant, ctx, [actor('Black Magician', 'player', 0, 0)], 4, (u, prev, [m], { fx }) => {
    if (crossed(u, prev, 0)) hold(m, ['fire', 1]);
    if (!crossed(u, prev, .3)) return;
    m.p.stones[0].level = 2; fx.abilities.used('magic', m.p.id); fx.abilities.raised(m.p.id, 0);
  })),
  element('barrier', 'Barrier', ['white mage', 'shield', 'block', 'passive'], [...VIEWS, { id: 'block', label: 'Blocking Thunder' }], (variant, ctx) => {
    const block = 2.4;
    return abilityScene(variant === 'block' ? 'chase' : variant, ctx, [actor('White Mage', 'player', 0, 0)], BARRIER_SECONDS + 1.2, (u, prev, [w], { fx }) => {
      if (crossed(u, prev, .3)) fx.abilities.used('barrier', w.p.id);
      w.p.barrier = u >= .3 ? Math.max(0, .3 + BARRIER_SECONDS - u) : 0;
      if (variant !== 'block' || u < block) return;
      if (crossed(u, prev, block)) { fx.strike(w.at.clone().setY(1.5), 1, false); fx.abilities.blocked(w.p.id); }
      w.p.barrier = 0;
    });
  }),
  element('receive', 'Receive', ['chubby chocobo', 'catch', 'stone', 'passive'], VIEWS, (variant, ctx) => abilityScene(variant, ctx, [actor('Chubby Chocobo', 'player', 0, 0)], 3.4, (u, prev, [c], { fx }) => {
    if (crossed(u, prev, 0)) hold(c, ['fire', 1]);
    if (crossed(u, prev, .3)) fx.strike(c.at.clone().setY(1.5), 1, false);
    if (!crossed(u, prev, .35)) return;
    c.p.stones.push({ kind: 'thunder', level: 1 }); fx.abilities.received(c.p.id, 'thunder', 1, c.p.stones.length - 1);
  })),
];
