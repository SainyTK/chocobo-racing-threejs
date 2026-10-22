# Racer models

White Mage is still built in code from primitives in `src/gfx/characters/racers/white-mage.ts`: rigid parts on a joint hierarchy, baked into vertex-coloured toon meshes by `Rig`.
The other racers, Chocobo, Mog, Golem, Goblin, Black Magician, Chubby Chocobo, Bahamut, Cloud and Behemoth, are authored as skinned, textured GLBs, by Blender scripts in this repository.
This page describes that pipeline so the next racer can reuse it.

## Pipeline

```sh
npm run character -- bahamut
npm run character -- cloud
npm run character -- chocobo
npm run character -- golem
npm run character -- chubby
npm run character -- mog
npm run character -- goblin
npm run character -- black_mage
```

`scripts/characters/build.mjs` runs Blender headless (`/Applications/Blender.app/Contents/MacOS/Blender`, or the `BLENDER` environment variable) on `scripts/characters/build.py`, which writes `src/assets/characters/<name>.glb`.
The build is deterministic and takes about 20 seconds, most of it the ambient-occlusion bake.
Commit the regenerated GLB together with the script change that produced it.

The shared pipeline lives in `scripts/characters/pipeline/`:

| Module | Job |
| --- | --- |
| `geometry.py` | Smooth paths, lofted tubes (`loft`, `ellipsoid`, `claw`), surfaces of revolution about any axis (`lathe`, from (offset, radius) points, optionally smoothed by a spline), round (`ellipse`) and rounded-box (`superellipse`) rings, flat-ended boxes (`box`, `flat`), Coons patches for membranes, thickening and mirroring. Every part carries its own (u, v) parameters. |
| `weights.py` | Skin weights without painting: `rigid`, `along` (blend down a loft between consecutive bones) and `nearest` (inverse distance to bone segments). At most four influences per vertex. |
| `atlas.py` | Packs one rectangle per skin into a 1024 x 1024 atlas, maps part UVs into it with padding, and paints each skin with numpy. `value_noise` gives painters smooth noise that wraps around a loft; `glow` makes the small emission mask. |
| `scene.py` | Armature, joined body mesh, the outline hull (welded and decimated), the ambient-occlusion bake into vertex colours, materials and the GLB export with meshopt compression and WebP textures. |
| `anim.py` | Clips written as functions of time in armature-space angles, keyed into Blender actions. `mirrored` adds the right side from the left, and `aim` gives the rotation that points a bone in a direction. |

A character is a package `scripts/characters/<name>/` with three modules:

- `model.py`: `skeleton()` returns bones as (head, tail, parent) in armature space, and `parts(skeleton)` returns the parts with their skins and weights.
- `paint.py`: `PAINTERS` (one painter per skin), `SIZES` (atlas rectangle per skin), `BACKGROUND` and `OUTLINE` (the ink colour). Optionally `AO_STRENGTH`, and `GLOW`, a strength per skin that lights itself: those skins also go into a 256 x 256 emission mask, which the GLB carries as the material's emissive texture.
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
- A model with a `GLOW` mask keeps it: `skinnedModel` copies the GLB's emissive map onto the toon material, so glowing eyes stay bright in the shade.
- Skinned bodies receive the sun's shadow with a reach (`SELF_SHADOW_REACH` in `skinned.ts`, `shadowReach` in `materials/toon.ts`): the shadow lookup moves 3 m toward the sun, so occluders nearer than that, which is the racer itself, are ignored, while roofs, tunnels and arches further away still darken the racer.
  Without it, a back turned away from the sun was blotched: the toon ramp keeps half of the direct light in its darkest band, and the soft edge of the racer's own shadow wandered across that band in patches. Baked ambient occlusion was not the cause, and turning off shadow receiving would lose the darkening in tunnels and under roofs and arches. Checked on all five skinned racers in Mythril Mines.
- `src/gfx/characters/racers/bahamut.ts` builds the `Build` the rest of the game expects: head overlay, exhaust and contact anchors fixed to bones, and an `update` that drives an `AnimationMixer`. Hover and Fly blend by speed. Roar, Win and Lose follow the reaction's own clock so every viewer sees the same frame, and Blink plays on its own timer. The shared lean, stun spin and reaction poses from `index.ts` and `poses.ts` still apply on top.

## Budgets

Measured in the Studio with `createCharacter` (triangles of the body and of the outline hull, and meshes, which are draw calls before the shadow pass):

| Racer | Triangles | Outline triangles | Meshes | Texture |
| --- | --- | --- | --- | --- |
| Chocobo | 11,956 | 4,705 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Chocobo (the procedural model had 12,708, 7,456 and 35) |
| Mog | 12,632 | 4,902 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Mog (the code-built Mog in his old car had 10,720, 5,844 and 24) |
| Goblin | 12,740 | 5,416 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Goblin (the code-built Goblin in his plank wagon had 8,220, 4,816 and 20) |
| Chubby Chocobo | 10,994 | 4,552 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Chubby Chocobo (the procedural model had 14,768, 10,024 and 35) |
| Bahamut | 11,928 | 4,899 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Bahamut |
| Cloud | 11,032 | 4,570 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Cloud |
| Behemoth | 12,220 | 4,224 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Behemoth |
| Golem | 11,680 | 4,754 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, shared by every Golem (the procedural model had 5,588, 5,220 and 18) |
| Black Magician | 12,104 | 3,816 | 2 | one 1024 x 1024 WebP atlas, 5.3 MB on the GPU with mipmaps, and a 256 x 256 emission mask, 0.35 MB, both shared by every Black Magician (the procedural model had 7,286, 6,252 and 38) |

The Bahamut GLB is 469 KB with 36 bones and six clips; the Cloud GLB is 329 KB with 24 bones and six clips; the Chubby Chocobo GLB is 301 KB with 20 bones and seven clips.
The Behemoth GLB is 407 KB with 37 bones and six clips; the code-built Behemoth it replaced had 12,192 and 9,308 triangles in 23 meshes.
The Golem GLB is 399 KB with 23 bones and six clips.
The Black Magician GLB is 338 KB with 20 bones and six clips.
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

Pitfalls met on Chocobo:

- Profile keys interpolated with `curve` flatten at every key and ripple a smooth body. `geometry.spline` is a cubic through the keys and keeps the body round.
- A big head pivoting at the neck puts the portrait camera, which frames `Build.head`, on the chest. Pivot the head bone inside the head.
- Wings raised much above level vanish into a big head. Keep raised poses diagonal, and remember the shared poses already pitch the model and the head for cast and lose, so a clip adds only a little.
- Clips that already raise the wings stack with the additive Flap on a win. Keep the Win wings level and let the overlay beat them.
- From the chase camera a smooth egg reads wrong: the original's back has a few large rounded feather puffs. `Clump`s displace the body loft itself, so the outline is bumpy. Use a handful of big ones, each about a fifth of the body width, placed where the outline is seen from behind (crown, upper corners, sides of the head); many small ones read as toad skin.
- A character package can set `AO_STRENGTH` in `paint.py` to soften the baked ambient occlusion. Chocobo uses 0.18 so his bright, flat yellow does not mottle between the puffs.
- Puffs in the middle of the back break the toon shading into blotches right where the chase camera looks. Put them only where the outline is seen from behind.
- Match colours by measuring the original's race view and ours under the game's lighting: the PS1 Chocobo samples at about hue 39 degrees there (`#de9516`), which the paint base `#ffb026` reproduces.
- A feather fan pointing straight back is seen end-on from the chase camera as a row of dark triangles. Keep the tail small and low.
- The race view is decided by the skates: big black rear wheels about as wide as they are tall, poking out past the body's sides, the red engines between them and the blue boots visible above. A red cowl over the wheel hides the boots.

## Mog and the Mog-Mobile R2

```sh
npm run character -- mog
npm run character -- black_mage
```

Mog on his kick scooter is one skinned GLB (325 KB, 19 bones, six clips), built by `scripts/characters/mog/`.
Like Behemoth and Cloud, one armature carries the rider and the vehicle, and the rest pose is the riding pose, so his paws sit on the grips without help.

- The scooter hangs off `scooter`. `fork` points down the stem's line and carries the front mudguard and `wheel_front`; `wheel_rear` hangs off `scooter`. `racers/mog.ts` steers the fork and spins both wheels through `driven()`. Only the fork turns: the stem and handlebar stay put so the paws keep their grip.
- The pom-pom rides on `antenna`, which `racers/mog.ts` swings on a damped spring through a second `overlay()`, so it sways with steering and leans back with speed. `Build.sync` syncs both overlays.
- The clips never key the wheels, the fork or the antenna (`DRIVEN` in `clips.py`). His eyes are closed arcs, so he has no Blink; `mouth` opens by scale for Cast and Win.
- Flap is an additive wingbeat on his bat wings, played like Chocobo's whenever `flying` is set.

Pitfalls met on Mog:

- An `ellipsoid` whose axis runs along its `up_hint` (a ball lofted along +Z with the default hint) gets no frame and does not show. Pass an `up_hint` across the axis.
- An arm raised overhead disappears behind a big head from the front and the back. A wave reads when the upper arm swings out to the side (+Z for the left arm, after a small -X lift) and the forearm rises (-Y for the left).
- A part that covers only one side, such as half of a neckerchief, must go in the mirrored list, or it reads as a diagonal strap.
- An open-ended loft, such as a horn's bell, shows the outline hull through its mouth as a grey disc. Cap it and paint the cap dark.
- From the chase camera, batteries as tall as the model sheet draws them read too tall; the original's race view shows them only up to his shoulders, with the wings just above them.

## Chubby Chocobo on the Phat-Burner Plus

```sh
npm run character -- chubby
```

Chubby Chocobo is one skinned GLB for the bird and his trike, built from `scripts/characters/chubby/` on top of the shared bird package.
His `Bird` is a wide, squat pear with a slight notch at the neck and no crest; the pointed nub on the crown is a plump feather.
The package adds what the bird package does not have: closed, happy eyes (a dark arc on each `eye` bone, so Blink squints them), a small round bill on `head` and `jaw`, the thistle on his chest, short plump wings that hug his sides and rest their tips on the handlebars, thick legs with clawed feet on `foot` bones, and the trike.
It replaces the bird's wing bones with ones that run from the shoulder, out past his side and in to the wing tip on the grip, and moves the `tail` bone up to the tail, which sits high on his back above the engine.

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
- His paint is a near-neutral cream (#fafbf5). The PS1 race view measures near white (#f5f5f2 lit, #dfdfc2 in shade), and the game's warm sun already adds the cream tint the podium shows.
- A tyre lofted with end caps has a domed face that bulges out past the rim; a hub disc must stand proud of it or it disappears inside the tyre.
- A belly that bulges forward swallows the fork and the middle of the handlebars. Move the steering head forward with the belly.
- Wings that reach the grips as long arms with spread feather fingers read as human hands from the front. Keep each wing one short, plump paddle against his side with a single rounded tip and no separate feathers, and push the elbow out so it still shows as a paddle from behind.

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
- Rough stone is painted, not modelled: `stone` in `golem/paint.py` lays a Voronoi pattern of lighter and darker faces with cracks over blotches, grain, speckles and dark hollows. The noise is sampled in 3D on the loft taken as a stretched sphere (`solid_noise`), so it stays round up to the poles; the faces and cracks are drawn in (u, v), so each skin passes how many times farther its loft runs around than along, and they fade out near the poles.
- A loft's end cap is one fan of triangles that shows a single row of the texture. Close a boulder's rings down to a small cap (`rock` in `golem/model.py`), or the cap reads as radial streaks.
- Keep grain and speckles a few atlas pixels wide, or they alias into streaks.
- Painter noise must use whole waves around a loft's u, or a seam shows where u wraps, straight down the middle of the back from the chase camera.

## Goblin and the Gob-Cart H4

```sh
npm run character -- goblin
```

Goblin in his mine cart is one skinned GLB (345 KB, 22 bones, six clips), built by `scripts/characters/goblin/`.
One armature carries the goblin and the cart, and the rest pose is the riding pose, so his fists sit on the crank bar.

- The cart hangs off `cart`. Each front wheel turns about an upright pivot at its hub (`steer.L`, `steer.R`) and spins on `wheel_front.L` and `wheel_front.R` below it; the rear pair shares `wheel_rear`. `racers/goblin.ts` turns all five through `driven()`, and the front pivots go in `Build.steer`, so the shared animator steers them.
- The lantern hangs from `lantern`, which `racers/goblin.ts` swings sideways on the spring Mog's pom-pom uses (`spring.ts`) through a second `overlay()`. It does not tip back with speed, which would push it into the front wall.
- The clips never key the wheels, the steering or the lantern (`DRIVEN` in `clips.py`). Blink squashes the eyeballs on `eye.L` and `eye.R`; the club rides on `club` under the right forearm.
- The helmet is a `shell` that rises from a lower edge on the skull, which follows `BRIM` round the head, to straight sides and a broad crown at `HELMET_TOP`, with a rolled rim lofted along that edge and a pale stripe over the crown. The wheels, drum, bracelet and lantern cap are `lathe`s, which give the painter a v along the profile so the wheel's faces, tread and axle caps paint apart.

Pitfalls met on Goblin:

- A `box` that stands upright needs a horizontal `up_hint`; with the default hint along its length it gets no frame and does not show.
- A raised forearm tips whatever the fist holds back over the shoulder. Pitch the held bone forward by about the forearm's lift so the club stands up.
- A pupil painted by the loft's v covers far more of an eyeball than it seems: v 0.8 is three quarters of the radius. Keep the pupil to about v 0.93.
- A hanging part in front of a wall must not swing back with speed, or it disappears into the wall.
- From the PS1's chase camera the helmet is a tall, boxy dome, about as tall as the mane is wide. A helmet that follows the skull reads as a low cap from behind, and a mane much wider than the helmet looks like a wig.
- Eyes sunk into the face show only as slits under the rim. Bring them forward off the face so the whites read as round balls.

## Black Magician and the MagiCloud MK-1

```sh
npm run character -- black_mage
```

Black Magician and his cloud share one armature (`scripts/characters/black_mage/`), with the riding pose as the rest pose: he stands on the cloud with his feet apart and the staff upright in his right fist.
The hips hang from `cloud`, so the cloud's bob carries him; the puffs swell on their own leaf bones (`puff`, `puff.L`, `puff.R`), because scaling a bone scales its children too.
The hat is a `lathe` about the vertical axis, smoothed through a few points (`along`), of one outline from the brim's underside, round the drooping rim and up the broad cone; its upper cone is weighted to `hat_tip`, which `racers/black-mage.ts` turns through a second `overlay()`, so no clip keys it: the tip lags behind, leaning back with speed and swinging out of turns.
The cape is a thickened patch that hangs from `chest` and swings on `cape.L` and `cape.R`, one per half.
`reach` in `clips.py` aims an arm with `aim`, and for the right arm also aims the staff, because a staff that only follows the forearm points down as soon as the arm is raised.
His eyes and, faintly, the cloud are in `GLOW`, so the eyes glow under the brim and the cloud's shaded side stays pale.

Pitfalls met on Black Magician:

- From the menu camera and the chase camera a wide brim hides the face. The hat sits tipped back a little, the face sits forward under it, and the idle clip holds the head up.
- The shared win and lose poses pitch the head back and forward by about a third of a radian. Under a wide brim that shows the hat's underside or buries the face, so his Win and Lose clips turn the head the other way.
- An outline round every puff reads as a pile of snowballs from behind. Only the cloud's body carries the ink outline, and the biggest puffs sit at the sides, where the original's chase view shows them.
- From the PS1 chase camera the hat is a wide, floppy straw mound that hides most of the cone. `brim` in `model.py` reshapes the lathe beyond the cone's base: wider than the cape, drooping at the sides and most at the back, shorter and turned up a little in front so the eyes still show, with a ragged rim. The straw is painted as coarse fibres and a plait, darker in tufts toward the rim.
- The PS1 hat is bright orange on the Select Racer screen and a duller ochre in the chase view. Measure both and pick the paint between them, under the game's lighting.
