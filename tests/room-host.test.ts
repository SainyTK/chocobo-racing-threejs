import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RoomHost } from '../shared/room/host.ts';
import type { Connection, Link } from '../shared/room/types.ts';
import { WIRE_VERSION, decodeSnapshot, type Snapshot } from '../shared/wire.ts';
import { stepRace } from '../shared/game/index.ts';

const CODE = 'C0FFEE';
let host: RoomHost;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/** Polls until `ready` holds, so assertions do not depend on how fast the room loop runs. */
async function until(ready: () => unknown, timeout = 4000) { const end = Date.now() + timeout; while (!ready()) { if (Date.now() > end) throw new Error(`Timed out waiting for ${ready}`); await wait(10); } }

/** A player's link to the room host, as a guest pipe or the hosting page would make one. Messages are copied like a network would. */
interface Client { id: string; token: string; open: boolean; connection: Connection; on(event: string, fn: (data: any) => void): void; count(event: string): number }
/** `wire: 'none'` makes a client that announces no version. */
function connect(token = '', wire: number | 'none' = WIRE_VERSION) {
  const listeners = new Map<string, ((data: any) => void)[]>(), counts = new Map<string, number>();
  const client = { id: '', token: '', open: true } as Client;
  const deliver = (event: string, data: unknown) => {
    counts.set(event, (counts.get(event) ?? 0) + 1);
    const copy = structuredClone(data);
    if (event === 'welcome') { client.id = (copy as any).id; client.token = (copy as any).token; }
    for (const fn of listeners.get(event) ?? []) fn(copy);
  };
  const link: Link = { wire: wire === 'none' ? undefined : wire, send: deliver, sendVolatile: deliver, close: () => { client.open = false; } };
  client.on = (event, fn) => listeners.set(event, [...listeners.get(event) ?? [], fn]);
  client.count = event => counts.get(event) ?? 0;
  const connection = host.attach(link, token);
  if (connection) client.connection = connection;
  return client;
}
function request(client: Client, event: string, data: unknown = {}) { return new Promise<any>(resolve => client.connection.receive(event, structuredClone(data), resolve)); }
const disconnect = (client: Client) => client.connection.closed();
const room = () => host.rooms.get(CODE)!;

beforeEach(() => { host = new RoomHost({ code: CODE, diagnostics: true }); });
afterEach(() => host.close());

describe('room host', () => {
  it('creates a private lobby, joins a second human, synchronizes movement and finishes a rematch lifecycle', async () => {
    const a = connect(), b = connect(); const created = await request(a, 'create', { name: 'Host', character: 0, track: 'test', laps: 1 }); expect(created.code).toBe(CODE);
    expect((await request(b, 'join', { name: 'Friend', character: 7, abilityId: 'flap', code: CODE.toLowerCase() })).ok).toBe(true);
    let meta: any, stateA: any, stateB: any;
    a.on('race', r => { meta = r; stateA = r; }); b.on('race', r => { stateB = r; });
    a.on('snapshot', (s: Snapshot) => { stateA = decodeSnapshot(meta, s); }); b.on('snapshot', (s: Snapshot) => { stateB = decodeSnapshot(meta, s); });
    expect((await request(a, 'start')).ok).toBe(true); await until(() => stateA && stateB && stateA.id === stateB.id);
    expect(stateA.racers).toHaveLength(6); expect(stateA.racers.filter((p: any) => !p.bot)).toHaveLength(2); expect(stateA.racers.find((p: any) => p.id === b.id)).toMatchObject({ character: 7, abilityId: 'flap' });
    const r = room().race!; r.time = 0;
    // Unknown fields such as a claimed position are ignored; only the input is taken.
    a.connection.receive('input', { race: r.id, seq: 1, input: { throttle: true, steer: .5 }, s: 999999, speed: 999999 }); b.connection.receive('input', { race: r.id, seq: 1, input: { throttle: true, steer: -.5 } });
    const sOf = (state: any) => state.racers.find((p: any) => p.id === a.id).s; await until(() => sOf(stateA) > 0 && sOf(stateA) === sOf(stateB));
    expect(sOf(stateA)).toBeLessThan(20); expect(r.racers.find(p => p.id === a.id)!.x).toBeGreaterThan(-6.3);
    r.racers.forEach(p => p.bot = true); for (let i = 0; i < 6000; i++) stepRace(r); await until(() => stateA.phase === 'finished');
    expect((await request(a, 'rematch')).ok).toBe(true); expect(room().race).toBeNull();
    expect((await request(a, 'start')).ok).toBe(true); expect(room().race!.phase).toBe('countdown');
  });
  it('checks host permissions and rejects unknown rooms or races in progress', async () => {
    const a = connect(), b = connect(); expect((await request(b, 'join', { code: 'ABCDEF' })).error).toMatch(/not found/);
    await request(a, 'create'); await request(b, 'join', { code: CODE });
    expect((await request(b, 'start')).error).toMatch(/host/); expect((await request(b, 'configure', { laps: 1 })).error).toMatch(/host/);
    await request(a, 'start'); const c = connect(); expect((await request(c, 'join', { code: CODE })).error).toMatch(/already racing/);
    expect((await request(a, 'rematch')).error).toMatch(/finish/);
    expect((await request(c, 'create')).error).toMatch(/already exists/);
  });
  it('sanitizes names and refuses prototype names as course identifiers', async () => {
    const a = connect(); await request(a, 'create', { name: '<script>evil\u0000', track: '__proto__', character: 999, laps: 500 });
    const r = room(); expect(r.track).toBe('test'); expect(r.laps).toBe(3); expect(r.members[0].character).toBe(0); expect(r.members[0].name).toBe('scriptevil');
    await request(a, 'configure', { track: 'constructor', laps: 1 }); expect(r.track).toBe('test'); expect(r.laps).toBe(1);
  });
  it('resumes an authenticated racer and transfers host on disconnect', async () => {
    const a = connect(), b = connect(); await request(a, 'create'); await request(b, 'join', { code: CODE }); await request(a, 'start');
    const r = room(); disconnect(a); expect(r.host).toBe(b.id); expect(r.race!.racers.find(p => p.id === a.id)!.connected).toBe(false);
    const resumed = connect(a.token); expect(resumed.id).toBe(a.id); expect(r.members).toHaveLength(2); expect(r.race!.racers.find(p => p.id === a.id)!.connected).toBe(true);
    const stranger = connect(a.id); expect(stranger.id).not.toBe(a.id);
  });
  it('reserves disconnected lobby slots when starting and permits later recovery', async () => {
    const a = connect(), b = connect(); await request(a, 'create'); await request(b, 'join', { code: CODE }); disconnect(b); expect(room().members.find(m => m.id === b.id)!.connected).toBe(false);
    await request(a, 'start'); expect(room().race!.racers.find(p => p.id === b.id)?.connected).toBe(false);
    connect(b.token); expect(room().race!.racers.find(p => p.id === b.id)?.connected).toBe(true);
  });
  it('limits lobbies to six real players and cleans up empty rooms', async () => {
    const a = connect(), players = [a]; await request(a, 'create');
    for (let i = 0; i < 5; i++) { const p = connect(); players.push(p); expect((await request(p, 'join', { code: CODE })).ok).toBe(true); }
    const overflow = connect(); expect((await request(overflow, 'join', { code: CODE })).error).toMatch(/full/);
    for (const p of players) await request(p, 'leave'); expect(host.rooms.size).toBe(0);
  });
  it('refuses a client of another wire version with a reload notice', () => {
    const old = connect('', WIRE_VERSION - 1);
    expect(old.open).toBe(false); expect(old.count('welcome')).toBe(0); expect(old.count('outdated')).toBe(1);
    const unversioned = connect('', 'none'); expect(unversioned.open).toBe(false); expect(unversioned.count('welcome')).toBe(0);
  });
  it('rate limits room actions', async () => { const a = connect(); const answers = await Promise.all(Array.from({ length: 18 }, () => request(a, 'join', { code: 'AAAAAA' }))); expect(answers.some(a => a.error?.includes('Too many'))).toBe(true); });
  it('acknowledges applied input, rejects reorder and resends actions without duplicate effects', async () => {
    const a = connect(), b = connect(); await request(a, 'create'); await request(b, 'join', { code: CODE });
    let meta: any, state: any, packet: Snapshot | undefined;
    a.on('race', r => { meta = r; state = r; });
    a.on('snapshot', s => { packet = s; state = decodeSnapshot(meta, s); });
    await request(a, 'start'); await until(() => meta);
    const r = room().race!; r.time = 1; r.phase = 'racing';
    a.connection.receive('input', { race: r.id, seq: 2, input: { throttle: true } });
    a.connection.receive('input', { race: r.id, seq: 1, input: { brake: true } });
    await until(() => packet?.ack[a.id] === 2); expect(state.racers.find((p: any) => p.id === a.id).speed).toBeGreaterThan(0);
    const p = r.racers.find(p => p.id === a.id)!; p.ability = 100;
    const action = { race: r.id, seq: 1, kind: 'ability' };
    expect((await request(a, 'action', action)).ok).toBe(true);
    await until(() => r.events.some(e => e.player === a.id && e.type === 'ability'));
    await request(a, 'action', action); await wait(100);
    expect(r.events.filter(e => e.player === a.id && e.type === 'ability')).toHaveLength(1);
    const rescue = { race: r.id, seq: 2, kind: 'rescue' }; await request(a, 'action', rescue); await until(() => p.lastRescue > 0);
    const rescued = p.lastRescue; await request(a, 'action', rescue); await wait(100); expect(p.lastRescue).toBe(rescued);
    p.stones = [{ kind: 'haste', level: 1 }, { kind: 'haste', level: 2 }];
    const item = { race: r.id, seq: 3, kind: 'item' }; await request(a, 'action', item); await until(() => p.stones.length === 1);
    await request(a, 'action', item); await wait(100); expect(p.stones).toHaveLength(1);
    expect(r.events.filter(e => e.player === a.id && e.type === 'haste')).toHaveLength(1);
    expect((await request(a, 'action', { ...action, race: 'old-race', seq: 4 })).error).toBeTruthy();
    disconnect(a); expect(p.connected).toBe(false);
    const back = connect(a.token); let initial: any; back.on('race', race => { initial = race; });
    await request(back, 'join', { code: CODE }); expect(initial.id).toBe(r.id); expect(initial.racers.find((p: any) => p.id === a.id).lastRescue).toBe(rescued);
  });
  it('supports six human racers and emits at most one latest snapshot after a stall', async () => {
    const a = connect(); await request(a, 'create');
    for (let i = 0; i < 5; i++) { const b = connect(); await request(b, 'join', { code: CODE }); }
    const states: Snapshot[] = []; a.on('snapshot', s => states.push(s)); await request(a, 'start'); await until(() => states.length > 1);
    expect(room().race!.racers.filter(p => !p.bot)).toHaveLength(6);
    states.length = 0; host.metrics.snapshotsPerLoop.length = 0;
    const end = performance.now() + 180; while (performance.now() < end) { /* Block the loop like a busy page. */ } await until(() => states.length > 0);
    expect(Math.max(...host.metrics.snapshotsPerLoop)).toBe(1);
  });
  it('changes racer, ability and name in the lobby only, and refuses an outsider', async () => {
    const a = connect(), b = connect(), c = connect(); await request(a, 'create', { name: 'Host', character: 0 }); await request(b, 'join', { code: CODE, name: 'Friend', character: 1 });
    let seen: any; a.on('room', r => { seen = r; });
    expect((await request(b, 'profile', { name: 'Pal', character: 7, abilityId: 'flap' })).ok).toBe(true);
    expect(seen.members.find((m: any) => m.id === b.id)).toMatchObject({ name: 'Pal', character: 7, abilityId: 'flap' });
    await request(b, 'profile', { character: 2, abilityId: 'nonsense' }); expect(room().members[1]).toMatchObject({ character: 2, abilityId: 'grip', name: 'Racer' });
    expect((await request(c, 'profile', { character: 3 })).error).toMatch(/Join a room/);
    await request(a, 'configure', { difficulty: 'chocobo' }); expect(room().difficulty).toBe('chocobo');
    await request(a, 'start'); expect((await request(b, 'profile', { character: 4 })).error).toMatch(/lobby/);
    expect(room().race!.racers.find(p => p.id === b.id)!.character).toBe(2);
  });
  it('keeps the place of a member who steps away and restores it on the same code without a duplicate', async () => {
    const a = connect(), b = connect(); await request(a, 'create'); await request(b, 'join', { code: CODE }); const r = room();
    await request(a, 'away'); expect(r.members).toHaveLength(2); expect(r.members[0]).toMatchObject({ away: true, connected: false }); expect(r.host).toBe(b.id);
    let rooms = 0; a.on('room', () => rooms++); await request(b, 'configure', { laps: 1 }); expect(rooms).toBe(0);
    expect((await request(a, 'profile', { character: 3 })).error).toBeTruthy();
    expect((await request(a, 'join', { code: CODE })).ok).toBe(true); expect(r.members).toHaveLength(2); expect(r.members[0]).toMatchObject({ id: a.id, away: false, connected: true });
    await request(a, 'join', { code: CODE }); expect(r.members).toHaveLength(2);
    await request(a, 'away'); await request(b, 'start'); expect(r.race!.racers.find(p => p.id === a.id)!.connected).toBe(false);
    let initial: any; a.on('race', race => { initial = race; }); await request(a, 'join', { code: CODE }); expect(initial).toBeTruthy(); expect(r.race!.racers.find(p => p.id === a.id)!.connected).toBe(true);
  });
  it('a closed room says so, and closing tells every member', async () => {
    const a = connect(), b = connect(); await request(a, 'create'); await request(b, 'join', { code: CODE });
    let closed: any; b.on('closed', data => { closed = data; });
    host.closeRoom(CODE, `The host closed room ${CODE}.`); expect(closed.message).toMatch(/host closed/); expect(host.rooms.has(CODE)).toBe(false);
    expect((await request(b, 'join', { code: CODE })).error).toMatch(/has closed/); expect((await request(b, 'join', { code: '' })).error).toMatch(/Enter/);
  });
});
