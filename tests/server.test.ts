import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createGameServer } from '../server/index.ts';
import { stepRace } from '../shared/game/index.ts';
let server: Awaited<ReturnType<typeof createGameServer>>, url: string;
const clients: Socket[] = [];
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/** Polls until `ready` holds, so assertions do not depend on how fast the machine delivers socket messages. */
async function until(ready: () => unknown, timeout = 4000) { const end = Date.now() + timeout; while (!ready()) { if (Date.now() > end) throw new Error(`Timed out waiting for ${ready}`); await wait(10); } }
async function connect(token?: string, origin?: string) {
  const socket = io(url, { auth: { token }, forceNew: true, reconnection: false, transports: ['websocket'], extraHeaders: origin ? { origin } : undefined }); clients.push(socket);
  const welcome = await new Promise<{ id: string; token: string }>((resolve, reject) => { socket.once('welcome', resolve); socket.once('connect_error', reject); });
  return { socket, ...welcome };
}
function request(socket: Socket, event: string, data: unknown = {}) { return new Promise<any>((resolve, reject) => socket.timeout(2000).emit(event, data, (e: unknown, result: unknown) => e ? reject(e) : resolve(result))); }
beforeEach(async () => { server = await createGameServer(); await new Promise<void>(resolve => server.http.listen(0, '127.0.0.1', resolve)); url = `http://127.0.0.1:${(server.http.address() as any).port}`; });
afterEach(async () => { clients.splice(0).forEach(s => s.disconnect()); await server.close(); });
describe('real multiplayer server', () => {
  it('creates a private lobby, joins a second human, synchronizes movement and finishes a rematch lifecycle', async () => {
    const a = await connect(), b = await connect(); const created = await request(a.socket, 'create', { name: 'Host', character: 0, track: 'test', laps: 1 }); expect(created.code).toMatch(/^[A-F0-9]{6}$/);
    expect((await request(b.socket, 'join', { name: 'Friend', character: 7, abilityId: 'flap', code: created.code.toLowerCase() })).ok).toBe(true);
    let stateA: any, stateB: any; a.socket.on('state', s => stateA = s); b.socket.on('state', s => stateB = s);
    expect((await request(a.socket, 'start')).ok).toBe(true); await until(() => stateA && stateB && stateA.id === stateB.id);
    expect(stateA.id).toBe(stateB.id); expect(stateA.racers).toHaveLength(6); expect(stateA.racers.filter((p: any) => !p.bot)).toHaveLength(2); expect(stateA.racers.find((p: any) => p.id === b.id)).toMatchObject({ character: 7, abilityId: 'flap' });
    const r = server.rooms.get(created.code)!.race!; r.time = 0;
    a.socket.emit('input', { throttle: true, steer: .5, s: 999999, speed: 999999 }); b.socket.emit('input', { throttle: true, steer: -.5 });
    const sOf = (state: any) => state.racers.find((p: any) => p.id === a.id).s; await until(() => sOf(stateA) > 0 && sOf(stateA) === sOf(stateB));
    expect(stateA.racers.find((p: any) => p.id === a.id).s).toBeLessThan(20); expect(stateB.racers.find((p: any) => p.id === a.id).s).toBe(stateA.racers.find((p: any) => p.id === a.id).s);
    expect(r.racers.find(p => p.id === a.id)!.x).toBeGreaterThan(-6.3);
    r.racers.forEach(p => p.bot = true); for (let i = 0; i < 6000; i++) stepRace(r); await until(() => stateA.phase === 'finished');
    expect((await request(a.socket, 'rematch')).ok).toBe(true); expect(server.rooms.get(created.code)!.race).toBeNull();
    expect((await request(a.socket, 'start')).ok).toBe(true); expect(server.rooms.get(created.code)!.race!.phase).toBe('countdown');
  });
  it('checks host permissions and rejects unknown rooms or races in progress', async () => {
    const a = await connect(), b = await connect(); expect((await request(b.socket, 'join', { code: 'ABCDEF' })).error).toMatch(/not found/);
    const { code } = await request(a.socket, 'create'); await request(b.socket, 'join', { code });
    expect((await request(b.socket, 'start')).error).toMatch(/host/); expect((await request(b.socket, 'configure', { laps: 1 })).error).toMatch(/host/);
    await request(a.socket, 'start'); const c = await connect(); expect((await request(c.socket, 'join', { code })).error).toMatch(/already started/);
    expect((await request(a.socket, 'rematch')).error).toMatch(/finish/);
  });
  it('sanitizes names and refuses prototype names as course identifiers', async () => {
    const a = await connect(); const { code } = await request(a.socket, 'create', { name: '<script>evil\u0000', track: '__proto__', character: 999, laps: 500 });
    const r = server.rooms.get(code)!; expect(r.track).toBe('test'); expect(r.laps).toBe(3); expect(r.members[0].character).toBe(0); expect(r.members[0].name).toBe('scriptevil');
    await request(a.socket, 'configure', { track: 'constructor', laps: 1 }); expect(r.track).toBe('test'); expect(r.laps).toBe(1);
  });
  it('resumes an authenticated racer and transfers host on disconnect', async () => {
    const a = await connect(), b = await connect(); const { code } = await request(a.socket, 'create'); await request(b.socket, 'join', { code }); await request(a.socket, 'start');
    const room = server.rooms.get(code)!; a.socket.disconnect(); await until(() => room.host === b.id); expect(room.race!.racers.find(p => p.id === a.id)!.connected).toBe(false);
    const resumed = await connect(a.token); await until(() => room.race!.racers.find(p => p.id === a.id)!.connected); expect(resumed.id).toBe(a.id); expect(room.members).toHaveLength(2); expect(room.race!.racers.find(p => p.id === a.id)!.connected).toBe(true);
    const stranger = await connect(a.id); expect(stranger.id).not.toBe(a.id);
  });
  it('reserves disconnected lobby slots when starting and permits later recovery', async () => {
    const a = await connect(), b = await connect(); const { code } = await request(a.socket, 'create'); await request(b.socket, 'join', { code }); const room = server.rooms.get(code)!; b.socket.disconnect(); await until(() => !room.members.find(m => m.id === b.id)!.connected); await request(a.socket, 'start');
    expect(room.race!.racers.find(p => p.id === b.id)?.connected).toBe(false);
    await connect(b.token); await until(() => room.race!.racers.find(p => p.id === b.id)?.connected); expect(room.race!.racers.find(p => p.id === b.id)?.connected).toBe(true);
  });
  it('limits lobbies to six real players and cleans up empty rooms', async () => {
    const a = await connect(), { code } = await request(a.socket, 'create');
    for (let i = 0; i < 5; i++) { const p = await connect(); expect((await request(p.socket, 'join', { code })).ok).toBe(true); }
    const overflow = await connect(); expect((await request(overflow.socket, 'join', { code })).error).toMatch(/full/);
    for (const s of clients) await request(s, 'leave'); expect(server.rooms.size).toBe(0);
  });
  it('rate limits room actions', async () => { const a = await connect(); const answers = await Promise.all(Array.from({ length: 18 }, () => request(a.socket, 'join', { code: 'AAAAAA' }))); expect(answers.some(a => a.error?.includes('Too many'))).toBe(true); });
  it('rejects cross-origin WebSocket handshakes', async () => { await expect(connect(undefined, 'https://untrusted.example')).rejects.toThrow(); });
});
