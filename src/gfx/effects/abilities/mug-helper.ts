import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { outlineMaterial } from '../../materials/outline.ts';
import { skinUniforms } from '../../materials/skin.ts';
import { toon } from '../../materials/toon.ts';
import { MUG_HELPER } from './looks.ts';

const L = MUG_HELPER;

/** A part painted one colour, so a whole body merges into one vertex-coloured mesh. */
function painted(g: THREE.BufferGeometry, color: string, at: [number, number, number], rotation: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) {
  const part = g.index ? g.toNonIndexed() : g;
  part.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)));
  const c = new THREE.Color(color), n = part.attributes.position.count, colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  part.setAttribute('color', new THREE.BufferAttribute(colors, 3)); part.deleteAttribute('uv');
  return part;
}

/** Head, hair, vest and arms; the helper faces +z and stands on y = 0. */
function bodyGeometry() {
  const parts = [
    painted(new THREE.SphereGeometry(.36, 14, 10), L.skin, [0, 1.12, 0], [0, 0, 0], [1.05, .95, 1]),
    // One big round eye on the front of the face, with a white catch light.
    painted(new THREE.CircleGeometry(.17, 16), L.eyeWhite, [0, 1.15, .345], [-.08, 0, 0]),
    painted(new THREE.CircleGeometry(.12, 14), L.pupil, [.01, 1.14, .358], [-.08, 0, 0]),
    painted(new THREE.CircleGeometry(.035, 8), L.eyeWhite, [.05, 1.19, .366], [-.08, 0, 0]),
    // Pointed ears.
    ...[-1, 1].map(s => painted(new THREE.ConeGeometry(.08, .3, 6), L.skin, [s * .38, 1.16, -.02], [0, 0, -s * 1.25])),
    // Spiky hair sweeping up and back, as the sprite's purple crest.
    ...[[0, 1.5, -.05, -.5, 0], [-.18, 1.45, -.08, -.55, .5], [.18, 1.45, -.08, -.55, -.5], [-.1, 1.38, -.26, -1.1, .3], [.1, 1.38, -.26, -1.1, -.3], [0, 1.32, -.34, -1.5, 0]]
      .map(([x, y, z, rx, rz]) => painted(new THREE.ConeGeometry(.13, .46, 6), (rz ?? 0) === 0 ? L.hair : L.hairShade, [x, y, z], [rx, 0, rz])),
    painted(new THREE.SphereGeometry(.3, 10, 8), L.hair, [0, 1.3, -.08], [0, 0, 0], [1.1, .7, 1.05]),
    // Orange vest over a dark shirt, and grey arms reaching forward to carry a stone.
    painted(new THREE.SphereGeometry(.3, 12, 8), L.vest, [0, .68, 0], [0, 0, 0], [1, 1.1, .85]),
    painted(new THREE.SphereGeometry(.2, 10, 8), L.shirt, [0, .72, .14], [0, 0, 0], [1, 1.2, .8]),
    ...[-1, 1].map(s => painted(new THREE.CapsuleGeometry(.07, .34, 3, 6), L.skin, [s * .26, .74, .2], [1.2, 0, -s * .25])),
  ];
  return mergeGeometries(parts);
}

/** One leg, hanging from its hip at the origin so it can swing. */
const legGeometry = () => mergeGeometries([
  painted(new THREE.CapsuleGeometry(.08, .26, 3, 6), L.legs, [0, -.2, 0]),
  painted(new THREE.SphereGeometry(.11, 8, 6), L.legs, [0, -.4, .06], [0, 0, 0], [1, .6, 1.4]),
]);

/**
 * The little goblin Goblin's Mug sends out: purple spiky hair, one big eye, an orange vest and dark legs, about as
 * tall as a seated racer. Drawn as toon meshes with the racers' ink outline.
 */
export class MugHelper {
  readonly root = new THREE.Group();
  private legs: THREE.Group[] = [];
  private skin = skinUniforms();
  private materials: THREE.Material[];
  private geometries: THREE.BufferGeometry[];
  constructor() {
    const body = bodyGeometry(), leg = legGeometry(), paint = toon('#ffffff', this.skin), ink = outlineMaterial(L.outline, .025, this.skin);
    (paint as THREE.MeshToonMaterial).vertexColors = true;
    this.materials = [paint, ink]; this.geometries = [body, leg];
    const model = new THREE.Group(); model.scale.setScalar(L.height / 1.75); this.root.add(model);
    model.add(new THREE.Mesh(body, paint), new THREE.Mesh(body, ink));
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * .12, .46, 0); hip.add(new THREE.Mesh(leg, paint), new THREE.Mesh(leg, ink)); model.add(hip); this.legs.push(hip);
    }
    this.root.traverse(o => { o.frustumCulled = false; });
    this.root.visible = false;
  }
  /** Poses the helper at `at` heading along `dir`; `run` is the running cycle in seconds and `air` 0 on foot to 1 mid-hop. */
  place(at: THREE.Vector3, dir: THREE.Vector3, run: number, air: number) {
    this.root.visible = true; this.root.position.copy(at);
    this.root.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
    const swing = Math.sin(run * L.strideRate * Math.PI * 2) * .9 * (1 - air);
    this.legs[0].rotation.x = swing + air * .7; this.legs[1].rotation.x = -swing + air * .2;
    // Leaning into the run, and tucked up mid-hop.
    this.root.children[0].rotation.x = .25 + air * .2;
  }
  hide() { this.root.visible = false; }
  dispose() { this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); }
}
