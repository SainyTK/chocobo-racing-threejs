import * as THREE from 'three';
import { TRACKS, TRACK_IDS, pointAt, trackLength, courseObjects, type TrackId } from '../../shared/track/index.ts';
import { createCharacter } from '../../src/gfx/characters/index.ts';
import { makePickup } from '../../src/gfx/effects/pickup.ts';
import { makeBoostPad, padMaterial } from '../../src/gfx/stage/boost-pad.ts';
import { buildCourse, type Course } from '../../src/gfx/stage/course.ts';
import { STAGE } from '../../src/gfx/stage/materials.ts';
import { rng } from '../../src/gfx/stage/noise.ts';
import { COURSE_ART } from '../../src/gfx/stage/courses/index.ts';
import type { Instance, StudioElement, Variant } from '../types.ts';
import { defaultView, type ViewState } from '../viewport.ts';

/** Speed of the studio's virtual racer, close to a CPU racer's cruising pace. */
export const CRUISE = 32;
const SECTIONS = 6;

export const COURSE_VARIANTS: Variant[] = [
  { id: 'drive', label: 'Race camera lap' },
  { id: 'aerial', label: 'Aerial overview' },
  { id: 'start', label: 'Start line' },
  ...Array.from({ length: SECTIONS }, (_, i) => ({ id: `s${i + 1}`, label: `Trackside ${i + 1} of ${SECTIONS}` })),
  { id: 'props', label: 'Prop sheet' },
];

/** The game's dynamic objects, so the studio shows the course exactly as a race does. */
function raceObjects(id: TrackId, group: THREE.Group) {
  const stones = courseObjects(id).stones.map((st, i) => { const p = pointAt(id, st.s, st.x), stone = makePickup(st.kind, i); stone.root.position.set(p.x, p.y + 1.5, p.z); group.add(stone.root); return stone; });
  for (const pad of courseObjects(id).pads) { const p = pointAt(id, pad.s, pad.x), m = makeBoostPad(); m.position.set(p.x, p.y + .07, p.z); m.rotation.y = p.yaw; group.add(m); }
  return { update(t: number) { padMaterial.uniforms.uTime.value = t; stones.forEach(s => s.update(t)); }, dispose() { stones.forEach(s => s.dispose()); } };
}

/** Chase camera matching the game's: behind and above the racer, looking a little ahead. Dragging orbits around it. */
function chase(id: TrackId, course: Course, root: THREE.Group): Pick<Instance, 'camera' | 'update' | 'dispose'> {
  const len = trackLength(id), rider = createCharacter(0), focus = new THREE.Vector3(), look = new THREE.Vector3(), home = defaultView();
  root.add(rider.root);
  let s = 0, steer = 0, camera: THREE.Camera = new THREE.PerspectiveCamera();
  const place = (t: number) => {
    s = t * CRUISE - 12;
    // Weave gently across the road, as a racer taking lines through corners would.
    const off = Math.sin(t * .35) * TRACKS[id].width * .35, p = pointAt(id, s, off), q = pointAt(id, s + 1.5, Math.sin((t + .05) * .35) * TRACKS[id].width * .35);
    const yaw = Math.atan2(q.x - p.x, q.z - p.z); steer = THREE.MathUtils.clamp(p.curve * 30, -1, 1);
    rider.root.position.set(p.x, p.y, p.z); rider.root.rotation.y = yaw; return yaw;
  };
  return {
    camera(cam: THREE.PerspectiveCamera, view: ViewState, t: number) {
      camera = cam; const yaw = place(t), p = rider.root.position, a = yaw + (view.az - home.az), lift = (view.el - home.el) * 14, dist = 10.5 + 2.5 * view.zoom - 2.5;
      cam.position.set(p.x - Math.sin(a) * dist * view.zoom, p.y + 6.3 + lift, p.z - Math.cos(a) * dist * view.zoom);
      look.set(p.x + Math.sin(yaw) * 8, p.y + 1.8, p.z + Math.cos(yaw) * 8); cam.lookAt(look);
      if (cam.fov !== 58 || cam.far !== 1500) { cam.fov = 58; cam.near = .2; cam.far = 1500; cam.updateProjectionMatrix(); }
      return focus.copy(p);
    },
    update(t: number, dt: number) { rider.animate({ t, dt, speed: CRUISE, steer, drifting: false, flying: 0, stun: 0, boost: 0, menu: false }); course.update(t, dt, camera); },
    dispose() { rider.dispose(); },
  };
}

/** Lays out the course's named props in rows with labels, lit by the course's own sky. */
function propSheet(id: TrackId, root: THREE.Group, labels: THREE.Texture[]) {
  const catalog = COURSE_ART[id].catalog ?? {}, names = Object.keys(catalog), cols = Math.ceil(Math.sqrt(names.length)), gap = 7;
  const sheet = new THREE.Group(); let x = 0, z = 0, rowDepth = 0, i = 0, width = 0;
  for (const name of names) {
    const parts = catalog[name](rng(7 + i)).bake(), b = parts.bounds(), size = b.getSize(new THREE.Vector3()), item = new THREE.Group();
    for (const [layer, [g]] of parts.layers) { const m = new THREE.Mesh(g, STAGE[layer.replace('+', '') as keyof typeof STAGE]); m.castShadow = m.receiveShadow = true; item.add(m); }
    item.position.set(x - b.min.x, 0, z - b.max.z); sheet.add(item);
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d')!;
      g.fillStyle = '#0d0e1cd0'; g.beginPath(); g.roundRect(4, 14, 504, 68, 34); g.fill(); g.fillStyle = '#ffffff'; g.font = '600 44px Barlow, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 256, 49);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; labels.push(tex);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })); label.scale.set(6, 1.1, 1);
      label.position.set(x + size.x / 2, b.max.y + 1.2, z - size.z / 2); sheet.add(label);
    }
    x += size.x + gap; rowDepth = Math.max(rowDepth, size.z); width = Math.max(width, x);
    if (++i % cols === 0) { x = 0; z -= rowDepth + gap * 1.5; rowDepth = 0; }
  }
  const box = new THREE.Box3().setFromObject(sheet), c = box.getCenter(new THREE.Vector3());
  sheet.position.set(-c.x, 0, -c.z);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * .8 + 6, 48).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: COURSE_ART[id].env.hemi.ground }));
  ground.receiveShadow = true; root.add(ground, sheet);
  return { radius: box.getBoundingSphere(new THREE.Sphere()).radius, height: (box.max.y - box.min.y) * .35 };
}

function create(id: TrackId, variant: string): Instance {
  const root = new THREE.Group(), labels: THREE.Texture[] = [];
  if (variant === 'props') {
    const art = COURSE_ART[id], { radius, height } = propSheet(id, root, labels);
    const env = { ...art.env, fog: { ...art.env.fog, near: 400, far: 2000 } };
    return {
      object: root, env, focus: { target: new THREE.Vector3(0, height, 0), distance: radius * 2.6, near: .1, far: 2500 },
      dispose() { root.traverse(o => { if (o instanceof THREE.Mesh && !Object.values(STAGE).includes(o.material)) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } if (o instanceof THREE.Mesh && Object.values(STAGE).includes(o.material)) o.geometry.dispose(); if (o instanceof THREE.Sprite) o.material.dispose(); }); labels.forEach(t => t.dispose()); },
    };
  }
  const course = buildCourse(id), objects = raceObjects(id, root), len = trackLength(id);
  root.add(course.root);
  // The aerial view looks across the whole course, so its fog starts further out.
  const env = variant === 'aerial' ? { ...course.env, fog: { ...course.env.fog, near: course.env.fog.far * .9, far: course.env.fog.far * 2.4 } } : course.env;
  const base: Instance = { object: root, env, setQuality: q => course.setQuality(q), dispose() { objects.dispose(); course.dispose(); } };
  if (variant === 'drive') {
    const c = chase(id, course, root);
    return { ...base, camera: c.camera, update(t, dt) { objects.update(t); c.update!(t, dt); }, dispose() { c.dispose!(); base.dispose!(); } };
  }
  let cam: THREE.Camera = new THREE.PerspectiveCamera();
  const at = variant === 'start' ? -4 : variant.startsWith('s') ? (Number(variant.slice(1)) - .5) * len / SECTIONS : 0, p = pointAt(id, at);
  const focus = variant === 'aerial'
    ? { target: new THREE.Vector3(), distance: 0, near: 1, far: 4000 }
    : { target: new THREE.Vector3(p.x, p.y + 2, p.z), distance: variant === 'start' ? 34 : 46, near: .2, far: 1600 };
  if (variant === 'aerial') { const b = new THREE.Box3(); for (let s = 0; s < len; s += 10) { const q = pointAt(id, s); b.expandByPoint(new THREE.Vector3(q.x, q.y, q.z)); } b.getCenter(focus.target); focus.distance = b.getSize(new THREE.Vector3()).length() * 1.15; }
  return {
    ...base, focus,
    camera(c, view) {
      cam = c; const { az, el, zoom } = view, d = focus.distance * zoom / Math.min(1, c.aspect) ** .6, t = focus.target, e = variant === 'aerial' ? Math.max(el, .55) : el;
      // Orbits start facing down the road so the first frame already reads as a racer's view.
      const a = az + (variant === 'aerial' ? 0 : p.yaw + Math.PI - .6);
      c.position.set(t.x + Math.sin(a) * Math.cos(e) * d, t.y + Math.max(1.5, Math.sin(e) * d), t.z + Math.cos(a) * Math.cos(e) * d); c.lookAt(t);
      return t;
    },
    update(t, dt) { objects.update(t); course.update(t, dt, cam); },
  };
}

export const courses: StudioElement[] = TRACK_IDS.map(id => ({
  id: `course.${id}`, name: TRACKS[id].name, category: 'Courses', tags: ['course', 'track', 'stage', 'scenery', id, TRACKS[id].surface], variants: COURSE_VARIANTS,
  create: variant => create(id, variant),
}));
