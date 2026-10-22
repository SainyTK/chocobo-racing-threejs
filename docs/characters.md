# Racer models

Most racers are built in code from primitives in `src/gfx/characters/racers/*.ts`: rigid parts on a joint hierarchy, baked into vertex-coloured toon meshes by `Rig`.
Chocobo, Chubby Chocobo, Bahamut and Cloud are authored as skinned, textured GLBs, by Blender scripts in this repository.
This page describes that pipeline so the next racer can reuse it.

## Pipeline

```sh
npm run character -- bahamut
npm run character -- cloud
npm run character -- chocobo
npm run character -- chubby
```

`scripts/characters/build.mjs` runs Blender headless (`/Applications/Blender.app/Contents/MacOS/Blender`, or the `BLENDER` environment variable) on `scripts/characters/build.py`, which writes `src/assets/characters/<name>.glb`.
The build is deterministic and takes about 20 seconds, most of it the ambient-occlusion bake.
Commit the regenerated GLB together with the script change that produced it.

The shared pipeline lives in `scripts/characters/pipeline/`:

| Module | Job |
| --- | --- |
| `geometry.py` | Smooth paths, lofted tubes (`loft`, `ellipsoid`, `claw`), round (`ellipse`) and rounded-box (`superellipse`) rings, Coons patches for membranes, thickening and mirroring. Every part carries its own (u, v) parameters. |
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
- `src/gfx/characters/racers/cloud.ts` is a rider on a vehicle: one armature holds Cloud and the Hardy-Daytona. The wheels and the fork have their own bones that no clip keys; `driven()` in `skinned.ts` gives each one a stand-in joint, which the shared animator spins (`Build.wheels`) and steers (`Build.steer`) like a code-built racer's joint, and turns the bone about an axis given in model space after the mixer update. Idle and Ride blend by speed; Cast, Win and Lose follow the reaction's clock.
- The head of a skinned racer is turned through `overlay()` in `skinned.ts`. The shared animator and the reaction poses rotate a stand-in joint (`Build.head`) in model axes, and `Build.sync`, which `index.ts` calls after the poses, turns the head bone by it on top of its clips. Never add to a bone's rotation after `mixer.update`: the mixer only writes a bone when its blended clip value changes, so on any frame it skips, such as a paused Studio or a held pose, the addition piles up and the head spins. Advance the model with `SkinnedModel.update`, which puts the clip value back before each mixer update. `tests/studio-heads.browser.ts` checks every racer's head in the Studio.
- `src/gfx/characters/racers/bahamut.ts` builds the `Build` the rest of the game expects: head overlay, exhaust and contact anchors fixed to bones, and an `update` that drives an `AnimationMixer`. Hover and Fly blend by speed. Roar, Win and Lose follow the reaction's own clock so every viewer sees the same frame, and Blink plays on its own timer. The shared lean, stun spin and reaction poses from `index.ts` and `poses.ts` still apply on top.

## Budgets

Measured in the Studio with `createCharacter` (triangles of the body and of the outline hull, and meshes, which are draw calls before the shadow pass):

| Racer | Triangles | Outline triangles | Meshes | Texture |
| --- | --- | --- | --- | --- |
| Chocobo | 11,956 | 4,705 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Chocobo (the procedural model had 12,708, 7,456 and 35) |
| Behemoth | 12,192 | 9,308 | 23 | none |
| Chubby Chocobo | 12,002 | 4,964 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Chubby Chocobo (the procedural model had 14,768, 10,024 and 35) |
| Bahamut | 11,928 | 4,899 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Bahamut |
| Cloud | 11,032 | 4,570 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Cloud |

The Bahamut GLB is 469 KB with 36 bones and six clips; the Cloud GLB is 329 KB with 24 bones and six clips; the Chubby Chocobo GLB is 322 KB with 20 bones and seven clips.
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

## Adding the next racer

1. Copy `scripts/characters/bahamut/` to a new package and replace the skeleton, parts, painters and clips.
2. Run `npm run character -- <name>` and check the triangle count it prints.
3. Add the GLB to `URLS` in `src/gfx/characters/models.ts`, write `racers/<name>.ts` on top of `skinnedModel`, and register the builder in `BUILDERS`.
4. Add the racer to `RACERS`, `BOT_MAGIC`, `ENGINE_VOICES` and `VOICES`, all indexed alike.
5. Check it in the Studio (`npm run studio`) from the front, side, back and at race distance, next to the other racers.

## Chocobo and the shared bird rig

```sh
npm run character -- chocobo
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

Pitfalls met on Chocobo:

- Profile keys interpolated with `curve` flatten at every key and ripple a smooth body. `geometry.spline` is a cubic through the keys and keeps the body round.
- A big head pivoting at the neck puts the portrait camera, which frames `Build.head`, on the chest. Pivot the head bone inside the head.
- Wings raised much above level vanish into a big head. Keep raised poses diagonal, and remember the shared poses already pitch the model and the head for cast and lose, so a clip adds only a little.
- Clips that already raise the wings stack with the additive Flap on a win. Keep the Win wings level and let the overlay beat them.
- From the chase camera a smooth egg reads wrong: the original's back has a few large rounded feather puffs. `Clump`s displace the body loft itself, so the outline is bumpy. Use a handful of big ones, each about a fifth of the body width, placed where the outline is seen from behind (crown, upper corners, sides of the head); many small ones read as toad skin.
- A character package can set `AO_STRENGTH` in `paint.py` to soften the baked ambient occlusion. Chocobo uses 0.18 so his bright, flat yellow does not mottle between the puffs.
- A feather fan pointing straight back is seen end-on from the chase camera as a row of dark triangles. Keep the tail small and low.
- The race view is decided by the skates: big black rear wheels about as wide as they are tall, poking out past the body's sides, the red engines between them and the blue boots visible above. A red cowl over the wheel hides the boots.

## Chubby Chocobo on the Phat-Burner Plus

```sh
npm run character -- chubby
```

Chubby Chocobo is one skinned GLB for the bird and his trike, built from `scripts/characters/chubby/` on top of the shared bird package.
His `Bird` is a wide, squat pear with a slight notch at the neck and no crest; the pointed nub on the crown is a plump feather.
The package adds what the bird package does not have: closed, happy eyes (a dark arc on each `eye` bone, so Blink squints them), a flat duck's bill on `head` and `jaw`, the thistle on his chest, arm-like wings that reach forward to the handlebars, thick legs with clawed feet on `foot` bones, and the trike.
It replaces the bird's wing bones with ones that run from the shoulder to the hand on the grip, and moves the `tail` bone up to the tail, which sits high on his back above the engine.

The trike hangs off a `trike` bone under `root`.
`fork` turns about the raked steering axis and carries the handlebars, horn, front wheel and pedal axle; `wheel_front` and `wheel_rear` (one bone for both rear wheels) spin.
No clip keys these three bones; `racers/chubby.ts` turns them with `driven()`.
The handlebars turn only a little with the steering (`STEER` in the racer), because his hands rest on the grips and do not follow them.

`racers/chubby.ts` blends Idle and Ride by speed and plays Cast, Win and Lose on the reaction's clock, with the additive Flap from Chocobo whenever `flying` is set.
Idle waves his left wing halfway through each loop, as the original does on the Select Racer screen.
The exhaust and contact anchors in the racer must follow the engine and rear wheel positions in `chubby/model.py`.

Pitfalls met on Chubby Chocobo:

- Measure the race view, not the CG model sheet. The sheet's belly is much fatter than the in-game model, which from behind is only about 1.3 times as wide as its head.
- The chase camera sits lower and closer than the original's, so a body that matches the original's height reads too tall. He is modelled a little squatter than the sheet.
- His back is a big smooth surface turned away from the sun, and the toon ramp keeps half of the direct light in its darkest band, so the sun's soft shadow-map edge leaves dark patches across it and under the wings. Baked ambient occlusion is not the cause. His body does not receive shadows (it still casts them).
- A tyre lofted with end caps has a domed face that bulges out past the rim; a hub disc must stand proud of it or it disappears inside the tyre.
- A belly that bulges forward swallows the fork and the middle of the handlebars. Move the steering head forward with the belly.
