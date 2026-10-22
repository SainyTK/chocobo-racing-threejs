import { RACERS, type GameEvent, type Race, type Racer } from '../shared/game/index.ts';
import type { AudioEngine } from './audio.ts';
import { castInfo, crashInfo } from './race-events.ts';
import { SOUNDS, castSound, impactSound, reflectSound } from './sfx/sounds.ts';
import { bark, type Mood } from './sfx/voices.ts';
import type { Sound } from './sfx/types.ts';

/** Rivals further than this are out of earshot. */
const HEARING = 90;
/** A racer barks at most this often, in seconds of race time. */
const BARK_GAP = 1.6;
/** Rival engines further than this are drowned out by the player's own. */
const ENGINE_HEARING = 30;

/**
 * Turns race events into sound: the player's engine and skid, countdown beeps, spells and hits around the player,
 * and character barks. The player's own events play at full volume; rivals' are quieter and panned by where they are.
 */
export class RaceAudio {
  private raceId = ''; private eventId = 0; private count = ''; private rank = 0; private barked = new Map<string, number>();
  constructor(private audio: AudioEngine) {}
  update(race: Race | null, playerId: string, paused: boolean) {
    const me = race?.racers.find(p => p.id === playerId);
    if (!race || !me) { this.audio.drive(null); this.audio.drive(null, 'rival'); return; }
    if (race.id !== this.raceId) { this.raceId = race.id; this.eventId = race.eventId; this.count = ''; this.rank = me.rank; this.barked.clear(); }
    const moving = !paused && me.finishTime === null && me.falling <= 0;
    this.audio.drive(moving ? { character: me.character, speed: Math.abs(me.speed) / RACERS[me.character].speed, boost: me.boost > 0, skid: me.drifting || me.stun > 0 && Math.abs(me.speed) > 4 } : null);
    this.audio.drive(paused ? null : this.nearestRival(race, me), 'rival');
    if (paused) return;
    this.countdown(race);
    for (const e of race.events) if (e.id > this.eventId) this.onEvent(e, race, me);
    this.eventId = race.eventId;
    if (race.time > 3 && me.finishTime === null && me.rank < this.rank) this.say(me, 'overtake', race.time, 1);
    this.rank = me.rank;
  }
  private countdown(race: Race) {
    const count = race.time < -3 ? '' : race.time < 0 ? String(Math.ceil(-race.time)) : race.time < .8 ? 'GO' : '';
    if (count !== this.count && count) this.audio.play(count === 'GO' ? SOUNDS.go : SOUNDS.countdown);
    this.count = count;
  }
  private onEvent(e: GameEvent, race: Race, me: Racer) {
    const p = race.racers.find(q => q.id === e.player); if (!p) return;
    const target = race.racers.find(q => q.id === e.target), mine = p === me || target === me;
    const [gain, pan] = this.placement(p, me), play = (s: Sound, g = gain) => this.audio.play(s, mine ? 1 : g, p === me ? 0 : pan);
    const cast = castInfo(e);
    if (cast) { play(castSound(cast.kind, cast.level)); this.say(p, 'cast', race.time, gain); return; }
    switch (e.type) {
      case 'crash': { const info = crashInfo(e); play(impactSound(info.kind === 'squash' || info.kind === 'drift' ? 'charge' : info.kind, info.tier)); this.say(p, 'hit', race.time, gain); return; }
      case 'mini': if (target) this.audio.play(impactSound('mini', 1), target === me ? 1 : this.placement(target, me)[0]); return;
      case 'reflect': case 'block': play(reflectSound(e.type === 'block')); return;
      case 'bump': play(SOUNDS.bump, gain * .8); return;
      case 'wall': play(SOUNDS.wall); return;
      case 'pickup': if (p === me) play(SOUNDS.pickup); return;
      case 'steal': case 'receive': play(SOUNDS.steal); return;
      case 'doom-pass': play(SOUNDS.doomPass); return;
      case 'pad': case 'start': case 'spindash': play(SOUNDS.boost); return;
      case 'ability': play(p.abilityId === 'barrier' ? castSound('shield', 1) : p.abilityId === 'flap' ? SOUNDS.flap : p.abilityId === 'grip' ? SOUNDS.grip : p.abilityId === 'mug' ? SOUNDS.steal : p.abilityId === 'megaflare' ? SOUNDS.megaflare : p.abilityId === 'braver' ? SOUNDS.slash : SOUNDS.boost); return;
      case 'fall': play(SOUNDS.fall); return;
      case 'recover': if (p === me) play(SOUNDS.recover); return;
      case 'lap': if (p === me) play(SOUNDS.lap); return;
      case 'finish': if (p === me) { play(p.rank === 1 ? SOUNDS.fanfare : SOUNDS.finish); this.say(p, p.rank <= 3 ? 'win' : 'select', race.time, 1, true); } return;
    }
  }
  /** The engine of the closest rival within earshot, so passing racers can be heard. */
  private nearestRival(race: Race, me: Racer) {
    const rival = race.racers.filter(p => p !== me && p.finishTime === null).sort((a, b) => Math.hypot(a.px - me.px, a.pz - me.pz) - Math.hypot(b.px - me.px, b.pz - me.pz))[0];
    if (!rival || Math.hypot(rival.px - me.px, rival.pz - me.pz) > ENGINE_HEARING) return null;
    const [gain, pan] = this.placement(rival, me);
    return { character: rival.character, speed: Math.abs(rival.speed) / RACERS[rival.character].speed, boost: rival.boost > 0, skid: rival.drifting, gain: gain * 1.2, pan };
  }
  /** Volume and stereo position of a sound made by `p`, heard from the player's racer. */
  private placement(p: Racer, me: Racer): [number, number] {
    if (p === me) return [1, 0];
    const dx = p.px - me.px, dz = p.pz - me.pz, d = Math.hypot(dx, dz), left = (dx * Math.cos(me.yaw) - dz * Math.sin(me.yaw)) / Math.max(1, d);
    return [Math.max(0, 1 - d / HEARING) ** 2 * .75, -left * .7];
  }
  private say(p: Racer, mood: Mood, time: number, gain: number, force = false) {
    if (!force && time - (this.barked.get(p.id) ?? -9) < BARK_GAP) return;
    this.barked.set(p.id, time); this.audio.play(bark(p.character, mood), gain);
  }
}
