import type * as THREE from 'three';

/**
 * A reaction the racer is acting out, `t` seconds after it started.
 * Hits play by crash tier: 1 spins out, 2 is flattened, 3 tumbles through the air.
 */
export type Pose =
  | { kind: 'hit'; t: number; tier: 1 | 2 | 3 }
  | { kind: 'cast' | 'overtake' | 'win' | 'lose'; t: number };

/** Seconds each one-shot reaction lasts. `win` and `lose` loop until the race view ends. */
export const POSE_SECONDS = { cast: .55, overtake: .8, hit: 1.2 } as const;

const TAU = Math.PI * 2, ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

/** How a pose moves the model, layered over driving animation. Spins for tier-1 hits come from the stun spin itself. */
export function applyPose(model: THREE.Object3D, head: THREE.Object3D, pose: Pose) {
  const t = pose.t;
  switch (pose.kind) {
    case 'cast': { const k = Math.sin(Math.min(1, t / POSE_SECONDS.cast) * Math.PI); model.rotation.x -= k * .35; model.position.y += k * .3; head.rotation.x -= k * .4; return; }
    case 'overtake': { const k = Math.sin(Math.min(1, t / POSE_SECONDS.overtake) * Math.PI); model.position.y += Math.abs(Math.sin(t * 9)) * .35 * k; model.rotation.z += Math.sin(t * 14) * .12 * k; head.rotation.y += Math.sin(t * 7) * .5 * k; return; }
    case 'win': { const hop = Math.abs(Math.sin(t * 5.2)); model.position.y += hop * .55; model.rotation.x -= .15 + hop * .12; model.rotation.y += ease(t / .8) * TAU; head.rotation.x -= .3; model.scale.y *= 1 + hop * .06; return; }
    case 'lose': { const k = ease(t / .6); model.rotation.x += .28 * k; model.rotation.z += Math.sin(t * 1.6) * .06 * k; head.rotation.x += .35 * k; model.scale.y *= 1 - .06 * k; return; }
    case 'hit': {
      if (pose.tier === 2) {
        // Flattened like a pancake, then springing back with a wobble.
        const fade = Math.max(0, 1 - (t - .5) / .6), squash = t < .12 ? ease(t / .12) : t < .5 ? 1 : fade + Math.sin((t - .5) * 22) * .15 * fade;
        model.scale.set(model.scale.x * (1 + squash * .45), model.scale.y * (1 - squash * .62), model.scale.z * (1 + squash * .45));
        return;
      }
      if (pose.tier === 3) {
        // Thrown up and tumbling end over end, then a squashed landing.
        const air = Math.min(1, t / .9), land = t > .9 ? Math.sin(Math.min(1, (t - .9) / .3) * Math.PI) : 0;
        model.position.y += Math.sin(air * Math.PI) * 2.6; model.rotation.x += ease(air) * TAU; model.rotation.z += Math.sin(air * Math.PI) * .5;
        model.scale.set(model.scale.x * (1 + land * .3), model.scale.y * (1 - land * .4), model.scale.z * (1 + land * .3));
        return;
      }
      model.position.y += Math.sin(Math.min(1, t / .35) * Math.PI) * .45;
    }
  }
}
