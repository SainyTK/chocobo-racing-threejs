# Multiplayer performance

## Pre-optimization baseline

Base revision `6e6e35984866d0138894329594153e70d7079717`. Diagnostics and benchmark only were added before measuring. `docs/performance/baseline.json` records environment, sample counts, percentiles, and raw response trials. No public service connections were used.

Run `npm ci && npm run build && node --import tsx tests/multiplayer-benchmark.ts baseline`. Uses local port 3219, a production bundle, two isolated browser sessions with keyboard-controlled human slots and four CPU racers on the test course. The automated keyboard sequence is not two people playing. Each client performs ten acceleration and ten steering trials, with a brake/rest interval. Thresholds are speed increase >0.05 m/s and yaw change >0.002 radians. This measures input-to-visible-state response, quantized by browser animation frames, not physical key-to-photon latency. Random race seeds and system load introduce variation.

The delayed scenario delays application input and state callbacks by 60 ms each way with seeded uniform +/-30 ms jitter, and drops 5% of state callbacks. It may reorder delivery. It does not simulate TCP retransmission, actual packet loss, bandwidth constraints, Engine.IO ping delays, or Thailand routing. The RTT metric measures the clean underlying transport, not the simulated application delay. The stall scenario blocks the local server event loop once for 180 ms after the input trials. Server tick cost excludes snapshot serialization. JSON payload byte counts exclude Socket.IO, WebSocket and TCP headers.

Headless Chromium uses SwiftShader software rendering, 640x400, Retro quality, sound disabled. These FPS numbers are not representative of hardware-accelerated Thai devices. An exploratory high-quality 960x600 run had 83 ms median frames; the smaller Retro run reduces that rendering confound but does not remove it. Diagnostics stop collecting after 20,000 samples per metric and are opt-in with `?netPerf`. Normal play does not serialize diagnostic payloads.

Baseline median acceleration response was 196/245 ms clean and 274/319 ms delayed; steering was 166/132 ms clean and 347/306 ms delayed. Median frame times were 33 ms clean and 50 ms delayed. State traffic was about 181 KB/s per client clean and 169-171 KB/s delayed. One 180 ms server stall generated three snapshots in a single catch-up callback. Typical server tick cost is far below the 16.7 ms budget. This supports local driving prediction, reducing state bandwidth, and eliminating catch-up snapshot bursts. Rendering stalls remain a separate limitation of the test environment.

Initial `npm test`: 104 passed. Initial build passed.

## Changes and staged measurements

`compact.json` records the first change, a fixed-order v2 wire schema and latest-only broadcasting outside the catch-up loop. Clean traffic fell to 95.9 KB/s, a 47% reduction. Input response did not consistently improve, as expected. Maximum snapshots per room per callback fell from three to one after the stall.

`prediction.json` records the next checkpoint, before the new remote interpolation. Delayed median acceleration was 74/58 ms and steering 7/31 ms. These runs were sequential, with the same methodology. The report revisions identify their parent plus a dirty working tree. They are intermediate measurements, not separate runnable committed versions. The baseline is reproducible at commit `7888fc2`; the final implementation is at `c73b9d0`. `after.json` is an additional isolated repeat of the full implementation. It showed delayed medians of 48/36 ms acceleration and 43/25 ms steering. A separate after-run taken while E2E tests were running was discarded, then rerun with those processes stopped. Do not benchmark concurrently with browser tests.

The final code does the following:

- Predicts steering, acceleration, braking, reverse and drift grip immediately using the same driving integration as the server. This function cannot change inventory, RNG, pickups, spells, collisions, lap gates, events or results.
- Adds monotonically sequenced held input and acknowledgments after simulation. Reconciles to authoritative racer state and replays only outstanding client-frame driving commands. This is approximate replay, not deterministic server-tick lockstep. Both history and speculative time are bounded to 250 ms. Small visual position/yaw corrections decay over 80 ms; corrections over 3 m snap. Respawns, falls and finishes reset speculation. The existing chase camera follows the corrected visual pose without replaying effects.
- Sends item, ability and recovery presses reliably with race-scoped action sequences, acknowledgment retries and server deduplication. Held buttons generate one action until release. Actions are not predicted. Pending retries are cleared on disconnect/new race, so reload cannot replay uncertain old actions. Recovery now requires a new press rather than repeating every three seconds while held.
- Interpolates opponents by simulation time rather than packet arrival time, with a bounded 70-140 ms jitter-aware buffer and at most 100 ms extrapolation. Respawn/fall discontinuities do not blend across positions. Old ticks and wrong-race packets are rejected.
- Sends one latest snapshot per room after catch-up. A reliable initial full state establishes metadata. Subsequent fixed-order dynamic fields use four-decimal numeric precision. Reconciliation bookkeeping remains intentionally present, rather than risking incomplete replay. Results remain authoritative; event records are unchanged. Dynamic numeric fields, including transmitted finish times, have 0.1 ms or 0.0001-unit precision. Existing v1 tabs are supported until reload; their bandwidth is unchanged. New clients use WebSocket only, with no polling fallback.
- Moves Vite HMR onto the development HTTP server, avoiding another worktree's default HMR port, and gives E2E a separate default port of 3218.

## Final comparison

`final.json` records revision `c73b9d0`, Node v22.23.2, Apple M5 arm64 macOS, Chromium version and sample counts. Source was committed before this run. Values below are client 1/client 2; rates use decimal KB.

| Metric | Before | Final |
| --- | --- | --- |
| Clean acceleration p50 ms | 196 / 245 | 62 / 92 |
| Clean steering p50 ms | 166 / 132 | 17 / 35 |
| Delayed acceleration p50 ms | 274 / 319 | 69 / 56 |
| Delayed steering p50 ms | 347 / 306 | 12 / 30 |
| Delayed acceleration p95 ms | 596 / 1156 | 568 / 579 |
| Delayed steering p95 ms | 1081 / 1279 | 356 / 276 |
| Clean accepted state traffic KB/s | 181 / 181 | 88.5 / 88.5 |
| Clean median snapshot payload bytes | 9024 / 9024 | 4365 / 4365 |
| Delayed accepted state traffic KB/s | 171 / 169 | 75.8 / 79.3 |
| Clean input traffic KB/s | 0.84 / 0.88 | 1.21 / 1.17 |
| Clean frame p50 ms | 33 / 33 | 50 / 67 |
| Delayed frame p50 ms | 50 / 50 | 67 / 67 |
| Clean frame p95 ms | 217 / 217 | 267 / 333 |
| Delayed frame p95 ms | 167 / 200 | 150 / 150 |
| Stall snapshots per callback, maximum | 3 | 1 |
| Clean server tick p50/p95 ms | 0.101 / 0.186 | 0.101 / 0.198 |
| Delayed server tick p50/p95 ms | 0.065 / 0.118 | 0.077 / 0.142 |

Clean bandwidth fell 51%. Input sequencing raises upstream traffic by roughly 0.3-0.4 KB/s. Final broadcast construction/emit cost was 0.172/0.295 ms p50/p95 clean; baseline diagnostics did not measure that separately. Typical tick cost is still under 1% of the 16.7 ms tick budget, but this is one room, not a capacity claim about Railway.

Only ten input trials per client/scenario were collected. Their p95 and p99 are the same maximum sample, not trustworthy population tail estimates. Frame sample counts range from 156 to 275, snapshots from 224 to 362, server ticks from 807 to 1141 in these comparisons. See JSON for every p99 and count. Clean steering p95 actually worsened for client 1, 577 to 660 ms. The stall scenario still had a steering trial exceeding one second. No FPS improvement is claimed. Median software-rendered frame times worsened, and their tails vary widely between runs. A hardware-accelerated two-player measurement is required to establish rendering performance and client CPU cost.

Underlying RTT stayed about 0-1 ms median in every local scenario, with only 5-8 samples per client, while application delivery delay was imposed separately. Clean snapshot interval median stayed about 50-52 ms; delayed final median was 53-54 ms. Browser stalls can bunch callbacks even when the server does not stall. Snapshot arrival age is time since callback delivery, not WAN age. The final estimated age is relative to an arrival-calibrated simulation clock and does not measure Thailand one-way latency.

Reconciliation distance p95 was 0.67/0.80 m clean and 0.82/1.01 m delayed; delayed maxima were 4.52/5.90 m, which snapped rather than glided. There was no baseline prediction, hence no comparable baseline correction metric. Remote underruns were 7/7 frames clean and 13/21 delayed before, versus 8/9 clean and 22/18 delayed finally. The adaptive buffer did not demonstrate an underrun improvement here. Its final delayed median was 124/117 ms, adding remote display delay. Those counts have different frame sample counts and should not be compared as network loss rates. Explicit timestamp/respawn behavior is covered by deterministic tests, but buffer tuning needs real-player evidence.

State byte metrics count accepted application-delivered JSON, excluding dropped and rejected callbacks. They undercount actual wire traffic in impaired scenarios. Use the clean byte reduction for the bandwidth claim. Input metrics count scheduled sends, which a volatile transport could still discard. No compression, added service, paid tier or hosting changes were made.

## Validation and failures

Final `npm test`: 113 passed across five files. `npm run check` and `npm run build` passed. Vite still warns about the existing Three.js chunk exceeding 500 KB; this task did not change asset loading. `npm run test:production` passed, including production bundle loading, authoritative movement, reload, server restart expiration and returning to local mode. WebKit compatibility/GPU replacement smoke passed against this branch at port 3218.

The full E2E command passed 12 tests before its 1200-second shell timeout. These include all eight course finishes, Time Attack persistence, four-round Grand Prix and two-client multiplayer finish/reload/rematch with matching authoritative results. A separate targeted run passed the remaining three tests: Versus, mobile controls and the new impaired-network regression. Thus all 15 tests passed across these two final runs, not in one uninterrupted full-suite invocation. The new browser regression checks two human slots plus four CPU racers, WebSocket, driving under delayed delivery, one-shot recovery held longer than its cooldown, reload and offline/reconnection. The offline test explicitly closes the client transport because Playwright's offline switch alone does not immediately close an established WebSocket.

Earlier failures are not hidden: an initial E2E run hit a different worktree's Vite HMR port and produced `WebSocket closed without opened` page errors. HMR now shares this branch's server. An initial compatibility invocation used the old port 3000 and saw that same error; it was rerun successfully against 3218. The first impairment regression timed out expecting the offline switch to close WebSocket immediately; the explicit transport-close test fixed that assumption. A server burst test sometimes saw two packets in a 25 ms window because that window can cross two scheduled callbacks; it now asserts emissions per actual server callback. The final unit suite passed after that correction.

Orca 1.4.217's version-matched browser guide was followed. A separate embedded-browser smoke loaded the local online race with six racers over WebSocket, captured a screenshot and reported no console messages. Its instantaneous FPS read 97, which is not a timed benchmark. The room was left explicitly and the tab closed. Local service health then reported zero rooms and zero players. No public load test or live baseline was performed. Local test processes were stopped after validation.

Machine-readable baseline, compact, prediction, isolated repeat and final reports live in `docs/performance/`. Validation commands/results are in `validation.json`.

## Reproduction and Thai-player follow-up

Run `npm run benchmark:multiplayer -- review` with no other browser suite running. Output is `docs/performance/review.json`, using port 3219. For browser regressions, run `npm run test:e2e`; override `TEST_PORT` if 3218 is busy. For WebKit, run a local server on 3218 and `TEST_BASE_URL=http://localhost:3218 node tests/compatibility-smoke.mjs`. Production smoke starts and stops its own server on 3107.

After review and a separately authorized deployment, two real Thai players should test the same course, graphics setting and devices for at least two minutes on both Wi-Fi and their usual connection. Use `?netPerf` without `netDelay`, `netJitter` or `netDrop`. Record browser/device, quality, WebSocket transport, RTT distribution, frame times, snapshot intervals/arrival age, correction distances, underruns and whether acceleration, turns, collisions and rescue feel delayed or snap. Browser console telemetry is available through `window.__raceDebug.network`; copy it before leaving. Samples are bounded, and refresh/reset between runs. Compare normal play with diagnostics disabled as a check on instrumentation overhead.

Have both players drive with the four CPU racers. Exercise passing/contact, pickups and single magic/ability presses, falling/recovery, reload and a short connection interruption. Server authority is unchanged, but driving prediction does not predict walls, racer contacts, hazards, pads, abilities or launch boosts. These can produce corrections until a snapshot arrives. Report visible snaps and camera behavior, not only FPS. If steering improves but frame times remain poor on hardware, measure HUD/render work separately before changing physics or hosting. If remote underruns remain common, tune the buffer using actual jitter traces. End each test by leaving the room. Keep Railway Free/Trial only. This branch was neither pushed, merged nor deployed.
