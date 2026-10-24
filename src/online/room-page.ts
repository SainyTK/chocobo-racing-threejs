import { RACERS, ABILITIES, DIFFICULTIES, DIFFICULTY_IDS, GRID_SIZE } from '../../shared/game/index.ts';
import { TRACKS, TRACK_IDS } from '../../shared/track/index.ts';
import type { RoomView } from '../network.ts';
import { racerGridHtml } from '../racer-grid.ts';
import { abilityPickerHtml } from '../ability-picker.ts';

type Member = RoomView['members'][number];
const status = (m: Member, room: RoomView) => m.away ? 'Away' : !m.connected ? 'Reconnecting' : m.id === room.host ? 'Host' : 'Ready';

/** The online room: every member picks a racer and ability here, and the host sets up and starts the race. */
export function roomPanelHtml(room: RoomView, me: Member, portrait: (i: number) => string, esc: (s: string) => string) {
  const host = room.host === me.id, lock = host ? '' : 'disabled';
  const roster = Array.from({ length: GRID_SIZE }, (_, i) => {
    const m = room.members[i];
    if (!m) return `<li class="open">${portrait(i % RACERS.length)}<span><strong>CPU racer</strong><small>Open place</small></span></li>`;
    return `<li class="${m.id === me.id ? 'you' : ''} ${m.connected ? '' : 'absent'}">${portrait(m.character)}<span><strong>${esc(m.name)}${m.id === me.id ? ' <em>YOU</em>' : ''}</strong><small>${RACERS[m.character].name} · ${ABILITIES[m.abilityId].name}</small><small class="state">${status(m, room)}</small></span></li>`;
  }).join('');
  const select = (id: string, label: string, options: string) => `<label>${label}<select id="${id}" aria-label="Room ${label.toLowerCase()}" ${lock}>${options}</select></label>`;
  return `<section class="panel setup room" aria-label="Online room">
<div class="room-head"><div><div class="section-title">ONLINE ROOM · ${room.members.filter(m => m.connected).length} / ${GRID_SIZE}</div><span class="room-code-label">CODE <strong id="room-code">${room.code}</strong></span></div><button data-action="copy">Copy invite</button></div>
<div class="fields room-name"><label>NAME<input id="room-name" aria-label="Your name" value="${esc(me.name)}" maxlength="18" autocomplete="nickname"></label></div>
${racerGridHtml(me.character, portrait)}
${abilityPickerHtml(me.abilityId, 'room')}
<ul class="roster" aria-label="Racers in this room">${roster}</ul>
<div class="fields room-fields">${select('lobby-track', 'COURSE', TRACK_IDS.map(id => `<option value="${id}" ${room.track === id ? 'selected' : ''}>${TRACKS[id].name}</option>`).join(''))}${select('lobby-laps', 'LAPS', [1, 2, 3].map(n => `<option ${room.laps === n ? 'selected' : ''}>${n}</option>`).join(''))}${select('lobby-class', 'CLASS', DIFFICULTY_IDS.map(id => `<option value="${id}" ${room.difficulty === id ? 'selected' : ''}>${DIFFICULTIES[id].name}</option>`).join(''))}</div>
<div class="room-actions"><button data-action="home">◀ Back to home</button>${host ? '<button class="primary start-button" data-action="start" aria-label="START ONLINE RACE">START ONLINE RACE <span>▶</span></button>' : '<p class="room-wait">Waiting for the host to start the race.</p>'}</div>
<p class="fine">Going home keeps your place for 60 seconds. Enter the code again to come back.</p>
</section>`;
}
