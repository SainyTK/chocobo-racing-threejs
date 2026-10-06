# Stage music reference

## Research

This project interprets the 1999 PlayStation Chocobo Racing, not 2022's Chocobo GP. Square Enix's official album page credits Kenji Ito's arrangements and lists separate course tracks numbered 17 through 24 for the eight courses implemented here. [1]

The historical Music FAQ identifies the underlying themes. [2] These are research references, not permission to distribute the recordings or transcribe the melodies. No original game audio is included.

| Course ID | Reference | Direction for our original composition |
| --- | --- | --- |
| test | Chocobo theme arrangement | Bright, brisk major-key racing tune with short brass phrases |
| forest | Unused FFVI town music | Peaceful woodwind lead, plucked accompaniment, light rhythm |
| gate | FFIII boss battle | Minor-key martial pulse, brass and driving bass |
| mines | FFI volcano music | Repeating dungeon ostinato, metallic accents, low strings |
| manor | FFII mage shrine music | Eerie keyboard/organ, chromatic motion, restrained percussion |
| gardens | FFV ending music | Airy melodic strings, bells and rising phrases |
| gingerbread | Jazz Chocobo arrangement | Swing phrasing, bouncing bass, playful syncopation |
| volcano | FFII boss music | Urgent minor-key battle arrangement, heavy percussion |

The composition directions are design choices informed by those references, not measured tempo or instrumentation transcriptions. Research used published descriptions; no listening analysis has been performed.

## Compositions

Three `gpt-6.1-sol` workers produced the early scores, late scores and playback engine in parallel. All melodies are newly authored. Each score has 32 bars of 4/4, contrasting A/B phrases, bass, accompaniment and percussion.

| Course | New title | BPM | Loop duration |
| --- | --- | --- | --- |
| test | Open Throttle | 152 | 50.5 s |
| forest | Canopy Daylight | 104 | 73.8 s |
| gate | Stone Standard | 144 | 53.3 s |
| mines | Copper Depths | 126 | 61.0 s |
| manor | The clock behind the wall | 108 | 71.1 s |
| gardens | Wind above the trellises | 120 | 64.0 s |
| gingerbread | Cookie tin cabaret | 144 | 53.3 s |
| volcano | Under the caldera | 168 | 45.7 s |

## Playback

`src/music/types.ts` defines MIDI-note events with times and durations in beats. `early-stages.ts` and `late-stages.ts` each define four course scores. `index.ts` exports their combined `STAGE_MUSIC` map and separate `MENU_MUSIC` score.

`src/audio.ts` synthesizes woodwind, brass, strings, bells, organ, plucked notes, bass and percussion with oscillators, filters and envelopes. Percussion reuses one deterministic noise buffer. Music and effects use separate buses. The player schedules 120 ms ahead, limits music to 48 simultaneous voices and effects to 32, and disconnects ended nodes. Frame stalls skip missed notes instead of replaying them. Note bodies are capped at four seconds, with a short release tail.

The game passes the authoritative race course rather than the menu selection, so online and Grand Prix stages select the correct music. Local pauses and hidden documents freeze playback; online menus leave race music running. Resume continues at the next event without reconstructing held notes. Changing course or returning to menus cancels the old music without cancelling effects. Mute controls both buses through the master gain.

## Studio preview

Run `npm run studio`, open http://localhost:5180, and search for `music`. The Music category contains the eight course scores and menu music. Play/pause, restart, volume, loop progress and score metadata are available without starting a race. Multiple panes share one player and only the active pane plays. Leaving Music stops playback. The toolbar's pause/restart controls also apply; its animation speed does not change the score tempo. Loading a shared link or reloading the studio does not autoplay.

`npm run test:studio` starts a separate studio server and tests all nine scores, pause/resume, restart, volume, focus changes between music panes, leaving Music and silent reloads. The controller has unit tests for explicit playback, single-player routing and hidden-document pauses.

Studio integration validation: 156 unit tests passed, both studio browser tests passed, both game audio browser tests passed, and TypeScript plus game/studio builds passed. The studio build also reports a large bundle warning. Screenshot: `output/testing/studio-music.png`.

## Validation

- `npm test`: 149 tests passed, including score bounds/coverage and mocked AudioContext scheduling, transitions, mute, pause and cleanup tests. An initial run hit the existing tunnel startup polling timeout; the final full run passed without changing that test.
- `npm run check` and `npm run build`: passed. Vite reports the existing large Three.js chunk warning.
- `npx playwright test tests/audio.e2e.ts`: both tests passed. Real Chromium checks all eight course selections, local pause/resume, exit and mute. A separate analyser check confirms finite, non-silent output below clipping during each stage's first 300 ms.

These checks do not establish subjective musical quality or close fidelity to the reference recordings. A full-loop listening review and physical mobile audio testing remain outstanding.

## Sources

[1] https://www.jp.square-enix.com/music/en/lineup/item/SQEX-10121.html

[2] https://gamefaqs.gamespot.com/ps/196911-chocobo-racing/faqs/16691
