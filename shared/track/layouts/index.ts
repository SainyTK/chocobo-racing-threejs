import type { CourseLayout, TrackId } from '../types.ts';
import { test } from './test.ts';
import { forest } from './forest.ts';
import { gate } from './gate.ts';
import { mines } from './mines.ts';
import { manor } from './manor.ts';
import { gardens } from './gardens.ts';
import { gingerbread } from './gingerbread.ts';
import { volcano } from './volcano.ts';
import { fantasia } from './fantasia.ts';

/** Authored gimmicks for every course, keyed by track id. Each course lives in its own file. */
const LAYOUTS: Record<TrackId, CourseLayout> = { test, forest, gate, mines, manor, gardens, gingerbread, volcano, fantasia };
export const courseLayout = (id: TrackId) => LAYOUTS[id];
