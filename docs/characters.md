# Racer models

Most racers are built in code from primitives in `src/gfx/characters/racers/*.ts`: rigid parts on a joint hierarchy, baked into vertex-coloured toon meshes by `Rig`.
Bahamut is the first racer authored as a skinned, textured GLB, by a Blender script in this repository.
This page describes that pipeline so the next racer can reuse it.

## Pipeline

```sh
npm run character -- bahamut
```

`scripts/characters/build.mjs` runs Blender headless (`/Applications/Blender.app/Contents/MacOS/Blender`, or the `BLENDER` environment variable) on `scripts/characters/build.py`, which writes `src/assets/characters/<name>.glb`.
The build is deterministic and takes about 20 seconds, most of it the ambient-occlusion bake.
Commit the regenerated GLB together with the script change that produced it.

The shared pipeline lives in `scripts/characters/pipeline/`:

| Module | Job |
| --- | --- |
| `geometry.py` | Smooth paths, lofted tubes (`loft`, `ellipsoid`, `claw`), Coons patches for membranes, thickening and mirroring. Every part carries its own (u, v) parameters. |
| `weights.py` | Skin weights without painting: `rigid`, `along` (blend down a loft between consecutive bones) and `nearest` (inverse distance to bone segments). At most four influences per vertex. |
| `atlas.py` | Packs one rectangle per skin into a 1024 x 1024 atlas, maps part UVs into it with padding, and paints each skin with numpy. |
| `scene.py` | Armature, joined body mesh, the outline hull (welded and decimated), the ambient-occlusion bake into vertex colours, materials and the GLB export with meshopt compression and WebP textures. |
| `anim.py` | Clips written as functions of time in armature-space angles, keyed into Blender actions. `mirrored` adds the right side from the left. |

A character is a package `scripts/characters/<name>/` with three modules:

- `model.py`: `skeleton()` returns bones as (head, tail, parent) in armature space, and `parts(skeleton)` returns the parts with their skins and weights.
- `paint.py`: `PAINTERS` (one painter per skin), `SIZES` (atlas rectangle per skin), `BACKGROUND` and `OUTLINE` (the ink colour).
- `clips.py`: `CLIPS`, the list of `Clip`s to export.

Armature space is Blender's: +X is the character's left, -Y is forward and +Z is up, in game metres.
The exporter turns that into the game's +Z forward, +Y up.

Parts that share a skin share atlas space, for example both eyes, all claws or both wings.
That is why ambient occlusion goes into vertex colours: a texture bake needs unique UVs.

The Python is formatted and linted with Ruff: `uvx ruff format scripts/characters && uvx ruff check scripts/characters`.

## Runtime

- `src/gfx/characters/models.ts` loads every GLB once with `GLTFLoader` and the meshopt decoder. The game (`src/main.ts`) and the Studio (`studio/main.ts`) await `loadCharacterModels()` before building any racer, so `createCharacter` stays synchronous.
- `src/gfx/characters/skinned.ts` clones a model with `SkeletonUtils.clone`, gives the body the shared toon material (atlas as `map`, ambient occlusion as vertex colours, the rig's flash, rim and fade uniforms) and turns the `Outline` mesh into the inverted hull. Geometry, texture and clips stay shared between instances; `dispose` skips geometry marked `userData.shared`.
- `src/gfx/characters/racers/bahamut.ts` builds the `Build` the rest of the game expects: head bone, exhaust and contact anchors fixed to bones, and an `update` that drives an `AnimationMixer`. Hover and Fly blend by speed. Roar, Win and Lose follow the reaction's own clock so every viewer sees the same frame, and Blink plays on its own timer. The shared lean, stun spin and reaction poses from `index.ts` and `poses.ts` still apply on top.

## Budgets

Measured in the Studio with `createCharacter` (triangles of the body and of the outline hull, and meshes, which are draw calls before the shadow pass):

| Racer | Triangles | Outline triangles | Meshes | Texture |
| --- | --- | --- | --- | --- |
| Chocobo | 12,708 | 7,456 | 35 | none |
| Behemoth | 12,192 | 9,308 | 23 | none |
| Chubby Chocobo | 14,768 | 10,024 | 35 | none |
| Bahamut | 11,848 | 4,851 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Bahamut |

The Bahamut GLB is 469 KB with 36 bones and six clips.
A new racer should stay near 12,000 body triangles and one atlas.

## Adding the next racer

1. Copy `scripts/characters/bahamut/` to a new package and replace the skeleton, parts, painters and clips.
2. Run `npm run character -- <name>` and check the triangle count it prints.
3. Add the GLB to `URLS` in `src/gfx/characters/models.ts`, write `racers/<name>.ts` on top of `skinnedModel`, and register the builder in `BUILDERS`.
4. Add the racer to `RACERS`, `BOT_MAGIC`, `ENGINE_VOICES` and `VOICES`, all indexed alike.
5. Check it in the Studio (`npm run studio`) from the front, side, back and at race distance, next to the other racers.
