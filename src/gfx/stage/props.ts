import * as THREE from 'three';
import { TRACKS, type TrackId } from '../../../shared/track/index.ts';
import { sphere, box, cone, crystal, wheel } from './geometries.ts';

/** Places one scaled primitive `ds` metres along the road from the prop's slot, `offset` metres from the centre line. */
export type PropPlacer = (geo: THREE.BufferGeometry, color: string, ds: number, offset: number, y: number, sx: number, sy: number, sz: number) => void;
export const PROP_SLOTS = 180;

/** Trackside scenery for slot `i`: trees, ruins, crystals, towers, candy and rocks, alternating sides of the road. */
export function courseProp(id: TrackId, i: number, place: PropPlacer) {
  const t = TRACKS[id], w = t.width, side = i % 2 ? 1 : -1, off = side * (w + 6 + (i * 17 % 24)), h = 4 + i * 7 % 9;
  if (id === 'forest') { place(box, '#73503d', 0, off, h * .65, 1.1, h * 1.3, 1.1); place(cone, i % 3 ? '#437f43' : '#78a844', 0, off, h * 1.45, h * .75, h * 1.7, h * .75); if (i % 5 === 0) { place(wheel, '#f4e4b4', 0, off - side * 3, 1, .45, 2, .45); place(sphere, '#df5354', 0, off - side * 3, 2, 1.8, .65, 1.8); } }
  if (id === 'gate' || id === 'gardens') { place(box, t.edge, 0, off, h, 3, h * 2, 3); place(box, '#e1dcc3', 0, off, h * 2, 4, .9, 4); if (i % 5 === 0) { place(box, '#d3c9ae', 0, off + side * 3, 3, 9, 6, 8); place(cone, '#729baa', 0, off + side * 3, 8, 7, 4, 6); } }
  if (id === 'mines') { place(crystal, '#514255', 0, off, 4, 6, 9, 6); if (i % 3 === 0) place(crystal, i % 2 ? '#9a7cda' : '#62bfc8', 0, side * (w + 2), 2, 1.5, 3.8, 1.5); }
  if (id === 'manor') { place(box, '#514467', 0, off, h, 5, h * 2, 5); place(cone, '#302944', 0, off, h * 2 + 3, 4.2, 6, 4.2); if (i % 3 === 0) place(sphere, '#d0d6e8', 0, side * (w + 3), 5, 1, 1.5, 1); }
  if (id === 'gingerbread') { if (i % 3) { place(box, '#f1d5a3', 0, off, 3, .8, 6, .8); place(sphere, ['#f076ad', '#6bded2', '#e9c553'][i % 3], 0, off, 6.4, 2.7, 2.7, .9); } else { place(box, '#b6814e', 0, off, 3, 7, 6, 7); place(cone, '#fcaabd', 0, off, 7.8, 6, 5, 6); place(sphere, '#fff0db', 0, off, 7, 5, .65, 5); } }
  if (id === 'volcano') { place(crystal, i % 2 ? '#533b46' : '#703e42', 0, off, 1, 5 + h, 6 + h, 6 + h); if (i % 5 === 0) place(cone, '#f09b38', 0, off, 9, 1.4, 13, 1.4); }
  if (id === 'test' && i % 4 === 0) { place(box, '#536780', 0, off + side * 8, 3, 12, 6, 15); place(box, '#90a9bb', 0, off + side * 8, 6.3, 14, .5, 16); for (let j = 0; j < 4; j++) place(box, j % 2 ? '#dc7b57' : '#ddd2ac', j * 2.5, off, 1.2 + j * .6, 6, .5, 2); }
}
