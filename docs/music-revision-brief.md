# Music revision brief

## Scope

Rework all nine existing scores to resemble the arrangement character of the 1999 PlayStation Chocobo Racing soundtrack more closely. These remain newly authored melodies, not recordings, transcriptions or replacements for the original soundtrack. Do not reference Chocobo GP or recordings from other games as arrangement targets.

The previous pass mostly matched course mood. This pass should change the actual musical writing: faster race-ready grooves, clearer lead hooks, shorter melodic answers, stronger transitions and instrumental roles specific to each course. Keep the existing score titles and IDs so links remain compatible. At least 128 beats per score, with distinct A/B material and controlled event density.

## Evidence and limits

Square Enix confirms the separate course tracks 17 through 24 and the selection track, Chocobo Choosin', on the 1999 soundtrack. [1] Kie's album review describes the actual Racing arrangements: Cid's energetic Chocobo arrangement, Moogle Forest's low flute against a fast beat, Black Manor's keyboard and ghostly effects, Floating Gardens' synth-led peaceful racing pulse, and Mythril Mines' fast percussion. [2] The Music FAQ calls Gingerbread Land a jazz arrangement and identifies the battle-theme context for Ancient Gate and Vulcan-O Valley. [3]

These descriptions are evidence for broad arranging choices only. No measured BPM, original note transcription, extracted samples or direct listening analysis is available. Do not claim exact instrumentation or objective fidelity for tracks without that evidence. New BPM and harmonic choices below are design decisions, not measurements of the originals.

| Score | Original Racing reference | Revision direction |
| --- | --- | --- |
| menu | Chocobo Choosin', OST 2 | Replace the slow pastoral tune with a jaunty, bright selection groove, brass/plucked hook, syncopated bass and light drums. |
| test | Cid's Test Track, OST 17 | Brisk and punchy major-key racing hook, bright brass/synth answers, clipped chord hits and clear kick/snare groove. Avoid generic triad runs. |
| forest | Moogle Forest, OST 18 | Lower-register lyrical flute, peaceful melody but fast, light rhythmic backing. Increase the current 104 BPM feel without turning the flute into a frantic solo. |
| gate | The Ancient Gate, OST 19 | Tense battle drive with interlocking string ostinato, brass answers and compact minor-key riffs, contrasting a march with the existing pastoral courses. |
| mines | Mythril Mines, OST 20 | Fast dungeon pulse, keyboard/organ lead and continuous bass movement, strong rhythmic drums. Replace the current slow sparse mining ambience. |
| manor | The Black Manor, OST 21 | Keyboard/piano/organ leads with chromatic phrases, quiet ghost-like synth accents and an eerie but moving pulse. Keep it distinct from a heavy boss battle. |
| gardens | Mysidian Floating Gardens, OST 22 | Synth-led, smooth and lyrical with a brisk light beat. Replace the mainly strings/bell pastoral arrangement with a clear synthesizer melody and airy answers. |
| gingerbread | Gingerbread Land, OST 23 | Stronger jazz identity, swung piano/plucked/brass phrases, walking bass, syncopated chord comping and light swung drums. |
| volcano | Vulcan-O Valley, OST 24 | Fast urgent battle arrangement, minor riffs, bass sixteenths where practical, brass/synth/guitar answers, snare fills and phrase-level crescendos. |

## Worker ownership

- Early composer owns only `src/music/early-stages.ts` for test/forest/gate/mines. The four revisions have already been written and independently validated at 164/142/156/172 BPM. A recovery attempt should verify the existing work against this brief and run the score tests, not recompose it or edit other files unless a test proves a defect. The first attempt's completion signal lacked its runtime capability; preserve its code and report using the fresh injected preamble.
- Late composer owns only `src/music/late-stages.ts` for manor/gardens/gingerbread/volcano.
- Playback/menu worker owns only `src/audio.ts`, `src/music/index.ts`, `tests/audio.test.ts`, plus a new instrument helper/test if needed. Rework menu and improve instrument definitions. Preserve all public APIs and scheduling bounds. Add optional fourth `StageMusic` argument to `AudioEngine.update` for studio A/B review, without changing game routing.
- Coordinator owns shared types, previous-score snapshots under `studio/music/`, studio A/B integration, documentation and score/review tests.

Shared supported voices are flute, brass, strings, bell, organ, pluck, bass, kick, snare, hat, plus new piano, guitar, synth and ghost voices. All MIDI-note events must have finite times, positive durations/volumes, legal note/pan values, and no extension past the loop boundary. No dependencies, copyrighted audio, commits or edits outside ownership.

## Sources

[1] https://www.jp.square-enix.com/music/en/lineup/item/SQEX-10121.html

[2] https://www.squareenixmusic.com/reviews/kie/chocoboracing.html

[3] https://gamefaqs.gamespot.com/ps/196911-chocobo-racing/faqs/16691
