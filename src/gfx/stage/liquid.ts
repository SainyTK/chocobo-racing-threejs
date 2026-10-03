import * as THREE from 'three';
import { noiseTexture } from './textures.ts';
import { stageTime } from './materials.ts';
import type { Kit } from './kit.ts';

export interface LiquidSpec {
  y: number; deep: string; shallow: string; foam: string;
  /** HDR multiplier for self-lit liquids (lava, glowing goo). 0 for water. */
  glow?: number; scale?: number; speed?: number;
  /** Sky colour mirrored towards grazing angles. */
  sky?: string;
  /** Square size around the course centre. */
  size?: number;
  /** Slow vertical swell, metres. */
  swell?: number;
  opacity?: number;
}

/**
 * Cel-shaded liquid sheet for lakes, lava seas and the cloud sea. Bands of colour and drifting foam lines come
 * from a smooth noise texture thresholded on the GPU; grazing angles pick up the sky colour.
 */
export function makeLiquid(kit: Kit, o: LiquidSpec) {
  const noise = kit.own(noiseTexture(256)), size = o.size ?? 2400;
  const mat = kit.own(new THREE.ShaderMaterial({
    transparent: (o.opacity ?? 1) < 1, depthWrite: (o.opacity ?? 1) >= 1, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uNoise: { value: null }, uDeep: { value: new THREE.Color(o.deep) }, uShallow: { value: new THREE.Color(o.shallow) }, uFoam: { value: new THREE.Color(o.foam) }, uSky: { value: new THREE.Color(o.sky ?? o.shallow) },
      uGlow: { value: o.glow ?? 0 }, uScale: { value: o.scale ?? 1 }, uSpeed: { value: o.speed ?? 1 }, uSwell: { value: o.swell ?? 0 }, uOpacity: { value: o.opacity ?? 1 }, uLite: { value: 0 } }]),
    vertexShader: `uniform float uTime, uSwell; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.); w.y += sin(uTime * .6 + w.x * .02) * cos(uTime * .5 + w.z * .025) * uSwell; vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uLite, uTime, uGlow, uScale, uSpeed, uOpacity; uniform sampler2D uNoise; uniform vec3 uDeep, uShallow, uFoam, uSky; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec2 p = vW.xz * .012 * uScale; float t = uTime * .01 * uSpeed;
        float a = texture2D(uNoise, p + vec2(t, t * .6)).r, b = uLite > .5 ? .5 : texture2D(uNoise, p * 2.3 - vec2(t * 1.3, -t)).g, n = a * .6 + b * .4;
        vec3 c = mix(uDeep, uShallow, smoothstep(.38, .62, n));
        float lines = smoothstep(.035, .0, abs(fract(n * 7. + t * 3.) - .5) - .44);
        c = mix(c, uFoam, lines * .55 + smoothstep(.7, .74, n) * .5);
        vec3 v = normalize(cameraPosition - vW); float fres = pow(1. - max(v.y, 0.), 4.);
        c = mix(c, uSky, fres * (1. - step(.01, uGlow)) * .7);
        c *= 1. + uGlow * (.55 + .45 * smoothstep(.3, .7, n));
        gl_FragColor = vec4(c, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }));
  mat.uniforms.uNoise.value = noise; mat.uniforms.uTime = stageTime;
  const g = new THREE.PlaneGeometry(size, size, 48, 48).rotateX(-Math.PI / 2), mesh = new THREE.Mesh(g, mat);
  mesh.position.set(kit.bounds.cx, o.y, kit.bounds.cz); mesh.name = 'liquid'; mesh.receiveShadow = false;
  // After the opaque ground, so only the visible parts of a sheet under the terrain get shaded.
  mesh.renderOrder = 1;
  kit.add(mesh);
  return mesh;
}
