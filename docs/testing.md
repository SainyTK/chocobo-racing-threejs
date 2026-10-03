# Version 2 validation record

Tested on 2026-09-13. This file covers the free-driving rewrite, not the earlier lane racer. Version 1 source and reports are historical material under `output/v1-backup/` and older artifact names.

## Results

- 55 simulation and real Socket.IO integration tests passed with `npm test`.
- All 14 browser regression cases passed in the final complete run, which took 19.1 minutes. This includes all eight courses, ghost replay, four Grand Prix rounds, Versus and multiplayer.
- The mobile rotation fix passed its targeted regression, including real touch acceleration, steering, braking, reverse and recovery.
- Strict TypeScript checks and the production build passed.
- The built-bundle production smoke passed, including a real server restart and recovery into a new room.
- Playwright WebKit passed rendering, driving controls, pause/resume and resource-replacement checks with no page errors.
- `npm audit` reported zero known vulnerabilities.

## Simulation coverage

Tests verify eight closed track geometries and world-to-road projection; the eight vehicles and independent abilities; free heading without automatic steering; acceleration, braking and reverse; wall response; cliffs and recovery; sequential checkpoint validation; reverse-crossing rejection; timed starts; drift spinouts and Spin Dash; strict input filtering; three-slot LIFO magic; matching stones merging into one stack; theft of trailing stacks; all spell families; aimed and homing fireballs; ice traps; Reflect's held and manually cast forms; area-attack blocking; natural airborne immunity to ground ice; Doom transfer and detonation; input-edge casting; pickup respawn; solo Time Attack; every ability; lap splits; and deterministic results.

Each course also has a three-lap, six-CPU test. Every finisher must have crossed all 36 gates and recorded three valid splits.

A separate stress run completed **80 three-lap races and 480 racer finishes**, with ten seeds on each course and varied character selections. No racer got stuck or failed to finish; no position or heading became nonfinite. The slowest complete race took about 256 simulation seconds. Reproduce with:

```sh
npx tsx tests/stress.ts
```

Results: `output/testing/v2-simulation-stress.json`.

## Multiplayer coverage

Real socket clients test room creation/joining, six-player capacity, independent character/ability selection, synchronized movement, rejected client position injection, host-only commands, unknown/full/started rooms, sanitization, prototype-key rejection, session-secret authentication, reload recovery, host transfer, disconnected reserved slots, cleanup, rate limiting, origin rejection and rematches.

The browser multiplayer test uses two independent contexts. They create and join one room, start the same race, reload one client, interrupt a connection, finish through keyboard input, compare identical authoritative ranks/times and return to the lobby. It does not claim a six-browser load test or public-internet certification.

`tests/production-smoke.mjs` runs an isolated production server on port 3107. It verifies room creation, authoritative movement, reload recovery, a real shutdown/restart, visible room expiry, creation of a new room and a working local race after leaving. Results: `output/testing/v2-production-smoke.json`.

## Browser playthroughs

Browser pilots read cloned telemetry and dispatch keyboard events. They never set racer positions, invoke simulation functions, award laps or advance the clock. Touch checks use Chromium's real emulated touch input path.

The suite covers:

1. All eight racers, course selection, independent abilities, help, options and the fidelity disclaimer.
2. A full lap and replay on each of the eight courses, with countdown, steering, braking, magic and finish validation.
3. A genuinely paused local simulation.
4. A complete Time Attack, saved driving samples, page reload and another race against the saved Phantom Racer.
5. Four complete Grand Prix rounds, cumulative points, changed courses/grids and a final champion.
6. The two-client online lifecycle described above.
7. A full Versus race with Behemoth using Flap against Goblin.
8. Mobile portrait and landscape layouts, simultaneous gas/steering, brake, reverse, recovery, and no horizontal overflow.

The mobile follow-up specifically rechecks touch controls after taking a screenshot and changing orientation. The touch-capable device class keeps the controls present even if pointer media-query reporting changes.

## Orca browser

Orca's embedded browser completed a one-lap Cid's Test Track race with keyboard-event driving. The player finished in **58.84 simulation seconds**, with 12 validated gates. Its report records pickups, casts, hits, defense, Doom, Mini, Haste, Ultima, boost pads and ability use. The pilot issued keyboard events only; it did not mutate race state.

- `output/testing/v2-orca-report.json`: completed run and telemetry.
- `output/testing/v2-orca-live.png`: an actual Orca screenshot taken near the finish, not a Playwright image.

Orca screenshot capture was intermittent. One live image succeeded; the results capture timed out because the tab/window was not consistently foregrounded. An OS-level attempt to bring the window forward encountered an Accessibility permission error; permissions were not changed. An additional three-lap attempt suffered background rendering throttling and is not counted as a completed run.

The first Orca report's FPS estimator used a capped frame interval, so its minimum FPS is not a valid benchmark. That estimator now uses the actual interval. These checks prove a completed input-driven race in Orca, not a hardware performance guarantee.

## Second browser engine and resources

`tests/compatibility-smoke.mjs` uses Playwright WebKit on macOS. It verifies a WebGL 2 scene, Black Magician's vehicle, manual acceleration, steering, braking, reverse, pause/resume and a diagnostic snapshot that cannot mutate live state. No page errors occurred.

Sixteen course replacements returned to Cid's Test Track with 33 geometry objects and one texture, compared with 32 geometries and one texture before the first cycle. The single lazy allocation did not accumulate across replacements. Results: `output/testing/v2-webkit-smoke.json`; image: `output/testing/v2-webkit-race.png`.

A local simulation sample advanced 60 seconds for six racers in about 234 ms, excluding rendering and networking. Its complete JSON snapshot was 10,367 bytes. At 20 Hz, that is about 202 KiB/s per client before protocol overhead. Delta encoding would be worth adding before a large public deployment. The 100-room limit is a safety cap, not a load-tested capacity claim.

## Bugs found and fixed

- The first version's rail steering and drift-release turbo did not match the chosen reference. Version 2 replaces both systems.
- A Doom curse could pass to a rival and immediately back within one collision loop. Transfer now occurs once per contact.
- A 45-second post-finish grace period cut off slower three-lap CPU racers near the finish. The grace period is now 90 seconds; the stress run completed every racer.
- Reflect's manually activated form only blocked attacks. It now reflects eligible small attacks and blocks area attacks without reflection loops.
- Cloud and carpet racers now ignore ground ice and rough shoulders, while remaining vulnerable to level-three ice and course boundaries.
- Near-camera rival labels could fill the viewport. Labels now require an appropriate distance and viewing direction.
- The narrow menu camera hid most of the vehicle behind setup controls. Its framing now keeps the selected vehicle above the panel.
- Mobile controls disappeared after a portrait-to-landscape change in Chromium. A stable touch-device class fixes their visibility. Touch recovery also has its own button and input pulse.
- Rejoining after a page reload lost the Online mode selection, so server-restart recovery returned to the wrong setup tab. Online room updates now preserve that mode.
- Ghost saving now validates character/sample data, caps recordings at five minutes and reports unavailable storage instead of claiming a failed save succeeded.
- Grand Prix's final table now displays cup standings rather than the last round's position numbers.

## Artifacts

All current images use a `v2-` prefix under `output/testing/`:

- `v2-home-desktop.png`, `v2-home-mobile.png`, `v2-black-magician.png`.
- `v2-race-test.png`, `v2-race-forest.png`, `v2-race-gate.png`, `v2-race-mines.png`, `v2-race-manor.png`, `v2-race-gardens.png`, `v2-race-gingerbread.png`, `v2-race-volcano.png`.
- `v2-results-*.png`, `v2-grand-prix-champion.png`, `v2-versus-results.png`.
- `v2-phantom-racer.png`, `v2-online-lobby.png`, `v2-online-results.png`.
- `v2-race-mobile.png`, `v2-race-landscape.png`.
- Orca, WebKit, production and simulation reports listed above.

`output/playwright-report/index.html` is the latest full browser report. Generated artifacts are excluded from Git and Docker contexts.

## Limits

No physical phone or gamepad was attached. Firefox, a public HTTPS reverse proxy, sustained packet loss, high-latency regional play, Docker runtime deployment and multi-process scaling were not end-to-end tested. WebKit on macOS is not physical iPhone certification.

This is a working fan remake, not an identical port. Story, Relay, secret content, original maps/assets/music and exact PlayStation physics are not implemented. Local ghost saves are not durable cloud records. Online play is intended for private rooms on a LAN or a nearby server.

## Graphics rebuild (2026-10-03)

The racers, spells and effects were rebuilt as rigged, cel-shaded Three.js models with outlines, bloom, real-time shadows and an instanced particle system.
Menu and HUD portraits are now rendered from the same 3D models.

- `npm test`: 55 passed.
- `npx playwright test`: all 14 browser cases passed in 19.8 minutes, the same duration as before the rebuild.
- `npm run test:production` and `tests/compatibility-smoke.mjs` (WebKit) passed. Geometry count grew from 58 to 61 across sixteen course replacements, within the existing limit.
- Orca's embedded browser was used to inspect every racer on every course, and to trigger each spell effect next to a stationary player.

Headless Chromium renders WebGL with SwiftShader.
The first version of the new models ran at about 417 ms per race frame there, which stalled the browser tests.
Lower tessellation, plain boxes for tiny parts, outline hulls only on large parts and one vertex-coloured mesh per joint brought it to about 33 ms.
Software renderers now default to Low quality (no MSAA, bloom or shadows, half particle density).
When no quality was saved, High drops to Low once if a race stays under 28 fps for four seconds.

Shader `pow()` calls now clamp their inputs.
A slightly negative base produced NaN pixels, which the bloom pass spread into large black squares during lightning strikes.

Orca only delivers animation frames while its browser pane is on screen.
For background checks, `requestAnimationFrame` was replaced from the test side with a 16 ms timer.
This changes frame scheduling only, never race state.

## Course scenery rebuild (2026-10-04)

Every course's scenery was rebuilt on a shared stage kit, with one art file per course, and the studio gained a Courses category for building them.

- `npm test`: 98 passed, including the new `tests/stage.test.ts`.
  It builds all eight courses headless and checks their triangle budgets, Low-quality detail hiding and geometry disposal.
  It also checks that no scenery stands on the road between 0.3 m and 9 m above the surface.
- `npx tsx tests/stage-report.ts` reports 394k to 585k triangles per course and 250 to 800 ms build time, depending on course and texture cache.
- The road-clearance test found real problems while the courses were built, and all of them are fixed:
  - Manor's start line sits on a corner apex, so the start gate became a cantilever and the inner fence was cut back.
  - Volcano's edge chains reached across a hairpin.
  - Swept curbs and walls folded across the road on the inside of tight bends; such points now sink below the surface.
- Headless Chromium (SwiftShader) measured 17 to 18 fps on Moogle Forest at first, against 50 to 59 fps for the old flat-coloured scenery at the same settings.
  The cost was pixel fill from the textured terrain, sky and liquids.
  The sky, mountains and liquids now draw after the opaque scene, so the depth test skips covered pixels.
  Low quality skips the cloud and star layers, shortens the view distance, and renders at 0.75 resolution on software renderers.
  Software rendering now runs at 26 to 55 fps across the courses checked: Moogle Forest, Mythril Mines and Floating Gardens.
- `tests/compatibility-smoke.mjs` (WebKit) passes.
  Its resource check now compares a second lap of all eight courses against the first, and requires zero growth in geometries and textures.
  This replaces a fixed allowance of three geometries and one texture.
  The stricter check found a real leak: the slowing-puddle shader cloned its noise texture when merging uniforms, leaking one texture per course switch. That is fixed.
  WebKit showed 500 draw calls on Cid's Test Track, so scenery chunks grew from 72 m to 128 m, roughly halving the mesh count.
  The test's driving steps now wait on race time, not wall time, because on a busy machine the capped frame step lets the race clock lag behind.
- The full Playwright suite was not re-run for this change.
