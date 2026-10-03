import type { StudioElement } from './types.ts';
import { characters } from './elements/characters.ts';
import { items } from './elements/items.ts';
import { effects } from './elements/effects.ts';
import { stage } from './elements/stage.ts';
import { courses } from './elements/courses.ts';

/** Everything the studio can show. Add a file under elements/ and list it here to register more. */
export const ELEMENTS: StudioElement[] = [...characters, ...items, ...effects, ...stage, ...courses];
export const elementById = new Map(ELEMENTS.map(e => [e.id, e]));
