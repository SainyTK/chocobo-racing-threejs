import * as THREE from 'three';
import { RACERS, type Race, type Racer } from '../../../shared/game/index.ts';
import { pointAt } from '../../../shared/track/index.ts';
import { angleDelta, clamp } from '../../../shared/math.ts';

const HEIGHT = 4.2, BACK = 8, BOOST_PULL = 1.5, LOOK_AHEAD = 8, LOOK_HEIGHT = 1.6;
const FOV_REST = 56, FOV_TOP = 64, FOV_BOOST = 72;

/** Low chase camera behind the player. It follows a smoothed heading that leans toward the travel direction while the
 * racer slides (drift, wall bounce, spin), pulls back briefly when a boost starts, widens its field of view with speed
 * and jolts lightly on wall hits. `speed` is the 0 to 1 speed feel the speed lines read. */
export class ChaseCamera {
  speed = 0;
  private heading = 0; private ready = false; private pull = 0; private boosted = false; private jolt = 0; private lastEvent = 0;
  private readonly at = new THREE.Vector3(); private readonly look = new THREE.Vector3();
  reset() { this.ready = false; }
  update(camera: THREE.PerspectiveCamera, race: Race, p: Racer, dt: number, lookBack: boolean) {
    const travel = Math.atan2(p.vx, p.vz), slip = p.speed > 4 ? angleDelta(travel, p.yaw) : 0;
    const lean = p.drifting || p.stun > 0 ? .55 : clamp(Math.abs(slip) / .5, 0, 1) * .5, aim = p.yaw + slip * lean;
    if (!this.ready) { this.heading = aim; this.lastEvent = race.eventId; }
    this.heading += angleDelta(aim, this.heading) * (1 - Math.exp(-dt * 5));
    if (p.boost > 0 && !this.boosted) this.pull = 1;
    this.boosted = p.boost > 0; this.pull = Math.max(0, this.pull - dt * 1.6);
    for (const e of race.events) if (e.id > this.lastEvent && e.type === 'wall' && e.player === p.id) this.jolt = .35;
    this.lastEvent = race.eventId; this.jolt *= Math.exp(-dt * 7);
    const a = this.heading + (lookBack ? Math.PI : 0), back = BACK + BOOST_PULL * Math.sin(this.pull * Math.PI / 2), floor = pointAt(race.track, p.s).y;
    const height = Math.max(floor, pointAt(race.track, p.s - back).y) + HEIGHT + (p.flying > 0 ? 2 : 0);
    this.at.set(p.px - Math.sin(a) * back, height, p.pz - Math.cos(a) * back);
    if (!this.ready || this.at.distanceTo(camera.position) > 55) camera.position.copy(this.at); else camera.position.lerp(this.at, 1 - Math.exp(-dt * 9));
    if (this.jolt > .01) camera.position.add(this.look.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(this.jolt));
    this.look.set(p.px + Math.sin(a) * LOOK_AHEAD, floor + LOOK_HEIGHT, p.pz + Math.cos(a) * LOOK_AHEAD); camera.lookAt(this.look);
    const top = RACERS[p.character].speed * p.pace, fraction = clamp(Math.abs(p.speed) / top, 0, 1);
    const fov = p.boost > 0 && p.stun <= 0 ? FOV_BOOST : FOV_REST + (FOV_TOP - FOV_REST) * fraction;
    if (!this.ready) camera.fov = fov; else camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 4));
    camera.updateProjectionMatrix();
    this.speed = p.boost > 0 && p.stun <= 0 ? 1 : clamp((fraction - .85) / .15, 0, 1) * .6;
    this.ready = true;
    return this.look;
  }
}
