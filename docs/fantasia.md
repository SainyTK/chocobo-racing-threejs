# Fantasia, the Bahamut stage

Fantasia is course 9 of the 1999 PlayStation Chocobo Racing: the realm of the Espers, the stage of Story chapter 9 "Final Fantasia", where Bahamut is the challenger.
In the original it unlocks after the first Story clear, it is the longest course at 2,623 m (1.63 mi), and it is rated 5 of 5.
The remake has no Story mode, so Fantasia is always selectable, as the ninth course after Vulcan-O Valley.

## Sources

- Final Fantasy Wiki (Fandom), "Fantasia (Chocobo Racing)": the lap described section by section, the course map, and five in-race screenshots (Carbuncle, Ifrit, Odin, Shiva, Sylph and Unicorn).
- GameFAQs guides 74730, 8434, 4958, 4961 and 4962: the shortcut, the hills near the end, the tunnel where Haste is safe, the stone set, the unlock and the 3:15 Story par time.
- GameFAQs music FAQ 16691: the course theme arranges Final Fantasy III's final battle music.
- Marathon Recaps (2024): "nearly all pits, with only a few railings generally on only one side of the track", Leviathan at the start and Ramuh's fireworks near the end.
- A Bahamut Class lap video ("Chocobo Racing Goblin (Magic Plus) - Fantasia" on YouTube), read frame by frame, with the player's minimap dot traced through a lap.

## Layout

The control points in `shared/track/tracks.ts` were traced from the original course map, which the in-game minimap and the course selection now reproduce.
The lap runs:

1. The start straight on the right, heading north under three of Leviathan's coils, with an orange and white checkered line as in the original.
2. Leviathan's coils: three linked lobes with Leviathan heads rising from the void beside them.
3. The top straight, with Carbuncles on pedestals and the first stone field.
4. A hard left, a diagonal past the sleeping Titan, and a tight right hairpin.
5. The upper arm of the far-left spike, the sharpest hairpin of the course at its tip, and the descent under a blue light with two Shivas.
6. The lower S past the Sylphs and the Unicorn.
7. The climb to the bottom right, a walled tunnel with Carbuncles and Sylphs in its niches, and the semicircle where Ramuh calls down lightning into the void.
8. Winding turns past Ifrit, two rolling crests (the original's "hills at the end"), Odin on a raised ledge, and the sharp turns back to the line.

The remake's lap is 2,148 m, the longest in the game; three CPU laps take about 2:50 to 3:30, close to the original's 3:15 Story par.

## Gimmicks

All of them are simulation data in `shared/track/layouts/fantasia.ts`, shared by the server, client prediction and the renderer.

- Pits: Fantasia is a cliff course, so leaving the shoulder anywhere without a railing drops you into the void.
- Railings: a new layout feature, `rails`. Each railing runs along one edge for a stretch of the lap and stops racers like a wall; the other edge stays a drop. Through Leviathan's coils the railing switches sides lobe by lobe, on the outside of each bend. The sharpest hairpin has none.
- Walkway shortcut: a narrow, railless, blue-lit walkway 1.8 m below the road edge, from the spike's upper arm across to its lower arm, skipping the far-left hairpin. You reach it by dropping off the road edge at a sharp 60 degree angle, as players found the original's hidden shortcut "by the sharpest hairpin in the upper left" by falling off. It climbs back to road level by its exit, where the far edge is railed. It gains about 2 to 3 s. Shortcuts can now have a `drop`: a racer leaving a ledge keeps its height and falls onto the lower surface.
- Tunnel: railed on both sides.
- Ramuh's lightning: scenery, as the sources describe it. Bolts flash down into the void beside the semicircle one at a time, and sparks circle overhead.
- Hills: the new optional `hills` field on a course definition adds rolling crests to the road height.
- Stones: every type, and Fantasia is the only course with Ultima stones on the road. In the story, Ultima stones were sealed in this realm.
- No boost pads: no source or footage shows any on Fantasia.

## Look

The course art is `src/gfx/stage/courses/fantasia.ts`, and the Espers are `src/gfx/stage/props/espers.ts`.

- A dark crystal cavern: black void below, rock masses rising around the course, stalactites over the void, a green aurora glow overhead and crystal glints in the dark.
- Grey mottled stone road with a rubble shoulder and the original's dark blue rim, over a rock keel.
- Yellow and green tube railings on teal posts, and white corner boards with red arrows.
- Coloured light pools and shafts for each Esper's grotto: blue for Shiva and the walkway, teal for the Sylphs and the tunnel, red for Ifrit, pale blue for Ramuh, violet for Odin and Titan.
- Violet and blue crystal clusters on floating ledges all round the lap.

## Music

"The last trial of Fantasia" is a newly written D-minor score at 168 BPM: a brass line over organ and string stabs and a galloping bass, after the final-battle arrangement Racing used for Fantasia (OST 25).
Like the other scores it is an original composition, not a transcription.
It was written after the music revision, so the Studio has no previous composition to compare it with.

## Differences from the original

- The original's three loops at the start cross over themselves. The remake's road never passes over itself (walls, the nearest-road field, terrain and projection all rely on that), so they are three linked lobes instead.
- The walkway is a constant 3.2 m half width and climbs smoothly back to the road; the original's exact shape and height are not known.
- The original uses large sprites for the Espers; the remake builds them as low-poly cel-shaded figures.
- Bahamut himself does not appear as scenery.
