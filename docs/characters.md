# Racer models

Most racers are built in code from primitives in `src/gfx/characters/racers/*.ts`: rigid parts on a joint hierarchy, baked into vertex-coloured toon meshes by `Rig`.
Chocobo, Bahamut, Cloud, Behemoth and Golem are authored as skinned, textured GLBs, by Blender scripts in this repository.
This page describes that pipeline so the next racer can reuse it.

## Pipeline

```sh
npm run character -- bahamut
npm run character -- cloud
npm run character -- chocobo
npm run character -- golem
```

`scripts/characters/build.mjs` runs Blender headless (`/Applications/Blender.app/Contents/MacOS/Blender`, or the `BLENDER` environment variable) on `scripts/characters/build.py`, which writes `src/assets/characters/<name>.glb`.
The build is deterministic and takes about 20 seconds, most of it the ambient-occlusion bake.
Commit the regenerated GLB together with the script change that produced it.

The shared pipeline lives in `scripts/characters/pipeline/`:

| Module | Job |
| --- | --- |
| `geometry.py` | Smooth paths, lofted tubes (`loft`, `ellipsoid`, `claw`), round (`ellipse`) and rounded-box (`superellipse`) rings, flat-ended boxes (`box`, `flat`), Coons patches for membranes, thickening and mirroring. Every part carries its own (u, v) parameters. |
| `weights.py` | Skin weights without painting: `rigid`, `along` (blend down a loft between consecutive bones) and `nearest` (inverse distance to bone segments). At most four influences per vertex. |
| `atlas.py` | Packs one rectangle per skin into a 1024 x 1024 atlas, maps part UVs into it with padding, and paints each skin with numpy. |
| `scene.py` | Armature, joined body mesh, the outline hull (welded and decimated), the ambient-occlusion bake into vertex colours, materials and the GLB export with meshopt compression and WebP textures. |
| `anim.py` | Clips written as functions of time in armature-space angles, keyed into Blender actions. `mirrored` adds the right side from the left, and `aim` gives the rotation that points a bone in a direction. |

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
- `src/gfx/characters/racers/cloud.ts` is a rider on a vehicle: one armature holds Cloud and the Hardy-Daytona. The wheels and the fork have their own bones that no clip keys; `driven()` in `skinned.ts` gives each one a stand-in joint, which the shared animator spins (`Build.wheels`) and steers (`Build.steer`) like a code-built racer's joint, and turns the bone about an axis given in model space after the mixer update. Idle and Ride blend by speed; Cast, Win and Lose follow the reaction's clock.
- The head of a skinned racer is turned through `overlay()` in `skinned.ts`. The shared animator and the reaction poses rotate a stand-in joint (`Build.head`) in model axes, and `Build.sync`, which `index.ts` calls after the poses, turns the head bone by it on top of its clips. Never add to a bone's rotation after `mixer.update`: the mixer only writes a bone when its blended clip value changes, so on any frame it skips, such as a paused Studio or a held pose, the addition piles up and the head spins. Advance the model with `SkinnedModel.update`, which puts the clip value back before each mixer update. `tests/studio-heads.browser.ts` checks every racer's head in the Studio.
- `src/gfx/characters/racers/bahamut.ts` builds the `Build` the rest of the game expects: head overlay, exhaust and contact anchors fixed to bones, and an `update` that drives an `AnimationMixer`. Hover and Fly blend by speed. Roar, Win and Lose follow the reaction's own clock so every viewer sees the same frame, and Blink plays on its own timer. The shared lean, stun spin and reaction poses from `index.ts` and `poses.ts` still apply on top.

## Budgets

Measured in the Studio with `createCharacter` (triangles of the body and of the outline hull, and meshes, which are draw calls before the shadow pass):

| Racer | Triangles | Outline triangles | Meshes | Texture |
| --- | --- | --- | --- | --- |
| Chocobo | 11,956 | 4,705 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Chocobo (the procedural model had 12,708, 7,456 and 35) |
| Chubby Chocobo | 14,768 | 10,024 | 35 | none |
| Bahamut | 11,928 | 4,899 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Bahamut |
| Cloud | 11,032 | 4,570 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Cloud |
| Behemoth | 12,220 | 4,224 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Behemoth |
| Golem | 11,680 | 4,754 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Golem (the procedural model had 5,588, 5,220 and 18) |

The Bahamut GLB is 469 KB with 36 bones and six clips; the Cloud GLB is 329 KB with 24 bones and six clips.
The Behemoth GLB is 407 KB with 37 bones and six clips; the code-built Behemoth it replaced had 12,192 and 9,308 triangles in 23 meshes.
The Golem GLB is 361 KB with 23 bones and six clips.
A new racer should stay near 12,000 body triangles and one atlas.

## Pitfalls

- Baking ambient occlusion into the atlas fails when parts share a skin: every mirrored or repeated part bakes into the same pixels and the result is blotchy. Bake into vertex colours and smooth them (`scene.bake_ao`).
- Blender's exporter keeps every keyed bone in a clip. An overlay clip such as Blink must key only its bones (`only=`), and the loops must leave those bones out (`skip=`); otherwise the mixer averages the overlay with the loop's rest pose and the blink only half closes.
- Loft frames follow `up_hint`. A part whose path runs along the hint (a thigh hanging down with the default up of +Z) gets an arbitrary seam and painter orientation; give it an `up_hint` across the path.
- Spreading a hanging leg sideways is a rotation about Y in armature space, not about Z.
- The Studio and the game must await `loadCharacterModels()` before building a racer, but after any hook that tests read on startup.
- Compare against the PS1 in-game model, not the CG art: colours, head shape and pose differ.
- Bones the game turns in code (wheels, a fork) must be left out of every clip with `skip=`, or the mixer overwrites the code's rotation each frame.
- A crouched rider can be modelled upright and pitched forward about the hips in the build script (`crouched()` in `cloud/model.py`).
- Model a rider in the riding pose, so the hands rest on the grips with no clip; clips then only add motion. A clip that lifts the torso also lifts the hands off the bars, so keep such offsets small.
- Hair for a toon character is a few solid, blunt, slightly flattened locks on a skull whose back swells into the hair mass. An even ring of spikes reads as a sunflower or a sea urchin; the PS1 Cloud's hair is a swept mass with one dominant lock.
- A flat part such as a sword blade lying on the back is seen edge-on from the side. Turn its flat a little toward the side camera and give it real thickness, or it reads as a pole.
- Three's `AnimationMixer` only writes a bone when its clip value changed since the last frame, so code must never add to a mixer-driven bone after `mixer.update`: the addition piles up while the clip holds still and the head spins. Turn such bones through `overlay()` and advance the model with `SkinnedModel.update` (see Runtime).

## A racer with a vehicle

Behemoth and his tank share one armature (`scripts/characters/behemoth/`).
The rest pose is the driving pose, so his claws sit on the lever rods without help, and a clip that rocks a lever moves the arm by the same distance (`levers` in `clips.py`).
Road wheels are bones that `racers/behemoth.ts` turns through `driven`, so the shared animator spins them like any racer's wheels.
The track pads on the bottom run hang from one bone per track that slides back by the distance driven, wrapped to one pad spacing, so evenly spaced pads read as a moving belt.
The clips never key these bones (`DRIVEN` in `clips.py`).
Hard-surface boxes use `superellipse` rings; `flat` in Behemoth's `model.py` turns a loft's cone caps into flat ends with their own ring, so smooth shading does not round the corners.

## Adding the next racer

1. Copy `scripts/characters/bahamut/` to a new package and replace the skeleton, parts, painters and clips.
2. Run `npm run character -- <name>` and check the triangle count it prints.
3. Add the GLB to `URLS` in `src/gfx/characters/models.ts`, write `racers/<name>.ts` on top of `skinnedModel`, and register the builder in `BUILDERS`.
4. Add the racer to `RACERS`, `BOT_MAGIC`, `ENGINE_VOICES` and `VOICES`, all indexed alike.
5. Check it in the Studio (`npm run studio`) from the front, side, back and at race distance, next to the other racers.

## Chocobo and the shared bird rig

```sh
npm run character -- chocobo
npm run character -- golem
```

Chocobo on the Jet-Blades CR is one skinned GLB (326 KB, 21 bones, seven clips) for the bird and both rocket skates.
It is built from two packages:

- `scripts/characters/bird/` is a reusable super-deformed bird. `model.py` takes a `Bird` (proportions as spline keys along one vertical loft for the head and body, feather `clumps` raised out of that surface, plus the eye, beak, crest, tufts, wings, tail, scarf and legs) and returns its skeleton and parts. `paint.py` makes painters from a palette, and `clips.py` has pose helpers (`wings`, `tail`, `flap`, `blink`).
- `scripts/characters/chocobo/` holds Chocobo's `BIRD` proportions, the Jet-Blades (boots, chassis, engine, exhausts and wheels on `foot` and `wheel_*` bones), his palette and his clips.

The bird's bones are `root`, `hips`, `chest`, `head` (pivoting in the middle of the head), `jaw`, `crest`, `eye.L/R`, `tail`, `wing.L/R`, `wing_tip.L/R` and `thigh.L/R`, which end at the ankle.
At rest the wings stick straight out sideways with their flat faces to the front and back: a positive Y angle lowers the left wing and a positive Z angle sweeps it back, so a wingbeat is a clean roll about the forward axis.

`src/gfx/characters/racers/chocobo.ts` blends Idle and Skate by speed and plays Cast, Win and Lose on the reaction's clock.
Flap is a wingbeat that starts and ends at rest; the racer plays an additive copy of it (`AnimationUtils.makeClipAdditive`, made once per clip) whenever `flying` is set, so the wings beat on top of whatever the body is doing: the menu hop, jumps, the Flap ability and the win.
The four wheels are bones turned by `driven()`, and the exhaust and contact anchors in the racer must follow the skate positions in `chocobo/model.py`.

Chubby Chocobo is still built in code by `src/gfx/characters/parts/bird.ts`, which now only serves him.
To rebuild him on the pipeline, give him his own `Bird` (a rounder, wider body, no `scarf` if he has none, `tufts` for his crest) and keep the bird skeleton, painters and pose helpers. His trike replaces the Jet-Blades: model it on its own bones the way the skates hang off `foot`, and turn its wheels with `driven()`.

Pitfalls met on Chocobo:

- Profile keys interpolated with `curve` flatten at every key and ripple a smooth body. `geometry.spline` is a cubic through the keys and keeps the body round.
- A big head pivoting at the neck puts the portrait camera, which frames `Build.head`, on the chest. Pivot the head bone inside the head.
- Wings raised much above level vanish into a big head. Keep raised poses diagonal, and remember the shared poses already pitch the model and the head for cast and lose, so a clip adds only a little.
- Clips that already raise the wings stack with the additive Flap on a win. Keep the Win wings level and let the overlay beat them.
- From the chase camera a smooth egg reads wrong: the original's back has a few large rounded feather puffs. `Clump`s displace the body loft itself, so the outline is bumpy. Use a handful of big ones, each about a fifth of the body width, placed where the outline is seen from behind (crown, upper corners, sides of the head); many small ones read as toad skin.
- A character package can set `AO_STRENGTH` in `paint.py` to soften the baked ambient occlusion. Chocobo uses 0.18 so his bright, flat yellow does not mottle between the puffs.
- Puffs in the middle of the back break the toon shading into blotches right where the chase camera looks. Put them only where the outline is seen from behind.
- The sun's self-shadowing also blotches a bumpy back. `skinnedModel(r, id, { selfShadow: false })` stops a model receiving shadows while it still casts one; Chocobo uses it.
- Match colours by measuring the original's race view and ours under the game's lighting: the PS1 Chocobo samples at about hue 39 degrees there (`#de9516`), which the paint base `#ffb026` reproduces.
- A feather fan pointing straight back is seen end-on from the chase camera as a row of dark triangles. Keep the tail small and low.
- The race view is decided by the skates: big black rear wheels about as wide as they are tall, poking out past the body's sides, the red engines between them and the blue boots visible above. A red cowl over the wheel hides the boots.

## Golem and the Rockin' Roller V8

```sh
npm run character -- golem
```

Golem and his jeep share one armature (`scripts/characters/golem/`), with the driving pose as the rest pose so his fists sit on the steering wheel's rim.
He is built from separate boulders (`rock` in `model.py`: rounded-box rings that ease to rounded ends, with a little deterministic bumpiness), each skinned rigidly to one bone, so the skinning is as simple as the stone figure it shows.
The front wheels hang on `steer.L` and `steer.R` knuckle bones; `racers/golem.ts` turns the knuckles through `driven` as `Build.steer` and spins the wheels, children of the knuckles, as `Build.wheels`, syncing each knuckle before its wheel.

Pitfalls met on Golem:

- A Coons patch faces one way only. A flat decal such as the grille or the tailgate must be wound to face out of the body, or back-face culling hides it.
- A tyre lofted along its axle closes each side in a cone; `flat` turns the cones into flat sidewalls, so a hub disc can sit on the outside.
- From the raised chase camera, wheel arches over the rear tyres hide them behind blue blocks. The original shows the rear tyres whole with only a thin ledge on top.
- The chase camera looks down on the back, so a big back rock hides a head that sits low between the shoulders. Keep the back rock low and the head standing well above the shoulders.
- Self-shadowing from the sun darkens his back in the chase view much more than the original's lighting; measured without it, his lit stone matches the original's.
