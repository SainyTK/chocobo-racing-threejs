# Multiplayer performance

## Pre-optimization baseline

Base revision `6e6e35984866d0138894329594153e70d7079717`. Diagnostics and benchmark only were added before measuring. `docs/performance/baseline.json` records environment, sample counts, percentiles, and raw response trials. No public service connections were used.

Run `npm ci && npm run build && node --import tsx tests/multiplayer-benchmark.ts baseline`. Uses local port 3219, a production bundle, two isolated browser sessions with keyboard-controlled human slots and four CPU racers on the test course. The automated keyboard sequence is not two people playing. Each client performs ten acceleration and ten steering trials, with a brake/rest interval. Thresholds are speed increase >0.05 m/s and yaw change >0.002 radians. This measures input-to-visible-state response, quantized by browser animation frames, not physical key-to-photon latency. Random race seeds and system load introduce variation.

The delayed scenario delays application input and state callbacks by 60 ms each way with seeded uniform +/-30 ms jitter, and drops 5% of state callbacks. It may reorder delivery. It does not simulate TCP retransmission, actual packet loss, bandwidth constraints, Engine.IO ping delays, or Thailand routing. The RTT metric measures the clean underlying transport, not the simulated application delay. The stall scenario blocks the local server event loop once for 180 ms after the input trials. Server tick cost excludes snapshot serialization. JSON payload byte counts exclude Socket.IO, WebSocket and TCP headers.

Headless Chromium uses SwiftShader software rendering, 640x400, Retro quality, sound disabled. These FPS numbers are not representative of hardware-accelerated Thai devices. An exploratory high-quality 960x600 run had 83 ms median frames; the smaller Retro run reduces that rendering confound but does not remove it. Diagnostics stop collecting after 20,000 samples per metric and are opt-in with `?netPerf`. Normal play does not serialize diagnostic payloads.

Baseline median acceleration response was 196/245 ms clean and 274/319 ms delayed; steering was 166/132 ms clean and 347/306 ms delayed. Median frame times were 33 ms clean and 50 ms delayed. State traffic was about 181 KB/s per client clean and 169-171 KB/s delayed. One 180 ms server stall generated three snapshots in a single catch-up callback. Typical server tick cost is far below the 16.7 ms budget. This supports local driving prediction, reducing state bandwidth, and eliminating catch-up snapshot bursts. Rendering stalls remain a separate limitation of the test environment.

Initial `npm test`: 104 passed. Initial build passed.
