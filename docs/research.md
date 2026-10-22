# Research and implementation decisions

## Correcting the reference

The first build mixed Chocobo GP ideas with a simplified lane racer. That was not a faithful recreation of Chocobo Racing. Version 2 specifically targets the 1999 PlayStation game. It replaces the old simulation, roster, courses and interface.

The original manual describes separate accelerator, brake and reverse controls. Steering turns the vehicle freely. Holding accelerator and brake while turning starts a drift; excessive drifting causes a spin. A release-and-repress technique recovers with a Spin Dash. The start boost depends on accelerator timing. Abilities can be selected independently of racers. Grand Prix has six competitors and four rounds. Time Attack removes stones and rivals and can replay saved driving as a Phantom Racer. [1]

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
| Inventory | Three stones trailing behind the racer, LIFO use, matching stones merged into one stack up to level three with every stone still taking a place, theft by driving into a trailing stack | Numeric timing and some defensive interactions are interpretations |
| Magic | All eight main spell families, per-course stone sets from the original's Story chapters in fixed-colour lanes, position-weighted "?" stones, targeting by race progress, the original's three hit tiers with a 2.5 s safe window, single-target Mini in 25% steps, Doom transfer, and CPU casting habits per character | Cid's Test Track has Moogle Forest's stones, where the original's first course had none. Durations are hand-tuned; no original effect assets |
| Abilities | Dash, Flap, Grip-Up, Mug, Magic Plus, Barrier, Receive and Charge with the original's recharge times; each racer defaults to its own, and the player can choose another | Magic Plus recharges in 20 s and Charge in 14 s, both measured in all-CPU races. Dash lasts 2 s and Charge 1 s, shorter than the original, because boosts are worth more with this grip model. Barrier is a timed 4 s shield |
| Race classes | Chocobo, Behemoth and Bahamut Class set CPU pace, cornering, brake taps, hazard misreads and shortcut use; Bahamut also makes every racer 10% faster. Mild catch-up keyed on the leading human | Every class is available from the start |
| Courses | Per-course boost pads, mud and slick patches, jump ramps with airtime, a gap, shortcuts that count the road they skip, and timed hazards that warn before they strike | Newly authored placements inspired by the original's gimmicks |
| Grand Prix | Four local rounds, cumulative points, next grid follows finishing order, final champion, at the chosen class | Courses proceed from the selected course through the next three; no difficulty-class unlocks |
| Time Attack | Solo race with no pickups, saved best-race ghost and interpolated replay of actual recorded positions | Browser-local saves, configurable lap count, no memory-card import |
| Versus | Player against one selected CPU rival | No split-screen or second local controller |
| Online | Six-player private rooms with AI fill, authoritative simulation, recovery and rematches | Browser addition, not emulation of the original multiplayer |
| Presentation | Gold title, blue beveled menus, animated portrait order, MPH, stone slots, ability gauge, minimap, one callout at a time, a finish sequence with slow motion, orbit and podium, and synthesized engines, spell sounds and character barks | Newly authored interface, fonts, synthesized music, sounds and scenery |

Not implemented: Story, Relay, secret characters other than Bahamut and Cloud, the F.F.VIII Circuit bonus course, custom stat editing, original cutscenes, original soundtrack, exact maps, split-screen, public matchmaking or ranked online leaderboards. The in-game About screen states these limits.

## Bahamut

Bahamut follows the PS1 in-game model, checked side by side against footage of the original (a Bahamut race on Cid's Test Track and the Fantasia cutscenes), not the CG art.
He has no vehicle and flies on his own wings: membranes navy on top, as the race view from behind shows, and maroon underneath, as the cutscene front view shows, a blue head with a heavy brow, small eyes and short upswept horns, a green plated chest, blue thigh plates and upper arms, mint shins, feet and arm undersides, yellow claws and a tail that hangs between his legs.
The blue orb often seen under him in the original's race view is his held Magic Stone, which changes colour with the stone and is absent when he holds none; this remake trails held stones behind every racer instead.

Deliberate deviations, kept for balance or because the remake lacks the original's modes:

| Original | Remake | Reason |
| --- | --- | --- |
| Megaflare charges in about 45 s | 80 s | In all-CPU races, 45 s won Bahamut 63% of races; at 80 s he wins 34%, level with Chubby Chocobo |
| Megaflare is a hard crash | Every rival is thrown into the air with the heavy-crash reaction but stalls for the 1.6 s crash time, not the 2.4 s heavy crash | Same balance runs: the heavy crash kept him above a third of wins even with a 100 s charge |
| The first flare shots always miss | A fixed 1.5 s of falling warning shots before the strike | Gives the same warning without random misses in the deterministic simulation |
| Unlocked by finishing Story Mode | Available from the start | This remake has no Story Mode |
| Held stones float under him | Held stones trail behind him like every racer | The remake's shared stone-stealing rule depends on stones trailing |

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

## Golem

Golem follows the PS1 in-game model, checked side by side against a Grand Prix played as him (chase view, racer select turn, podium) and the Story Mode Chapter 3 cutscenes, not the CG art.
The Rockin' Roller V8 is a small blue 4WD jeep, as the manual says ("4WD jeep"), even though its name suggests a road roller: a blue tub, a teal front face with round yellow headlights and five grille slots, a silver bumper, blue arches over the front wheels, four big black knobbly tyres, a light grey seat back, orange tail lights and two exhaust stacks at the back.
The front wheels steer on their own knuckles.
Golem is built from separate rounded boulders in warm taupe stone: a tall block head under a thick brim that overhangs a black face with two angry yellow eyes, huge round shoulder boulders, long rocky arms and big fists on the steering wheel, with red wristbands studded with white spikes.
His Win clip, one fist punched up and the other arm thrown out, is the pose he strikes on the podium and in the racer select screen.
His stone colour was set by measuring the chase view: the original's lit stone samples at about hue 26 to 37 and 70% lightness, and the remake's at hue 28 to 29 and 66% to 68% once self-shadowing is left out.
His roster colour follows the model's stone.

| Deviation | Original | Remake |
| --- | --- | --- |
| Rear of the jeep | The low-resolution chase view shows a dark tailgate framed in blue, a pale bar on top and two orange shapes with copper pipes at its corners | A dark tailgate with a pale plate, a light grey seat back, orange tail lights and two exhaust stacks with copper tips, which also carry the boost flames |
| Wheel hubs | Grey in the game, orange in the CG ending | Grey |

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

Audio is synthesized locally after a gesture, with a persistent mute option that also stops the engine loops. No Square Enix recordings or melodies are bundled. Text inputs do not consume race shortcuts. Pointer capture supports simultaneous steering and throttle on touch devices: the left thumb steers proportionally on a pad that floats to wherever it lands, and the right thumb can slide between DRIVE, DRIFT and BRAKE without lifting. Spell and ability taps remain active for 150 ms so they cross a simulation/network tick. Blur and visibility changes clear input. Local race menus pause simulation; online menus do not pause the room.

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
