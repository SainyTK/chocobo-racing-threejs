import type * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import bahamutUrl from '../../assets/characters/bahamut.glb?url';
import chocoboUrl from '../../assets/characters/chocobo.glb?url';
import cloudUrl from '../../assets/characters/cloud.glb?url';

/** Racers authored as skinned GLB files by `npm run character`, rather than built from code. */
const URLS = { bahamut: bahamutUrl, chocobo: chocoboUrl, cloud: cloudUrl } as const;
export type ModelId = keyof typeof URLS;

const models = new Map<ModelId, GLTF>();
let loading: Promise<void> | null = null;

/** Fetches and parses every racer model once. The game and the studio await this before building any racer. */
export function loadCharacterModels() {
  loading ??= (async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    await Promise.all((Object.keys(URLS) as ModelId[]).map(async id => {
      const gltf = await loader.loadAsync(URLS[id]);
      // Every racer of this kind shares the geometry and texture, so disposing one racer must leave them alone.
      gltf.scene.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh) mesh.geometry.userData.shared = true; });
      models.set(id, gltf);
    }));
  })();
  return loading;
}

export function characterModel(id: ModelId): GLTF {
  const gltf = models.get(id);
  if (!gltf) throw new Error(`The ${id} model is not loaded yet: await loadCharacterModels() first.`);
  return gltf;
}
