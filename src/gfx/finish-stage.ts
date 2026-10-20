import * as THREE from 'three';
import type { Race } from '../../shared/game/index.ts';
import type { Character } from './characters/index.ts';
import type { Effects } from './effects/index.ts';
import { FinishCamera } from './camera/finish.ts';
import { Podium } from './podium.ts';

/** What the finish sequence is showing: the orbit round the player, or the podium with the top racers by id. */
export type FinishView = { phase: 'orbit'; t: number } | { phase: 'podium'; t: number; ids: string[] };

/**
 * Stages the finish in the race scene: takes over the camera for the orbit, then builds the podium past the finish line,
 * stands the top three on it in their winning poses and hides everyone else.
 */
export class FinishStage {
  private cam = new FinishCamera(); private podium: Podium | null = null; private cheered = false; private center = new THREE.Vector3();
  constructor(private scene: THREE.Scene, private fx: Effects) {}
  /** Repositions racers for the podium shot. Racers left out of `chars` get no trails or held stones this frame. */
  stageRacers(view: FinishView, race: Race, characters: Map<string, Character>, chars: Map<string, Character>) {
    if (view.phase !== 'podium') return;
    const podium = this.build(race);
    for (const [id, c] of characters) {
      const place = view.ids.indexOf(id); c.root.visible = place >= 0; chars.delete(id);
      if (place < 0) continue;
      c.root.position.copy(podium.spots[place]); c.root.rotation.y = podium.facing; c.root.scale.setScalar(1);
      c.animate({ t: view.t + place, dt: 0, speed: 0, steer: 0, drifting: false, flying: 0, stun: 0, boost: 0, menu: false, pose: { kind: 'win', t: view.t + place * .3 } });
    }
    if (!this.cheered) { this.cheered = true; podium.spots.slice(0, view.ids.length).forEach(s => this.fx.confetti(s)); }
  }
  /** Points the camera for the current shot and returns the point shadows should centre on. */
  aim(view: FinishView, camera: THREE.PerspectiveCamera, focus: Character, focusYaw: number): THREE.Vector3 {
    if (view.phase === 'orbit') { this.cam.orbit(camera, focus.root.position, focusYaw, view.t); return focus.root.position; }
    const podium = this.podium!; this.center.copy(podium.root.position); this.cam.podium(camera, this.center, podium.facing, view.t); return this.center;
  }
  /** Removes the podium and forgets the shot, ready for the next race. */
  clear() { if (this.podium) { this.scene.remove(this.podium.root); this.podium.dispose(); this.podium = null; } this.cheered = false; this.cam.reset(); }
  private build(race: Race) {
    if (!this.podium) { this.podium = new Podium(race.track); this.scene.add(this.podium.root); }
    return this.podium;
  }
}
