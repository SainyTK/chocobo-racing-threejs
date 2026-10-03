import type { Race, Racer } from './types.ts';

export function event(r: Race, p: Racer, type: string, text: string, target?: string) { r.events.push({ id: ++r.eventId, time: r.time, type, player: p.id, text, target }); if (r.events.length > 40) r.events.shift(); }
