import { randomRoomCode } from '../../shared/random-id.ts';
import type { Env } from './env.ts';
import { originAllowed } from './origins.ts';

export { RoomObject } from './room.ts';

/** Fresh codes tried before a new host is told to retry; collisions are rare among 16.7 million codes. */
const CODE_ATTEMPTS = 8;
const ROUTE = /^\/rooms\/([0-9A-F]{6}|new)(?:\/(host|guest))?$/;

function cors(response: Response, origin: string | null) {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin); headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

/**
 * The signaling Worker for player-hosted rooms. `GET /rooms/<code>` says whether a room can be joined;
 * `/rooms/new/host`, `/rooms/<code>/host` and `/rooms/<code>/guest` open WebSockets to that code's Durable Object.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get('Origin');
    if (url.pathname === '/health') return cors(Response.json({ ok: true }), origin);
    if (!originAllowed(origin, env.ALLOWED_ORIGINS)) return new Response('Origin not allowed.', { status: 403 });
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);
    const match = ROUTE.exec(url.pathname);
    if (!match || request.method !== 'GET') return new Response('Not found.', { status: 404 });
    const [, code, role] = match;
    const forward = (target: string, path: string) => env.ROOMS.get(env.ROOMS.idFromName(target)).fetch(new Request(`https://room/${target}/${path}`, request));
    if (code === 'new') {
      if (role !== 'host') return new Response('Not found.', { status: 404 });
      for (let i = 0; i < CODE_ATTEMPTS; i++) {
        const candidate = randomRoomCode();
        const response = await forward(candidate, 'host?new');
        if (response.status !== 409) return response;
      }
      return new Response('No free room code. Try again.', { status: 503 });
    }
    if (!role) return cors(await forward(code, 'info'), origin);
    return forward(code, `${role}${url.search}`);
  },
} satisfies ExportedHandler<Env>;
