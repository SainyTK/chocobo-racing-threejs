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
| Driving | World position, heading, velocity, lateral grip, acceleration, braking, reverse, drifting, wall response, falls and recovery | Hand-tuned arcade solver, no bit-for-bit physics match |
| Race validation | Twelve sequential gates per lap, reverse-crossing rejection, split times, finish ordering | Newly authored track layouts and gate locations |
| Racers | Eight distinct handmade low-poly character/vehicle models, with different driving stats | No ripped meshes, original animations or textures; simplified silhouettes |
| Inventory | Three physical slots, trailing stones, LIFO use, matching groups up to level three, contact theft | Numeric timing and some defensive interactions are interpretations |
| Magic | All eight main spell families, level-dependent effects, aimed and homing fireballs, physical ice traps, Doom transfer | Simplified visuals and attack targeting; no original effect assets |
| Abilities | Dash, Flap, Grip-Up, Mug, Magic Plus, Barrier, Receive and Charge; independent selection | Recharge durations and effects are hand-tuned; Mug targets a nearby rival |
| Grand Prix | Four local rounds, cumulative points, next grid follows finishing order, final champion | Courses proceed from the selected course through the next three; no difficulty-class unlocks |
| Time Attack | Solo race with no pickups, saved best-race ghost and interpolated replay of actual recorded positions | Browser-local saves, configurable lap count, no memory-card import |
| Versus | Player against one selected CPU rival | No split-screen or second local controller |
| Online | Six-player private rooms with AI fill, authoritative simulation, recovery and rematches | Browser addition, not emulation of the original multiplayer |
| Presentation | Gold title, blue beveled menus, portrait order, MPH, stone slots, ability gauge and minimap | Newly authored interface, fonts, synthesized music and scenery |

Not implemented: Story, Relay, secret characters, bonus courses, custom stat editing, original cutscenes, original soundtrack, exact maps, split-screen, public matchmaking or ranked online leaderboards. The in-game About screen states these limits.

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

`shared/game.ts` runs at 60 Hz. Local races run in the browser; online races run on the server. Both use the same code. Seeded random choices make repeatable tests possible. The browser uses requestAnimationFrame for display and caps accumulated frame time.

The solver advances world-space velocity and position. It does not set the player's heading to the road tangent. Projection determines route progress, surface, recovery and lap validation. A player can turn around, drive straight past a corner or leave a cliff. Sequential checkpoints prevent those shortcuts from awarding a lap.

### Authority and validation

Online clients send only steering and button state. The server owns positions, pickups, hits, inventory, lap gates, finish times and ranking. Client-supplied coordinates have no effect. Host checks protect configuration, starting and rematching. Inputs must contain finite bounded steering and strict booleans.

The server limits rooms to six members and 100 active rooms. It bounds message size, connection count, action frequency and input frequency. It sanitizes names and uses own-property checks for course IDs. Origin validation follows an explicit allowlist or matching Host rule. OWASP recommends origin validation, message-level authorization, payload validation and rate limits for WebSocket applications. [15]

### Snapshots and latency

Snapshot buffering trades display latency for smoother arrival jitter. Extrapolation becomes unreliable around collisions. [11]

The server sends full snapshots at 20 Hz. Clients send inputs about 30 times per second. Remote vehicles interpolate world position and heading with an 85 ms buffer. The local vehicle extrapolates current velocity for at most 100 ms, without inventing authoritative progress. Recovery teleports snap instead of interpolating through scenery. There is no full input prediction/reconciliation.

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

Audio is synthesized locally after a gesture, with a persistent mute option. No Square Enix recordings or melodies are bundled. Text inputs do not consume race shortcuts. Pointer capture supports simultaneous steering and throttle on touch devices. Spell and ability taps remain active for 150 ms so they cross a simulation/network tick. Blur and visibility changes clear input. Local race menus pause simulation; online menus do not pause the room.

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
