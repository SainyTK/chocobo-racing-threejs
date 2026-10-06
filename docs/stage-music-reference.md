# Stage music reference

## Research

The arrangement targets are the 1999 PlayStation Chocobo Racing recordings, not Chocobo GP or earlier Final Fantasy recordings. Square Enix lists separate course songs at OST tracks 17 through 24, plus Chocobo Choosin' at track 2. [1]

Published descriptions of the actual Racing arrangements identify a low flute with a fast beat for Moogle Forest, eerie keyboard effects for Black Manor, synth-led Floating Gardens and fast percussion in Mythril Mines. [3] The historical Music FAQ describes Gingerbread Land's jazz treatment and identifies battle-theme sources for Ancient Gate and Vulcan-O Valley. [2]

These descriptions inform the arranging choices below. Tempos, pitches and instrumental details in our scores are newly authored design choices, not measurements or transcriptions of the original recordings. No original audio is bundled and no direct listening analysis has been performed. The [revision brief](music-revision-brief.md) records the evidence and limits.

## Revised compositions

The revision changes every score's non-bass musical events, not only its title or tempo. Three `gpt-6.1-sol` workers revised the early courses, late courses, and instruments/menu music. All score IDs and titles remain compatible with existing links. Each loop has 32 bars of 4/4, contrasting A/B phrases, bass, accompaniment and percussion.

| Score | Title | Racing reference | BPM | Loop duration | Revision |
| --- | --- | --- | --- | --- | --- |
| menu | A small journey | Chocobo Choosin', OST 2 | 138 | 55.7 s | Replaces the 96 BPM pastoral tune with brass/guitar hooks, piano chords, syncopated bass and drums. |
| test | Open Throttle | Cid's Test Track, OST 17 | 164 | 46.8 s | Clipped brass hooks, synth answers, piano hits and punchy bass. |
| forest | Canopy Daylight | Moogle Forest, OST 18 | 142 | 54.1 s | Lower MIDI 60-72 flute phrases over fast light plucks and moving bass, rather than the previous slow pastoral groove. |
| gate | Stone Standard | The Ancient Gate, OST 19 | 156 | 49.2 s | Compact brass battle riffs, interlocking short strings, organ offbeats and marching drums. |
| mines | Copper Depths | Mythril Mines, OST 20 | 172 | 44.7 s | Organ/piano exchanges over continuous eighth-note bass, keyboard fills and stronger drums. |
| manor | The clock behind the wall | The Black Manor, OST 21 | 132 | 58.2 s | Piano/organ exchanges, chromatic passing harmony and quiet ghost replies. |
| gardens | Wind above the trellises | Mysidian Floating Gardens, OST 22 | 148 | 51.9 s | Lyrical synth lead, minor-key bridge, flute/pluck answers and light brisk drums. |
| gingerbread | Cookie tin cabaret | Gingerbread Land, OST 23 | 156 | 49.2 s | Piano/brass exchanges, 2:1 swing, quarter-note walking bass and offbeat piano chords. |
| volcano | Under the caldera | Vulcan-O Valley, OST 24 | 180 | 42.7 s | Minor-key guitar riffs, synth/brass answers, bass sixteenth bursts, phrase crescendos and snare fills. |

## Playback

`src/music/types.ts` defines MIDI-note events with times and durations in beats. `early-stages.ts` and `late-stages.ts` each define four course scores. `index.ts` exports the game's `STAGE_MUSIC` map and separate `MENU_MUSIC` score.

`src/music/instruments.ts` defines weighted harmonic voices, per-partial decay, attack/release envelopes and filter articulation. Piano, guitar, synth and ghost voices join flute, brass, strings, bells, organ, plucked notes, bass and percussion. These are procedural approximations, not a PlayStation soundfont. Percussion reuses one deterministic noise buffer.

Music and effects use separate buses. The player schedules 120 ms ahead and limits music to 48 simultaneous notes and effects to 32. A pitched note uses at most four oscillator sources. Ended nodes disconnect; frame stalls skip missed notes instead of replaying them. Note bodies are capped at four seconds, with a maximum 160 ms release envelope and 10 ms cleanup margin.

The game passes the authoritative race course, so online and Grand Prix music matches the race rather than the menu selection. Local pauses and hidden documents freeze playback; online menus leave race music running. Resume continues at the next event without reconstructing held notes. Score changes, restart and pause cancel the old music without cancelling effects. Volume and mute control both buses through the master gain.

## Studio review

Run `npm run studio` and search for `music`. Each of the nine entries has two variants:

- **Revised composition**, the score now used in the game.
- **Previous composition**, the first pass preserved under `studio/music/` for before/after review.

Use the Variant selector, or All variants to compare both versions in separate panes. Only the active pane plays; changing focus restarts its selected score. Both versions use the updated instrument definitions, so this compares composition rather than reproducing the old synthesizer. The earlier scores are studio-only and do not enter the game bundle.

Each card shows its specific 1999 reference, arrangement direction, tempo, loop length and playback progress. Play/pause, restart and volume work without starting a race. The toolbar's pause/restart controls also apply, while animation speed does not change music tempo. Shared links, opening a score and reloading the studio never autoplay.

For reference listening, the cards link to Square Enix's [official album listening/download page](https://sqex.lnk.to/gzCQxWYWTP). No external recording plays automatically.

## Validation

- `npm test`: 167 tests passed, including event validity, coverage, instrument definitions, score override switching, cleanup and changed musical writing for all nine scores.
- `npm run build`: TypeScript and the game build passed. The separate studio Vite build passed. Both retain large-bundle warnings.
- `npm run test:studio`: three browser tests passed, covering all nine songs, previous/revised variants, same-course A/B focus switching, pause/resume, restart, volume, leaving music and silent reloads.
- `npx playwright test tests/audio.e2e.ts`: both browser tests passed. Real Chromium checks all eight course selections and audio controls, plus finite non-silent output below clipping during each stage's first 300 ms.

Screenshot: `output/testing/studio-music-revision.png`.

These checks establish valid scores and working playback, not subjective musical similarity. Full-loop listening review is left to the user in the studio. Physical mobile audio testing remains outstanding.

## Sources

[1] https://www.jp.square-enix.com/music/en/lineup/item/SQEX-10121.html

[2] https://gamefaqs.gamespot.com/ps/196911-chocobo-racing/faqs/16691

[3] https://www.squareenixmusic.com/reviews/kie/chocoboracing.html
