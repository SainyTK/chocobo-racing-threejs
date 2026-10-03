# Chocobo Racing browser remake

A playable, unofficial fan interpretation of the 1999 PlayStation racer. Version 2 replaces the earlier track-guided bird game with free driving, eight character/vehicle models and the original-style Magic Stone system.

This is not an identical port. Models, music, animations, maps and physics tuning are newly authored. Character and course names reference Square Enix's game. No original game files are bundled or required. The project is not affiliated with Square Enix.

## Play

Requires Node.js 22.12 or newer and WebGL 2.

```sh
npm ci
npm run dev
```

Open http://localhost:3000.

- Quick Race: six racers on the selected course, with CPU opponents.
- Grand Prix: four courses, cumulative points, changing grids and a final champion.
- Time Attack: solo racing without stones. Your best race saves a Phantom Racer in this browser.
- Versus: one-on-one racing against a selected CPU rival.
- Online: private six-player rooms. Empty positions use CPU racers. Share the six-character code or invite link.

Choose among eight racers and eight courses. Abilities are independent of character choice. Lap count is configurable from one to three. Grand Prix starts on your selected course and continues through the next three in course order.

### Driving

Manual acceleration is on by default. You must steer around corners. The game does not guide your heading along the road. Brake before tight turns; use boosts on straights. Options includes auto-accelerate, which does not steer for you.

| Action | Keyboard | Touch / standard gamepad |
| --- | --- | --- |
| Accelerate | W or up arrow | GAS / right trigger |
| Steer | A/D or left/right arrows | Arrows / left stick |
| Brake | S or down arrow | BRAKE / left trigger |
| Reverse | X | REV / B |
| Drift | Shift while steering, or accelerator + brake | DRIFT / A |
| Cast latest stone | Space | Magic card / X |
| Ability | E | Ability card / Y |
| Recover | R | REC button |
| Look behind | B | Keyboard |
| Race menu | Escape | Pause button |

A long drift causes a spin, not a release turbo. Release the pedals during an over-drift spin, then press accelerate to perform a Spin Dash. A timed accelerator press just before GO gives a dash start.

Carry three Magic Stones. The last collected stone casts first. Consecutive matching stones combine into stronger spells. Reflect can defend automatically while held. Rear contact can steal a rival's stone; a collision can pass a Doom curse.

Local menus pause the race. Online rooms continue running. Disconnected online racers get CPU control and can reconnect within 60 seconds, including after a page reload.

## Play on another device

The server listens on `0.0.0.0`. Use this computer's LAN IP on devices on the same network, for example `http://192.168.1.20:3000`. Open the LAN address before copying an invite. A localhost link cannot reach another computer. Allow the port through the host firewall.

For internet play, deploy the Node server on a reachable HTTPS host with WebSocket support. Static-file hosting alone is insufficient.

## Studio

The studio is an internal viewer for game elements: racers, Magic Stones, spell effects, stage objects and whole courses.

```sh
npm run studio
```

It opens http://localhost:5180 with its own Vite server, separate from the game server.
The production build does not include it.

Search the library with `/` (or Cmd/Ctrl+K), then press Enter to show the highlighted element in the active pane.
Shift+Enter adds it as a new pane.
Compare up to four panes side by side, each with its own element and variant, labelled A to D.
`V` (or "All variants") fills the panes with the variants of the active element, and `[` / `]` step through variants.
Linked cameras turn every pane together, and Restart replays every pane from the same moment.
Variants marked "In game" are what the game currently uses.

The address bar always holds the full comparison, so "Copy link" shares exactly what you see.
"Save image" downloads all panes as one PNG with each pane's letter, element and variant, ready to post for a decision.
Quality switches between the game's High and Low settings.

The Courses category builds a complete course in a pane, lit by its own sky, fog and sun.
"Race camera lap" drives a Chocobo round the course behind the game's chase camera; drag to look around it and scroll to pull back.
"Aerial overview", "Start line" and the six "Trackside" views orbit fixed points of the course.
"Prop sheet" lays out the course's named props side by side with labels, for working on one prop at a time.
Course files hot-reload, so scenery can be built and judged here without starting a race.

To register a new element, add an entry under `studio/elements/` and list it in `studio/registry.ts`.

## Course scenery

Each course's look lives in one file under `src/gfx/stage/courses/`: its sky, fog and light, terrain shape and colour, road surface, start gate colours, ambient particles, a `build` function that places everything else, and a catalog of props for the studio's prop sheet.
`src/gfx/stage/kit.ts` collects props in world space and merges them per 128 m chunk and material layer, so the camera culls whole sections and a course draws in a few hundred calls.
Props are authored as `Parts`: geometry painted per vertex with baked ambient occlusion, on a solid, wind-swayed foliage or glowing layer.
Small dressing marked `detail` disappears on Low quality.

`npx tsx tests/stage-report.ts [ids] [--props]` prints build time and triangle counts per course, and with `--props` the cost of every catalog prop.
`tests/stage.test.ts` builds every course headless and checks budgets, disposal, Low-quality detail hiding, and that nothing stands on the road between the surface and 9 m overhead, where the chase camera rides.

## Production

```sh
npm run build
ALLOWED_ORIGINS=https://racing.example.com PORT=3000 npm start
```

`ALLOWED_ORIGINS` accepts comma-separated exact origins. Without it, the server accepts matching Origin/Host pairs. Set it explicitly behind a reverse proxy and forward WebSocket upgrades.

```sh
docker build -t chocobo-racing .
docker run --rm -p 3000:3000 \
  -e ALLOWED_ORIGINS=http://localhost:3000 \
  chocobo-racing
```

`GET /health` reports health, rooms and connections. The server is a single process with in-memory rooms. Restarting it clears rooms. Do not run unsynchronized replicas. Public hosting also needs infrastructure rate limiting and monitoring.

## Tests

```sh
npm test
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:production

# Optional WebKit compatibility check, with the dev server running
npx playwright install webkit
node tests/compatibility-smoke.mjs
```

Browser tests drive complete races by reading cloned telemetry and sending keyboard or touch events. They do not set racer positions, call simulation functions or accelerate the game clock. The full suite includes all eight courses, four Grand Prix rounds, saved ghosts, mobile controls and two-client multiplayer.

Reports are in `output/playwright-report/`; screenshots are in `output/testing/` with a `v2-` prefix. Vite ignores generated reports so tests do not reload other live races. `docs/testing.md` records completed validation and limitations.

## Code

- `shared/math.ts`: clamp, modulo and angle helpers shared by the simulation and the client.
- `shared/track/`: eight closed circuits (`tracks.ts`), road sampling and world-to-road projection (`sampling.ts`), and stones, boost pads and hazards (`objects.ts`).
- `shared/game/`: 60 Hz free driving, bots, spells, abilities, collisions and validated laps.
  Settings and data live in `constants.ts`, `abilities.ts`, `items.ts` and `racers.ts`.
  Race setup is in `setup.ts`, spell hits in `combat.ts`, item and ability use in `actions.ts`, and the bot driver in `bot.ts`.
  `step/` runs one tick: per-racer physics, projectiles, racer contacts and standings.
- `server/index.ts`: authoritative room server, sessions and input validation.
- `src/scene.ts`: chase camera, course loading, pickups, shadows, bloom post-processing and 3D-rendered portraits.
- `src/gfx/characters/`: the eight rigged racers and vehicles, built in code with cel shading and outlines, with running, flapping, blinking and spring animations.
  `index.ts` builds a racer by index, `rig.ts` batches parts into few draw calls, `parts/` holds shared pieces (bird body, eyes, wheels, carpet texture) and `racers/` has one file per racer.
- `src/gfx/effects/`: spell and race effects: fireballs, ice traps, lightning, Ultima, Reflect bubbles, Doom runes, boost trails, drift sparks and status auras.
  `index.ts` holds the `Effects` controller; `bolt.ts`, `trail.ts`, `bursts.ts`, `status.ts` and `pickup.ts` each hold one effect component.
- `src/gfx/particles/`: instanced billboard particle pools and their shaders.
- `src/gfx/orbs/`: Magic Stone orbs. Each stone is a glass sphere with its element ray-marched inside it: a flame, a tumbling ice cube, plasma-globe lightning, a whirlwind, a mirror ball, shrinking rings, a Doom clock in smoke, a star core and a rainbow question mark.
  `interiors.ts` holds one shader per stone, `glass.ts` the shell and `index.ts` builds an orb. Track pickups, held stones and HUD slots all use them.
- `src/gfx/stage/`: course scenery.
  `course.ts` assembles a course; `kit.ts` places and merges props; `terrain.ts` builds the ground heightfield and textured road; `sky.ts` the sky dome and distant mountains; `liquid.ts` water, lava and cloud seas; `ambient.ts` drifting particles; `textures.ts` procedural road and ground textures; `props/` shared props; `courses/` one file per course.
- `src/gfx/pipeline.ts`: renderer settings, bloom composer and lights shared by the game and the studio.
- `src/gfx/materials/`: toon, glow, outline, ghost, fresnel shell, crystal and ground decal materials, one per file.
- `src/gfx/geometry/`: the geometry helpers used to sculpt the models (baked transforms, primitives, rocks and swept tubes).
- `src/main.ts`: modes, menus, HUD, input, local race loop and ghost recording.
- `studio/`: the internal element viewer (`npm run studio`). `registry.ts` lists the elements, `elements/` defines them by category and `viewport.ts` renders one pane.
- `src/network.ts`: reconnects, world-space interpolation and bounded extrapolation.
- `src/audio.ts`: original synthesized music and effects.
- `docs/research.md`: original-game research, sources, technology choices and fidelity limits.

## Limits

This is a fan remake, not an emulator or an exact reproduction. Story, Relay, secret racers, bonus tracks, original cutscenes, custom stat editing, split-screen and the original soundtrack are not included. Course layouts and handling differ from the PlayStation game. Time Attack records live only in local storage and are grouped by course, laps and ability. Ghost saves require a race under five minutes and available browser storage.

Online racing targets a LAN or nearby server. Full client prediction, public matchmaking, accounts and durable online leaderboards are not implemented. Keyboard and emulated touch testing do not establish physical gamepad or real-phone compatibility.
