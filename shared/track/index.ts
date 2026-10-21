export type { TrackId, Surface, TrackDefinition, TrackPoint, Projection, StoneType, TrackStone, StoneField, CourseObjects, CourseLayout, Pad, Patch, PatchSurface, Ramp, Gap, Shortcut, ShortcutEdge, Hazard, HazardKind } from './types.ts';
export { TRACKS, TRACK_IDS } from './tracks.ts';
export { trackTable, trackLength, pointAt, projectOnTrack, type Sample } from './sampling.ts';
export { courseObjects } from './objects.ts';
export { courseLayout } from './layouts/index.ts';
export { hazardState, type HazardState } from './hazards.ts';
export { shortcutPaths, shortcutPoint, projectOnShortcut, type ShortcutPath } from './shortcuts.ts';
export { locate, routeHeight, routePoint, MAIN_ROUTE, type Place } from './route.ts';
export { along, patchAt, rampAt, inGap, restartPoint } from './surface.ts';
