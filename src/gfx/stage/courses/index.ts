import type { TrackId } from '../../../../shared/track/index.ts';
import type { CourseArt } from '../types.ts';
import { test } from './test.ts';
import { forest } from './forest.ts';
import { gate } from './gate.ts';
import { mines } from './mines.ts';
import { manor } from './manor.ts';
import { gardens } from './gardens.ts';
import { gingerbread } from './gingerbread.ts';
import { volcano } from './volcano.ts';

/** Art for every course, keyed by track id. Each course lives in its own file. */
export const COURSE_ART: Record<TrackId, CourseArt> = { test, forest, gate, mines, manor, gardens, gingerbread, volcano };
