import * as THREE from 'three';
import { courseLayout, hazardState, type Hazard, type HazardKind, type TrackId } from '../../../shared/track/index.ts';
import { STAGE, type Layer } from './materials.ts';
import type { Kit, Parts } from './kit.ts';
import type { HazardArt } from './types.ts';

/** How each kind of hazard moves: dropping from the sky, bursting from the ground, lowering over the road, floating, rolling across, or standing still. */
type Motion = 'drop' | 'burst' | 'lower' | 'float' | 'roll' | 'fixed';
const MOTION: Record<HazardKind, Motion> = { boulder: 'drop', geyser: 'burst', cage: 'lower', door: 'lower', ghost: 'float', cart: 'roll', cutlery: 'fixed' };
/** Where lowering hazards wait, above the camera's sight line, and where dropping ones start. */
const RAISED = 9.6, DROP = 38;

/** Meshes for a baked prop, sharing the stage materials. */
function meshes(parts: Parts, name: string) {
  const g = new THREE.Group(); g.name = name;
  for (const [layer, [geo]] of parts.bake().layers) { const m = new THREE.Mesh(geo, STAGE[layer.replace('+', '') as Layer]); m.name = name; m.castShadow = layer !== 'glow'; m.receiveShadow = true; g.add(m); }
  parts.layers.clear();
  return g;
}

/** Pulsing striped decal marking where a hazard is about to strike, with a shadow that darkens its middle as the strike nears. */
function warnMaterial(kit: Kit, color: string) {
  return kit.own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: { uColor: { value: new THREE.Color(color) }, uAmount: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAmount, uTime; varying vec2 vUv;
      void main(){ vec2 p = abs(vUv - .5) * 2.; float d = max(p.x, p.y), rim = smoothstep(.72, .86, d) * smoothstep(1., .94, d);
        float stripes = step(.5, fract((vUv.x + vUv.y) * 4. - uTime * 2.)) * smoothstep(1., .9, d) * .45;
        float pulse = .65 + .35 * sin(uTime * 14.);
        float edge = rim + stripes, shade = smoothstep(.95, .4, d) * .5 * uAmount;
        gl_FragColor = vec4(uColor * edge / max(.001, edge + shade), max(edge * uAmount * pulse, shade)); }`,
  }));
}

interface View { h: Hazard; motion: Motion; mover: THREE.Group; warn: THREE.ShaderMaterial | null }

/**
 * Timed hazards drawn from the course's own models and moved from race time with the same pure function the simulation uses,
 * so what a player sees striking is exactly what hits them.
 */
export class HazardViews {
  private views: View[] = [];
  constructor(private kit: Kit, art: Partial<Record<HazardKind, HazardArt>> | undefined) {
    for (const h of courseLayout(kit.id).hazards) {
      const a = art?.[h.kind]; if (!a) throw new Error(`${kit.id} has a ${h.kind} hazard but its scenery has no model for it`);
      const anchor = kit.at(h.s, h.x), motion = MOTION[h.kind];
      if (a.base) { const base = meshes(a.base(h), 'hazard base'); base.position.set(anchor.x, anchor.y, anchor.z); base.rotation.y = anchor.yaw; kit.add(base); }
      const mover = meshes(a.mover(h), 'hazard'); kit.add(mover);
      let warn: THREE.ShaderMaterial | null = null;
      if (a.warn && h.period) {
        // The decal covers everywhere the hazard can strike: its footprint, stretched across a crossing's whole path.
        const span = h.motion === 'cross' ? Math.abs(h.amp ?? 0) + h.width : h.width, centre = h.motion === 'cross' ? h.x + (h.amp ?? 0) / 2 : h.x, p = kit.at(h.s, centre);
        warn = warnMaterial(kit, a.warn);
        // A little larger than the strike zone, so it shows around the hazard's own model.
        const decal = new THREE.Mesh(new THREE.PlaneGeometry(span + 2, h.length + 2).rotateX(-Math.PI / 2), warn); decal.name = 'hazard warning'; decal.renderOrder = 2;
        decal.position.set(p.x, p.y + .08, p.z); decal.rotation.y = p.yaw; kit.add(decal);
      }
      this.views.push({ h, motion, mover, warn });
    }
    this.update(0);
  }

  /** Poses every hazard for race time `time`. */
  update(time: number) {
    for (const v of this.views) {
      const st = hazardState(v.h, time), p = this.kit.at(v.h.s, st.x), m = v.mover;
      m.position.set(p.x, p.y, p.z); m.rotation.set(0, p.yaw, 0); m.scale.setScalar(1); m.visible = true;
      if (v.warn) { v.warn.uniforms.uAmount.value = st.warning > 0 ? Math.min(1, st.warning * 3) : 0; v.warn.uniforms.uTime.value = time; }
      switch (v.motion) {
        case 'drop':
          // Falls in during the warning, lands as the strike begins, then sinks away into the ground.
          m.visible = st.warning > 0 || st.live;
          m.position.y += st.live ? -(st.progress ** 3) * 3 : DROP * (1 - st.warning) ** 2;
          m.rotation.x = time * 2.2; break;
        case 'burst':
          // A low simmer while idle, swelling during the warning, then a full column for the strike.
          m.scale.set(1, st.live ? Math.max(.08, Math.sin(Math.min(1, st.progress * 1.4) * Math.PI / 2) * (st.progress > .8 ? (1 - st.progress) * 5 : 1)) : .05 + st.warning * .12, 1);
          m.rotation.y += time * 1.5; break;
        case 'lower': {
          const k = st.live ? 0 : st.warning > 0 ? (1 - st.warning) ** 2 : 1;
          m.position.y += k * RAISED + (st.live ? Math.sin(Math.min(1, st.progress * 30) * Math.PI) * .25 : 0); break;
        }
        case 'float':
          m.position.y += Math.sin(time * 3 + v.h.s) * .35;
          m.rotation.y += Math.cos((time + (v.h.phase ?? 0)) * 2 * Math.PI / (v.h.period ?? 1)) > 0 ? Math.PI / 2 : -Math.PI / 2; break;
        case 'roll':
          // Carts sit at the rail head during the warning, then cross; between runs they are away in their tunnel.
          m.visible = st.live || st.warning > 0; m.rotation.y += Math.sign(v.h.amp ?? 1) * Math.PI / 2;
          if (st.warning > 0) m.position.y += Math.sin(time * 30) * .03; break;
        case 'fixed': break;
      }
    }
  }
}

/** The first hazard of a kind in a course's layout, so the studio prop sheet shows the model at its real size. */
export function layoutHazard(id: TrackId, kind: HazardKind) {
  const h = courseLayout(id).hazards.find(x => x.kind === kind);
  if (!h) throw new Error(`${id} has no ${kind} hazard`);
  return h;
}
