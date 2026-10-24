# Research and implementation decisions

## Correcting the reference

The first build mixed Chocobo GP ideas with a simplified lane racer. That was not a faithful recreation of Chocobo Racing. Version 2 specifically targets the 1999 PlayStation game. It replaces the old simulation, roster, courses and interface.

The original manual describes separate accelerator, brake and reverse controls. Steering turns the vehicle freely. Holding accelerator and brake while turning starts a drift; excessive drifting causes a spin. A release-and-repress technique recovers with a Spin Dash. The start boost depends on accelerator timing. Abilities can be selected independently of racers. Grand Prix has six competitors and four rounds. Time Attack removes stones and rivals and can replay saved driving as a Phantom Racer. [1]

The remake merges brake and reverse into one pedal, as most racing games do: held without the accelerator it brakes, then reverses once the racer has stopped. Touch players can also drive with the left stick, pushing it up to accelerate and down to brake and reverse.

The original's ability select screen pairs each ability with the portrait of the racer who owns it; no ability symbol was found in footage or the manual. The remake draws one badge per ability from what it does in this remake (a speed arrow for Dash, a wing for Flap, a tyre for Grip-Up, a thief's sack for Mug, a plus for Magic Plus, a shield for Barrier, a stone dropping into a bowl for Receive, an arrow striking a star for Charge and a flare burst for Megaflare), coloured like its in-race effect, and shows it in the ability picker and on the ability buttons.

Magic is a three-stone inventory, consumed last-in-first-out. Consecutive matching stones strengthen a spell without freeing inventory capacity. Fire is initially aimed, then homing at level two, then attacks all rivals at level three. Ice progresses from a trap to multiple traps to a field-wide attack. Thunder targets a racer ahead, or everyone at level three. Haste boosts speed, Mini shrinks rivals, Doom adds a transferable countdown, Reflect defends, and Ultima crashes opponents. [2][3]

The roster uses different vehicles rather than different-colored birds. Chocobo has mechanical skates; Mog rides a scooter. Golem drives a jeep, Goblin a mine cart, Black Magician a cloud, White Mage a carpet, Chubby Chocobo a tricycle, and Behemoth a tank-like buggy. [1][4]

The walkthroughs also distinguish the woodland, ruins, mines, manor, floating city, candy and lava environments. They describe secret content and additional modes that this remake does not implement. [3][4]

### Evidence limits

The manual's complete indexed HTML was available. A separate PDF download failed and was not used. The FAQs are secondary sources, not extracted program behavior. No original executable was run, and no numerical physics match was measured. The documentation is enough to correct the major rules, but not enough to claim identical handling, AI or collision timing.

The primary manual sometimes gives broader descriptions than the FAQs. For example, its Reflect description is general, while the FAQ describes attack-specific exceptions. Such edge cases need explicit implementation and tests, not assumptions based on another kart racer.

## What version 2 implements

These describe this repository's behavior, not a claim of exact original code.

| Area | Implemented behavior | Remaining differences |
| --- | --- | --- |
| Driving | World position, heading, velocity, a lateral grip limit of about 4 g per racer, brake-tap sharp turns, short drifts with a 1.9 s over-drift spin, boost kicks that bleed off, wall hits that cost speed by impact, mass-based bumps, falls and recovery | Hand-tuned arcade solver, no bit-for-bit physics match |
| Race validation | Twelve sequential gates per lap, reverse-crossing rejection, split times, finish ordering | Newly authored track layouts and gate locations |
| Racers | Eight distinct handmade low-poly character/vehicle models a skinned, textured Bahamut who flies on his own wings and a skinned Cloud on the Hardy-Daytona, with driving stats balanced against the original's top speeds (84 to 88 MPH), and hit, cast, overtake, win and lose reactions | No ripped meshes, original animations or textures; simplified silhouettes |
| Inventory | Three stones rolling in a short chain right behind the racer's rear wheels, flashing white to show a stack's level, LIFO use, a stone merged into the latest stack when it matches, up to level three, with every stone still taking a place, and Mug or a bump from behind taking a whole stack | Numeric timing and some defensive interactions are interpretations |
| Magic | All eight main spell families, per-course stone sets from the original's Story chapters in fixed-colour lanes, position-weighted "?" stones, targeting by race progress, the original's three hit tiers with a 2.5 s safe window, single-target Mini in 25% steps, Doom transfer, and CPU casting habits per character | Cid's Test Track has Moogle Forest's stones, where the original's first course had none. Durations are hand-tuned; no original effect assets |
| Abilities | Dash, Flap, Grip-Up, Mug, Magic Plus, Barrier, Receive and Charge with the original's recharge times; each racer defaults to its own, and the player can choose another | Magic Plus recharges in 20 s and Charge in 14 s, both measured in all-CPU races. Dash lasts 2 s and Charge 1 s, shorter than the original, because boosts are worth more with this grip model. Barrier is a timed 4 s shield |
| Race classes | Chocobo, Behemoth and Bahamut Class set CPU pace, cornering, brake taps, hazard misreads and shortcut use; Bahamut also makes every racer 10% faster. Mild catch-up keyed on the leading human | Every class is available from the start |
| Courses | Per-course boost pads, mud and slick patches, jump ramps with airtime, a gap, shortcuts that count the road they skip, and timed hazards that warn before they strike | Newly authored placements inspired by the original's gimmicks |
| Grand Prix | Four local rounds, cumulative points, next grid follows finishing order, final champion, at the chosen class | Courses proceed from the selected course through the next three; no difficulty-class unlocks |
| Time Attack | Solo race with no pickups, saved best-race ghost and interpolated replay of actual recorded positions | Browser-local saves, configurable lap count, no memory-card import |
| Versus | Player against one selected CPU rival | No split-screen or second local controller |
| Online | Six-player private rooms with AI fill, authoritative simulation, recovery and rematches | Browser addition, not emulation of the original multiplayer |
| Presentation | Gold title, blue beveled menus, animated portrait order, MPH, ability gauge, minimap, one callout at a time, a finish sequence with slow motion, orbit and podium, and synthesized engines, spell sounds and character barks | Newly authored interface, fonts, synthesized music, sounds and scenery |

Not implemented: Story, Relay, secret characters other than Bahamut and Cloud, the F.F.VIII Circuit bonus course, custom stat editing, original cutscenes, original soundtrack, exact maps, split-screen, public matchmaking or ranked online leaderboards. The in-game About screen states these limits.

## Bahamut

Bahamut follows the PS1 in-game model, checked side by side against footage of the original (a Bahamut race on Cid's Test Track and the Fantasia cutscenes), not the CG art.
He has no vehicle and flies on his own wings: membranes navy on top, as the race view from behind shows, and maroon underneath, as the cutscene front view shows, a blue head with a heavy brow, small eyes and short upswept horns, a green plated chest, blue thigh plates and upper arms, mint shins, feet and arm undersides, yellow claws and a tail that hangs between his legs.
The blue orb often seen under him in the original's race view is his held Magic Stone, which changes colour with the stone and is absent when he holds none; see Magic Stones below for how this remake shows held stones.

Deliberate deviations, kept for balance or because the remake lacks the original's modes:

| Original | Remake | Reason |
| --- | --- | --- |
| Megaflare charges in about 45 s | 80 s | In all-CPU races, 45 s won Bahamut 63% of races; at 80 s he wins 34%, level with Chubby Chocobo |
| Megaflare is a hard crash | Every rival is thrown into the air with the heavy-crash reaction but stalls for the 1.6 s crash time, not the 2.4 s heavy crash | Same balance runs: the heavy crash kept him above a third of wins even with a 100 s charge |
| The first flare shots always miss | A fixed 1.5 s of falling warning shots before the strike | Gives the same warning without random misses in the deterministic simulation |
| Unlocked by finishing Story Mode | Available from the start | This remake has no Story Mode |
| Held stones float under him | Held stones roll on the road just behind him like every racer | See Magic Stones below |

## Cloud

Cloud follows the PS1 in-game model, checked side by side against footage of the original (a longplay of every course with Cloud: the chase camera from behind, the orbit after the finish and the course intro sweep), not FFVII art.
He is super-deformed, with a head about as wide as his shoulders: bright yellow hair that is a swept mass of a few blunt locks, one dominant lock rising to his right as seen from behind and the whole mass sweeping back toward the bike's tail from the side, with bangs falling over the forehead in front; he rides crouched low and forward over the tank; small blue eyes; a navy sleeveless top; one round light blue-grey pauldron on his left shoulder; bare upper arms and brown gauntlets; navy trousers and brown boots.
The Buster Sword rides on his back from above his right shoulder down past his left hip, the largest light shape in the race view.
He rides the Hardy-Daytona as the original draws it: a long, low, dark olive and black machine about one and a half times his height in length with fat wheels, a tall ribbed front cowl that reaches his chin, a ribbed rear fender and a red taillight under the sword.

Deliberate deviations:

| Original | Remake | Reason |
| --- | --- | --- |
| No ability of his own: like the other secret racers he picks a shared one on the Select Ability screen | Dash by default, the shared ability the longplay gives him; the player can pick any other | Every racer here needs a default; Dash is what the footage shows |
| Unlocked by the 5th Story clear, hidden behind Squall's slot (hold R1) | His own slot, available from the start | This remake has no Story Mode or Squall |
| No portrait: a black "?" icon in the HUD and results, Squall's portrait on the ability screen | A rendered portrait like every racer | The roster and HUD are built from 3D portraits |
| 90 MPH and "very bad" cornering, the same as Goblin; acceleration not stated | Goblin's driving stats (top speed, acceleration, loose grip, steering); no other tuning | The original gives him Goblin's numbers. In 540 all-CPU races with Dash he won 15.1% with a mean place of 3.56, where an even share is about 16.7% and 3.5 |
| No victory pose; he keeps riding after the finish | On a podium finish he sits up and rests the Buster Sword on his right shoulder; otherwise he slumps over the bars | Every racer here acts out win and lose reactions on the podium and after the finish, so his stay calm |
| No voice lines found | Short synthesized grunts | Every racer here has barks |
| The long bike's collision is unknown | The model is about 1.5 times his height long, as in the original, but the physics body stays the standard contact circle for size 1.05 (about 1.2 m radius) | Bumps and the start grid stay fair against shorter karts. In a nose-to-tail bump his front wheel or tail can overlap the other racer by up to about 1 m before they part; side bumps line up |

## Behemoth

Behemoth follows the PS1 in-game model, checked side by side against a Grand Prix played as him (chase view, GOAL fly-arounds and the racer select screen), not the CG ending.
The Behemo-Buggy 99 is a small tank, as the manual says ("powerful tank"): a camouflage-green hull, mint fenders with tan headlights, a mint "II II" grille, dark tracks with khaki pads, and two control levers with yellow-green knobs that he grips.
He hunches over it, much wider at the shoulders than the tank: purple fur with mauve patches on the backs of the shoulders, yellow stripes across the upper back broken by a row of red spines, a big low head with red horns, a yellow mane turning orange at the tips, pointed ears, big red-irised eyes, lower fangs, red claws and a tail hanging over the back of the hull.
The original shows no victory animation in a race; his Win clip, fists pumping over his head, comes from his Grand Prix ending movie.
His roster colour follows the model's purple.

## Mog

Mog follows the PS1 in-game model, checked side by side against two Grand Prix played as him (the chase view from behind, the GOAL orbit and the Select Racer screen), with the official model sheet for shapes only.
The Mog-Mobile R2 is a kick scooter: a long blue deck with a red and white panel on top and underneath, a black rear wheel, a small front wheel under a blue mudguard, a thin stem leaning back to a T handlebar with black grips just wider than his head, and a copper horn with an orange bulb.
Two orange batteries with black bands stand upright behind him; the model sheet draws one big battery, but the race view clearly shows two side by side.
Mog stands on the deck: a white ball of a head with small pointed ears and cheek tufts, closed eyes, a big pinkish red nose and a red-orange pom-pom on a short dark antenna, a blue neckerchief, small dark red bat wings, short arms with round paws on the grips and stubby legs.
In the race the pom-pom is red and the nose red; the CG art's yellow pom-pom and magenta nose are not used. The nose sits between the race view's red and the select screen's magenta.
His wings tremble while he rides and beat fast while he flies or celebrates. In the Select Racer screen he waves one paw, which his menu idle does too.

Deliberate deviations:

| Original | Remake | Reason |
| --- | --- | --- |
| No win or lose animation is seen in a race | On the podium he waves both paws and calls out with little hops; otherwise he lets go of the bars and droops | Every racer here acts out win and lose reactions |
| The scooter's motor is unknown | No exhaust smoke | A battery scooter has no engine smoke |

## Golem

Golem follows the PS1 in-game model, checked side by side against a Grand Prix played as him (chase view, racer select turn, podium) and the Story Mode Chapter 3 cutscenes, not the CG art.
The Rockin' Roller V8 is a small blue 4WD jeep, as the manual says ("4WD jeep"), even though its name suggests a road roller: a blue tub, a teal front face with round yellow headlights and five grille slots, a silver bumper, blue arches over the front wheels, four big black knobbly tyres, a light grey seat back, orange tail lights and two exhaust stacks at the back.
The front wheels steer on their own knuckles.
Golem is built from separate rounded boulders of rough grey-brown stone: a tall block head under a thick brim that overhangs a black face with two angry yellow eyes, huge round shoulder boulders whose tops sit level with his eyes, long rocky arms and big fists on the steering wheel, with red wristbands studded with white spikes.
His Win clip, one fist punched up and the other arm thrown out, is the pose he strikes on the podium and in the racer select screen.
His stone was matched region by region, by measuring lightness and hue in the PS1 frames and in the remake's under the game's lighting. In the chase view the original's shoulders measure about 53% lightness, the back 23% to 32% and the back of the head, a dark brown block, 16% to 19%; the remake measures 43% to 45%, 38% and 17%. In the racer select screen the original's shoulders measure 49% to 53% and its head top 43%, and on the podium its body measures 50%, its arms 36% and its head top 27%; the remake's menu view measures 46% for the shoulders and 30% for the head, so the head reads clearly darker than the shoulders from every side.
The stone is painted rough: lighter and darker faces split by thin dark cracks, with blotches and speckles, and no extra geometry.
His roster colour follows the model's stone.

| Deviation | Original | Remake |
| --- | --- | --- |
| Rear of the jeep | The low-resolution chase view shows a dark tailgate framed in blue, a pale bar on top and two orange shapes with copper pipes at its corners | A dark tailgate with a pale plate, a light grey seat back, orange tail lights and two exhaust stacks with copper tips, which also carry the boost flames |
| Wheel hubs | Grey in the game, orange in the CG ending | Grey |

## Black Magician

Black Magician follows the PS1 in-game model, checked side by side against two Grand Prix played as him (the chase view from behind, the GOAL orbit from the front, the Select Racer screen and the podium), not the CG ending.
The MagiCloud MK-1 is a small, flat white cloud of round puffs, blue-white in its shade, and he stands on it with his feet apart; in the GOAL view a white wisp rises between his legs.
He hovers, so Ice sheets and road dust pass under him, as before.
He wears a wide orange straw hat whose big, ragged brim droops all round, most at the back, where from the chase camera it hides most of the cone and reaches nearly to the top of the cape; the cone bends back at the tip, over a black face with two round yellow eyes.
A high purple collar hides the lower face and runs into a capelet over the shoulders and a wide cape down his back, which from the chase camera fills the space under the brim.
Below it is a round tunic in alternating cyan and pale yellow vertical stripes, gathered at the hips, with orange gloves, orange legs and shoes.
He carries a dark brown wooden staff with a fat curled head in his right hand: upright beside his hat on the Select Racer screen and over his shoulder from behind, waved overhead on the podium.
Colours were measured region by region in the PS1 frames and in the remake's under the game's lighting: the cape is hue 259 at 36% lightness in the original's chase view and hue 258 at 34% in the remake.
The hat is hue 35 and fully saturated orange on the Select Racer screen but a hue 43 ochre at 63% saturation in the chase view; the remake's rough straw sits between them, nearer the chase view, at hue 40, 43% lightness and 77% saturation there.
His eyes glow, through a small emission mask baked by the pipeline, and so does the cloud a little, so its shaded side stays pale.

| Deviation | Original | Remake |
| --- | --- | --- |
| Hat colour | Bright orange on the Select Racer screen and the podium, a duller ochre in the chase view | One straw orange between the two |
| Win and lose | The podium shows the staff raised and the free hand up; no race animation is seen | The podium pose as his Win clip; a slump with his arms hanging as Lose |
| Cast | Not seen; Magic Plus is passive | Raises the staff overhead with both arms, as every racer acts out its ability |
| Puffs behind the cloud | White puffs trail from the cloud | The shared exhaust smoke leaves the back of the cloud |

## Magic Stones

The stones follow footage of the original on six courses (Moogle Forest, Floating Gardens, Gingerbread Land, Vulcan-O Valley, The Black Manor and Fantasia), read frame by frame where stones are passed and picked up.
In the original every stone is an opaque, glossy low-poly ball in one body colour, with a large flat symbol painted on the side facing the camera.
The symbol rocks gently from side to side; the ball neither spins nor bobs much, and it floats about half its diameter over the road above a soft dark blob shadow.
The remake draws the same thing: a toon-shaded ball with a three-band light from the upper left, a crisp white highlight, a darker rim and the symbol as an anti-aliased distance field, so it stays sharp at any distance.

| Stone | Original | Remake |
| --- | --- | --- |
| "?" | Black ball, thick yellow question mark | Same |
| Fire | Red ball, orange flame with a yellow-white core | Same |
| Ice | Royal blue ball, a cut ice crystal seen point on: a tall diamond in four facets, pale upper left, cyan upper right, teal lower left, navy lower right | Same |
| Thunder | Green ball, yellow lightning bolt | Same |
| Haste | Turquoise ball, magenta upward arrow that darkens to purple down the stem | Same |
| Mini | Greyish lavender ball, a little navy-outlined man with pale limbs, arms out and legs apart, and navy marks above him | A plain standing man with a round head, arms straight out and legs apart, so he reads as a person at race-camera distance; the blurry marks above him are left out |
| Reflect | Magenta-pink ball, glowing violet disc with a white arrow bouncing off it | Same |
| Doom | Dusty rose ball, grey-white skull | Same |
| Ultima | Olive-gold ball whose face is a centred slate-blue disc filled by a pale blue-white burst of about 16 rays around a white-hot heart, inside an even gold ring | Same; Ultima and Mini only roll and never sway, so the disc and the man stay in the middle of the ball |

Ice, Mini and Ultima were first read from blurry frames and are now set from decisive references.
The clearest is a 1080p Grand Prix played as White Mage (https://www.youtube.com/watch?v=VTdC1giA0Tc), where her held stone rolls large right under the camera:

- Ultima: in The Black Manor, lap 3 (video 7:38 to 7:44, race time 2'46" to 2'52"), she picks the gold starburst stone, casts it, and blue pillars of light strike the field. The Final Fantasy Wiki shows the same pillars from another Black Manor race and labels a held gold starburst stone "Ultima". The same stone sits on the road in Moogle Forest and The Black Manor, so Grand Prix sets include Ultima.
- Mini: in Floating Gardens (8:20, race time 0'10"), a "?" stone turns into the lavender stone with the navy man; she casts it a second later and cherubs fly in beside the rivals, which is how Mini is delivered (the Final Fantasy Wiki's Magic Stone page: "a small angel appears and reduces the size of all racers"). The stone the earlier pass read as Ice (Vulcan-O Valley, a lavender ball with a navy snowflake-like figure) is this Mini stone.
- Ice: the royal blue crystal stone passes at full size in The Black Manor (6:02), and she holds it for 15 s. Its cast is behind her and off screen, so Ice is identified from the manual art: of all stones only Ice is drawn as a blue ball with a cyan ice crystal. The earlier pass read this stone as Mini.
- Haste: the turquoise arrow stone is unchanged; it passes at full size in Floating Gardens (8:20), and casting it gives a speed burst.

The English manual (pages 18 and 19, archive.org item chocobo_racing_english) pictures every stone as a pre-rendered glass ball: Ice deep blue with a cyan ice crystal, Mini purple-grey with a standing figure, Haste turquoise with a magenta arrow and Ultima gold with a white starburst. Its colour labels read Ice "blue", Mini "purple" and Ultima "white". The in-game textures are simplified versions of these pictures, so the remake follows the in-game textures and uses the manual only to name each stone.

On pickup the held stone appears at once, and the track stone turns into a bright additive smear of its own colours that swells and fades within about five frames.
The remake bursts the stone the same way over 0.22 s and drops the earlier star sparkles.
In the original a taken stone leaves an empty slot, and the slot is full again by the next lap, sometimes with a different kind. The refill itself is never on screen; the remake keeps its fixed kinds and 3.5 s respawn and grows the stone back in over 0.25 s.
Held stones in the original roll on the road in a short chain right behind the racer's rear wheels, about half a track stone across, symbol facing the camera.
How the chain behaves, how stacks level up and how they flash is in "Spell stack" below.
The original HUD shows no held-stone icons, and the remake now matches it: it has no MAGIC panel, and held stones show only as the chain rolling behind the racer.

Deliberate deviations:

| Original | Remake | Reason |
| --- | --- | --- |
| Rows hold five stones on the roads seen in footage | Rows keep three to five lanes per course | Lane counts are gameplay layout, outside this visual pass |
| Ultima stones also lie on the road in Grand Prix races on Moogle Forest and The Black Manor | Only Fantasia lays Ultima stones | Stone sets are gameplay layout, outside this visual pass |
| Symbols are low-resolution textures | Symbols are drawn per pixel | Crisp at phone and desktop resolutions |
| Slots refill within a lap, possibly with another kind | Fixed kinds and a 3.5 s respawn | Keeps the existing simulation |

All track stones draw in three instanced draw calls (stones, shadows and pickup bursts, the last only while a burst plays) and every racer's held stones in one more, plus one for the level 3 flashes and rings while any racer holds a level 3 stack.

### Spell stack

These rules were checked against the manual (pages 14, 18 and 19), the Story tutorials (every chapter's dialogue in a full playthrough, https://www.youtube.com/watch?v=rFEEId_J4SI), the GameFAQs guides and footage read frame by frame: a Story chapter 2 race in Moogle Forest with only Haste stones (https://www.youtube.com/watch?v=lw-HoHbH43g), a Goblin race with Magic Plus, a Chocobo Grand Prix where a CPU Goblin mugs the player, Chubby Chocobo's Grand Prix and a White Mage Grand Prix.

- A racer holds up to three stones and casts the latest first (manual, Story chapter 2, every FAQ).
- A stone picked up right after a matching one is absorbed into it: "the second and third Stones will become a part of the first Stone" (manual).
  A stack looks like one stone, so three Haste pickups in Moogle Forest leave one held ball (about 22 s, 32.6 s and 44.8 s in the chapter 2 race).
- Every stone in a stack still takes a place: "if you have collected 3 FIRE Stones ... you won't be able to pick up any more Stones until you cast it" (manual).
  The remake lets a racer drive through stones while full.
- Reflect and Doom never power up; Fire, Ice, Thunder, Haste, Mini and Ultima do (manual).
- A "?" stone becomes its spell the moment it is picked up; the held ball shows the real stone at once (White Mage Grand Prix, 8:20).
- The chain starts right at the rear wheels with the oldest stone, and each newer stone rolls nearly touching the one before it; the backmost stone is the one cast next (Chubby Chocobo's Grand Prix, 1:52: Thunder under the kart, then two newer stones; the backmost goes first).
- A stack shows its level with light that moves.
  At level 2 a bright white band about a quarter of the ball high sweeps down the ball from top to bottom in about 0.3 s, once every 0.53 s (Moogle Forest, 37.5 s to 44.4 s and 63.07 s to 63.43 s frame by frame; the same band on Goblin's Fire after Magic Plus).
  At level 3, once every 0.44 s, a white disc swells out of the ball to about 1.3 times its radius over four frames, then opens into a pale yellow ring that grows to about 1.5 times the radius, turns yellow-green and fades within about four frames; a quicker band sweeps down the ball just before the next flash (Moogle Forest, 45.25 s to 45.85 s frame by frame).
  A level 1 stone is steady.
  The FAQ's "blink" and "blink rapidly" describe this.
- Magic Plus raises the backmost stack by one level (FAQ, and the band that starts sweeping Goblin's Fire after the trigger).
- Mug takes the latest stack whole: a CPU Goblin's Mug takes the player's flashing level 2 Thunder and leaves nothing (Chocobo Grand Prix, 5:37).
  In the remake the thief gets the stack at its level and loses the stones that do not fit.
- A rival steals by bumping into the racer from behind (manual, Story chapter 2).
  In the remake a racer whose body touches a held stack takes it whole, which with the chain at the rear wheels is a bump from behind.

Deliberate deviations:

| Original | Remake | Reason |
| --- | --- | --- |
| The chain snakes along the racer's past path through corners | The chain is a straight line behind the racer's direction of travel, eased so it sways a little | The simulation places the stacks for stealing, and a path history would add racer state to every network update |
| The level 2 band follows the ball's curve | The band is level across the screen | Reads the same at held-stone size |
| No source shows what Mug does when the thief has less room than the stolen stack | The stones that do not fit are lost | Same rule as every other way of gaining stones |
| No source shows Magic Plus on a full inventory, a level 3 stack, Reflect or Doom | Magic Plus waits until the latest stack can rise | Keeps the charge for a stone it can raise |

## Ability effects: Dash, boosts, Charge, Flap and Megaflare

These effects follow PS1 footage read frame by frame: Chocobo, Cloud, Chubby Chocobo and Black Magician using Dash, three Haste casts, Behemoth's Grand Prix with five Charges and a ram, Mog's Grand Prix with thirteen Flaps, Bahamut's four Megaflares as the player and a CPU Bahamut's Megaflare hitting the player in Story Mode.
Everything they draw is a flat additive sprite rebuilt every frame, as on the PS1, and all of it goes into one batch in `src/gfx/effects/abilities/`, so these effects together cost one draw call.
Colours, sizes and phase times live in `abilities/looks.ts`.

Every boost in the original shows the same layout: two mirrored fans of spikes on the road either side of the racer, flat along the road and rising to about 70 degrees, white at the root and coloured at the tips, re-rolled every frame and always facing the camera.
The racer's whole model is tinted for the whole boost and the tint cuts off in one frame when it ends: Chocobo's yellow (#f3a608) reads tan (#b08857) mid-Dash, Chubby Chocobo's white reads mint under Haste, and Behemoth's purple reads red-magenta (#7c2640) under Charge.
The colour says what the boost is: blue-white for Dash, green for Haste and yellow-orange for Charge.
The earlier note that Haste makes the blue-white fan came from a Dash; the Haste stone's fan is green.

| Effect | Original | Remake |
| --- | --- | --- |
| Dash start | Blue-violet tint in one frame, a cross of white lines on the road, a lavender glow spreading round the racer, then a white-hot core with long pink rays and dust puffs | Same, in that order, over the first 0.95 s |
| Dash running | Blue-white fans, 6 to 8 spikes a side, about 2.8 racer widths wide | Same, 8 spikes a side |
| Dash end | The tint cuts off, the fans hold three frames and fade over 0.13 s | Same |
| Start dash | The Dash burst without the fans | Same; Spin Dash uses it too |
| Haste | A thin blue-white ring for a few frames, a green tint and green fans | Same, at every level |
| Charge | Yellow-orange fans on the first frame, a light column, a pink dome crossed by a flare line, a white-pink flash and long rays, over a red tint; the fans swell every 0.37 s; a hard cut at the end | Same, fitted into the 1 s Charge |
| Charge ram | Sparks at the contact point, stars and blue twinkles round the victim | Same |
| Flap start | A white cross flare, a glowing ball with pink rays, the wings appearing inside it already full size as a raised V | Same, over 0.9 s |
| Flap running | Two glowing wings of pink and white feather plumes, 6 to 7 body widths across, beating 1.9 times a second with a slow sweep down and a snap back up; Mog floats about a body height up | Five plumes a wing with a white quill, bright barbs and a violet halo; same beat and height |
| Flap end | The wings turn pale lilac and fade over 0.75 s while Mog drops back | Same, over 0.6 s |
| Megaflare on Bahamut | A glow and cross flare, a ring of red-rimmed fire orbs on the road that spreads, then beams shooting straight up | Same, over the first 0.92 s |
| Megaflare warning | Starburst shots fall from the sky ahead of each rival, about ten a second, and burst on the road beside them | Same |
| Megaflare strike | A frame of yellow flame starburst, a fire cone with tall red streaks, smoke and falling stars; the victim falls back charred | Same; the victim is tinted fire orange for 1.4 s |

Deliberate deviations:

| Original | Remake | Reason |
| --- | --- | --- |
| Dash lasts about 3.7 s, Charge 1.7 s, Flap 10 s, and the Megaflare warning about 2.6 s | Each effect's phases are scaled into the remake's 2 s Dash, 1 s Charge, 5 s Flap and 1.5 s warning | Timings are gameplay and stay as balanced |
| Fans are camera-facing sprites, so a racer seen side-on shows two full fans | The fan over the racer's nose shrinks when seen from the side, so it reads as a half sunburst behind | Matches how a charging Behemoth looks from the side in footage, and keeps a 3D racer's face clear |
| Boost pads and Spin Dash were not found in footage | Pads show the Dash fans without the burst; Spin Dash shows the start dash burst | Every boost keeps the original's one boost layout |
| Megaflare throws the victim straight up out of view | The existing heavy-crash tumble | The crash reactions are shared by every hit |
| The old remake drew flame jets from the exhausts and ribbon trails under every boost | Removed | The original shows no exhaust flame, trail or blur on a boost |

## Ability effects: Grip-Up, Mug, Magic Plus, Barrier and Receive

These follow PS1 footage read frame by frame: Golem's two Grand Prix runs (17 Grip-Ups), Goblin's Grand Prix (14 Mugs) and a Chocobo run where a CPU Goblin mugs the player about every 20 s, Goblin and Black Magician with Magic Plus (7 triggers), a White Mage Grand Prix with Barrier (9 raises, 3 blocks) and Chubby Chocobo's Grand Prix (8 catches).
They draw into the same flare batch as the effects above, so they add no draw call of their own; stones carried by Mug's helper or caught by Receive add one while they are on screen, and Mug's helper adds six (its body and two legs, each with an ink outline) while it is on screen, about 1.6 s per Mug.
Colours, sizes and phase times live in `abilities/looks.ts`, next to the others.

Grip-Up, Mug, Barrier and Magic Plus open with the same flash in the frame after the gauge empties: a thin white cross of light through the racer, a pale disc with a violet rim about twice the kart's width, the racer washing out to white, then the disc pulling in to a white ball while thin white and pink rays shoot out.
The remake draws it with the same `activationBurst()` as Dash (`abilities/burst.ts`), facing the camera, with one `BurstLook` per ability: Mug's is softer and lavender, and Magic Plus's spreads to three or four racer widths. Dash keeps its cross and glow flat on the road, as its footage shows.

| Effect | Original | Remake |
| --- | --- | --- |
| Grip-Up start | The flash, then a thin pink ellipse at each side at hub height, flung out a kart width as crescents with streaky trails, then snapped back in within 2 to 3 frames | Same, 1.3 to 2 s after use |
| Grip-Up running | One magenta ring per side wrapping the wheels, a white outer rim, a jagged and streaky inner edge fading to clear, alpha blended; its height pulses every 0.5 s | Same, drawn as camera-facing crescents with the hollow side toward the kart |
| Grip-Up end | A smooth fade over 8 frames | Same, over 0.27 s |
| Mug, thief | The flash; a little goblin with purple spiky hair, one big eye, an orange vest and dark legs pops up beside the kart, hops off the right of the screen, and comes back from the left 0.6 s later carrying the stone, which joins the line 1.57 s after use | Same: the helper is a small toon model with an ink outline, and the stone stays hidden in the line until it arrives |
| Mug, victim | The held stone vanishes in one frame inside a thin near-white ring that widens and turns pink; the helper runs past from right to left | Same |
| Mug with nobody to rob | The helper comes back with a stone all the same | Same |
| Magic Plus | The wide flash; then a green U-shaped curtain drops from high above, narrows to a thread and ends on the raised stone with a glint; the stone flips to flat black every frame for 2.9 s | Same; the stone flickers 12.5 times a second |
| Barrier raise | The flash, with a darker blue-violet halo | Same |
| Barrier up | Nothing stays on screen: every 0.71 s a frosty pale-cyan bowl rises from the carpet, closes into a nearly opaque white oval round her, lifts off as a cap with a small ring on top and leaves a clear cyan sphere that fades in 0.3 s; small sparkle crosses near the carpet between pulses | Same |
| Barrier block | The spell's own effect plays, she rides on, at most one more pulse plays and the Barrier is gone; no block sprite | Same |
| Receive waiting | Nothing on the racer | Same |
| Receive catch | A white orb swells above his head on a faint light pillar, with a horizontal streak on the road, a lavender glow and pink rays round him; the orb clears with a cross flare to show the caught stone, which hovers and sinks to the end of his line about 1.7 s after the hit | Same, with the same timing |

What a rival sees: no footage shows a CPU Golem, Goblin, Black Magician, White Mage or Chubby Chocobo using these abilities in view of the player.
The remake draws every one of them in the world round the racer, so a rival behind or beside sees the same sprites at its own distance, and the Studio shows each from the chase camera, the side and 20 m behind.
The black flicker the earlier Magic Stones notes described is the Magic Plus trigger.
A stack's own level shows as a sweeping band or a growing ring; see "Spell stack" above.

Deliberate deviations:

| Original | Remake | Reason |
| --- | --- | --- |
| Grip-Up shows its rings for about 10.2 s | The rings last the remake's 7 s Grip-Up | Timings are gameplay |
| Barrier pulses for as long as it stays up | The 4 s Barrier pulses from 1.3 s after it rises, about four pulses | Timings are gameplay |
| The Mug helper is a 2D sprite seen from one angle | A small 3D model; each leg of its trip is drawn in the frame of the racer it visits | It has to read from any camera, and a victim far ahead must see it pass |
| The Magic Plus stone flips black every 30 fps frame | It flickers 12.5 times a second | A 15 a second blink can line up with a 30 fps or 60 fps frame clock and vanish |
| Receive is usually caught after the hit reaction | The catch plays without a crash | Receive cancels the hit in the simulation |

Gameplay differences found, left unchanged for a later decision:

- Barrier: the original has no timer. It stays up until it blocks one spell or the race ends (up to at least 31.7 s in footage), and the gauge refills only after it ends, so the next Barrier comes 15 to 16 s after the last one went down. The remake raises it for 4 s and recharges in 16 s.
- Receive: in 5 of the 7 catches checked, Chubby still spun out or was launched, then got the stone. Only two catches of one spell showed no slowdown. The remake cancels the hit.
- Grip-Up: the original lasts about 10.2 s and its gauge refills only after it ends, a cycle of about 19 to 20 s. The remake lasts 7 s and recharges in 11 s.
- Magic Plus: the original fired every 12.75 s while a stone was held. The remake recharges in 20 s, as measured in all-CPU races.
- Mug: the stolen stone reaches the thief 1.57 s after use in the original. The remake moves it at once and only hides it until the helper arrives.

## Goblin

Goblin follows the PS1 in-game model, checked side by side against two Grand Prix played as him and a Cid's Test Track run (the chase view from behind, the GOAL orbit and the Select Racer screen), with the official model sheet for shapes only.
The Gob-Cart H4 is a wooden mine cart, as the manual says: an open box of light planks with riveted grey iron posts at the corners, four big wooden disc wheels outside the box with iron axle caps, a lantern hanging from the middle of the front wall, and a drum with a crank bar inside the front wall.
The code-built cart it replaced was a flat plank wagon with black rubber tyres and a steering wheel.
Goblin sits in the box: tan skin, a red-orange helmet whose rolled rim frowns down over big round eyes, a big round nose, long pointed ears, a magenta-violet mane that fills the space between the helmet and the rim from behind, a green chest band, a bandaged left hand, a bracelet on the right wrist and a wooden club in his right fist.
The code-built Goblin was green-skinned with a red cap; the game's model is tan, and his roster colour is now the helmet's red-orange.
Colours were measured on the PS1 frames and on ours under the game's lighting: helmet hue about 18, mane hue about 305, planks hue about 42.
In the Select Racer screen he shakes his club beside his head, which his menu idle does too.

Deliberate deviations:

| Original | Remake | Reason |
| --- | --- | --- |
| The pencil sketch draws a tapered hopper on flanged rail wheels | A straight box on plain disc wheels | The game model and the CG model sheet use the straight box |
| The helmet is a tall, boxy dome with a pale stripe, over a mane about as wide as the helmet is tall | The same tall, boxy helmet with a pale stripe over the crown, a little taller than the CG sheet's rounder dome | The race view is the reference; the CG dome is lower |
| No win or lose animation is seen in a race | He shakes the club and pumps his fist on the podium, and slumps over the bar when he loses | Every racer here acts out win and lose reactions |
| The cart has no engine | No exhaust smoke | A push cart has no engine smoke |

## White Mage

White Mage follows the PS1 in-game model, checked side by side against a Grand Prix played as her (the chase view from behind, the Select Racer screen and the podium), with the official model sheet for shapes only.
She wears no hood: the game shows a big bob of magenta hair with bangs swept to her left, a tuft on the crown and a blue hair tie with a green tuft on the left of the crown, a round face with big green eyes and pink cheeks, a white poncho-like robe with wide bell sleeves, red triangle trim on the hem and the cuffs, a thick white cowl, a gold pendant, cream boots and red shoes, and a gold staff with a blue orb.
The code-built White Mage it replaced was the generic Final Fantasy white mage, with a hood with cat-ear points and red triangles round the face and brown hair under it.
She sits on the carpet with her legs folded in front of her and the staff across her lap, the orb out past her right side, and the carpet floats about half her seated height above the road.
The Cosmic Carpet is a white field split by its diagonals into yellow left and right triangles and white front and back ones, with thin green lines on the diagonals, a thick red border and corners that curl up.
The code-built carpet was dark red and purple with gold stars and four gold tassels.
Colours were measured on the PS1 frames and on ours under the game's lighting: hair hue about 326 lit and a dark wine in the shade round the nape, the robe a near-neutral white.
Her roster colour, used for her minimap dot, is now the hair's magenta instead of the robe's cream, which was hard to tell from Mog's white.

Deliberate deviations:

| Original | Remake | Reason |
| --- | --- | --- |
| The carpet looks rigid | It ripples from front to back and bobs, more as she goes faster | A flying carpet reads better moving; the shape and pattern are the original's |
| The carpet flies level | It flies a little nose-up | The remake's chase camera sits lower than the original's, and the tilt shows the carpet's top as the original's view does |
| The robe's red hem trim shows all round when she stands on the podium | Seated, only a thin line of red shows at the back | In the chase view from behind no red hem shows; the robe is tucked under her |
| Her race and select-screen holds of the staff differ slightly | One hold, across her lap with the orb out to her right | The chase view, which matters most, shows the orb at her right side |
| No win or lose animation is seen in a race | She waves the staff and her other arm on a win, as on the podium, and slumps when she loses | Every racer here acts out win and lose reactions |
| The carpet has no engine | No exhaust smoke; boost flames trail from the back corners | A carpet has no engine smoke |

## Technology choice

| Option | Decision |
| --- | --- |
| Three.js | Retained for direct control of code-built 3D scenery, vehicle geometry and cameras. |
| Phaser | Suitable for a 2D or pseudo-3D racer. Its authoritative multiplayer tutorial supports separating client input/rendering from server rules, but this project uses 3D geometry. [5] |
| Colyseus | Strong alternative for room schemas and property-level state synchronization. Useful if bandwidth and persistent matchmaking justify migration. [6] |
| Socket.IO | Retained for rooms, acknowledgements, reconnects and WebSocket fallback. It does not guarantee delivery of every event after disconnect. [7] |
| Raw WebSocket | Smaller transport, but this application would need its own reconnect, heartbeats, room operations and acknowledgements. [9] |
| WebRTC | Not chosen. Unreliable snapshots may help competitive racing, but signaling and connectivity add work. |
| Full rigid-body physics | Not required for the current arcade solver. Movement is genuinely free, but uses a planar vehicle model projected onto the road's height. |
| HTML UI | Semantic buttons, selects and event delegation keep the simulation independent of UI rendering. |

The stack is TypeScript, Three.js, Vite, Node.js, Express, Socket.IO, Web Audio, Vitest and Playwright. The lockfile pins installed packages.

## Simulation and multiplayer practices

### Fixed timestep

Fiedler's accumulator design separates physics frequency from rendering frequency. Bounding elapsed time also prevents excessive catch-up work. [10]

The simulation in `shared/game/` runs at 60 Hz. Local races run in the browser; online races run on the server. Both use the same code. Seeded random choices make repeatable tests possible. The browser uses requestAnimationFrame for display and caps accumulated frame time.

The solver advances world-space velocity and position. It does not set the player's heading to the road tangent. Projection determines route progress, surface, recovery and lap validation. A player can turn around, drive straight past a corner or leave a cliff. Sequential checkpoints prevent those shortcuts from awarding a lap.

### Authority and validation

Online clients send only steering and button state. The server owns positions, pickups, hits, inventory, lap gates, finish times and ranking. Client-supplied coordinates have no effect. Host checks protect configuration, starting and rematching. Inputs must contain finite bounded steering and strict booleans.

The server limits rooms to six members and 100 active rooms. It bounds message size, connection count, action frequency and input frequency. It sanitizes names and uses own-property checks for course IDs. Origin validation follows an explicit allowlist or matching Host rule. OWASP recommends origin validation, message-level authorization, payload validation and rate limits for WebSocket applications. [15]

### Snapshots and latency

Snapshot buffering trades display latency for smoother arrival jitter. Extrapolation becomes unreliable around collisions. [11]

The client predicts its own driving with the same shared driving code and reconciles to the server's authoritative state, replaying outstanding inputs for at most 250 ms. Remote vehicles interpolate world position and heading by simulation time with a 70 to 140 ms jitter-aware buffer and at most 100 ms extrapolation. Recovery teleports snap instead of interpolating through scenery. See `multiplayer-performance.md` for the measurements.

Snapshots are volatile; room operations use acknowledged requests with visible errors. WebSocket transport still has TCP head-of-line blocking. This release targets LAN or nearby-server play, not high-latency competitive racing.

### Reconnection

Socket.IO warns that recovery can fail, so applications must handle resynchronization explicitly. [8]

The server gives each player a secret separate from their visible ID. Session storage preserves it across reloads. Reconnecting within 60 seconds restores the racer and current room snapshot. AI drives disconnected racers. The host transfers to a connected player. A one-second watchdog clears stale controls. Restarting the server clears in-memory rooms; the client reports expiry rather than leaving the player on a frozen race screen.

This is one Node process. Multiple independent replicas would split room state. Horizontal deployment needs explicit room routing and shared session design.

## Browser practices

### Rendering and resources

MDN recommends reducing draw calls and controlling drawing-buffer resolution. Three.js requires explicit disposal of unused GPU resources. [12][13]

Scenery and rigid vehicle parts merge by material. Low-segment geometry, simple lighting and contact shadows avoid expensive postprocessing and shadow maps. High quality caps pixel ratio at 1.5; low uses 1; retro uses 0.65. Course changes dispose geometry and textures. Cameras follow actual vehicle position and heading. The renderer resizes with the viewport and reports context loss.

`window.__raceDebug` returns a deep clone of telemetry. It exposes state and render counters for tests, not a mutation interface.

### Input and audio

The Web Audio guidance recommends starting or resuming sound after user interaction and providing sound controls. [14]

Audio is synthesized locally after a gesture, with a persistent mute option that also stops the engine loops. No Square Enix recordings or melodies are bundled. Text inputs do not consume race shortcuts. Pointer capture supports simultaneous steering and throttle on touch devices: the left thumb steers proportionally on a stick that floats to wherever it lands and drives or brakes when pushed up or down past a wide dead zone, and the right thumb can slide between DRIVE, DRIFT and BRAKE without lifting. Spell and ability taps remain active for 150 ms so they cross a simulation/network tick. Blur and visibility changes clear input. Local race menus pause simulation; online menus do not pause the room.

Manual acceleration is the default. Auto-accelerate is an option, not automatic steering. Keyboard and touch paths are tested separately. Gamepad mappings exist but physical-controller validation is not claimed. Modal focus handling and labeled controls help menu accessibility, but the game is not nonvisually playable.

## Deployment

Use HTTPS/WSS for internet hosting, forward WebSocket upgrades, and configure `ALLOWED_ORIGINS` explicitly behind a reverse proxy. A static host alone cannot run multiplayer. Local racing needs no socket connection after the app loads. Durable accounts, moderation, infrastructure abuse protection and persistent ranked records are outside this release.

See `testing.md` for the current validation record. Version 1 results do not validate this rewrite.

## Sources

1. Original manual, full indexed text: https://manualmachine.com/gamessonypspsx/chocoboracing/1175876-user-manual/
2. HighVoltage103, Chocobo Racing FAQ: https://gamefaqs.gamespot.com/ps/196911-chocobo-racing/faqs/74730
3. Beno Jange, guide and walkthrough: https://gamefaqs.gamespot.com/ps/196911-chocobo-racing/faqs/8434
4. Fierydevil, Chocobo Racing FAQ: https://gamefaqs.gamespot.com/ps/196911-chocobo-racing/faqs/4958
5. Phaser authoritative multiplayer tutorial: https://phaser.io/news/2019/03/creating-a-multiplayer-phaser-3-game-tutorial
6. Colyseus state synchronization: https://docs.colyseus.io/state
7. Socket.IO delivery guarantees: https://socket.io/docs/v4/delivery-guarantees/
8. Socket.IO recovery limitations: https://socket.io/docs/v4/connection-state-recovery/
9. ws repository: https://github.com/websockets/ws
10. Glenn Fiedler, Fix Your Timestep: https://gafferongames.com/post/fix_your_timestep/
11. Glenn Fiedler, Snapshot Interpolation: https://gafferongames.com/post/snapshot_interpolation/
12. MDN, WebGL best practices: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
13. Three.js cleanup guidance: https://threejs.org/manual/en/cleanup.html. Search-index text was available; the direct page fetch failed.
14. MDN, Web Audio best practices: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
15. OWASP, WebSocket security: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html
