import type { Hosting } from '../network.ts';

export type EntryCard = 'create' | 'join';
export interface EntryNotice { card: EntryCard; text: string }

/**
 * Online mode on the home screen: creating and joining are two separate cards of equal weight, so nobody creates a room
 * while meaning to join one. Racer and ability are chosen inside the room.
 */
const HOSTING_HINT: Record<Hosting, string> = {
  server: 'The race server runs the race.',
  device: 'Your browser runs the race and friends connect straight to it. Keep this tab open while you play.',
};
const hostingHtml = (hosting: Hosting, disabled: string) => `<fieldset class="host-choice" ${disabled}><legend>RACE RUNS ON</legend>${(['server', 'device'] as const).map(id => `<label><input type="radio" name="hosting" value="${id}" ${hosting === id ? 'checked' : ''}><span>${id === 'server' ? 'Race server' : 'My device'}</span></label>`).join('')}</fieldset><p class="host-hint">${HOSTING_HINT[hosting]}</p>`;
export function onlineEntryHtml(name: string, code: string, hosting: Hosting, busy: EntryCard | null, notice: EntryNotice | null, esc: (s: string) => string) {
  const alert = (card: EntryCard) => notice?.card === card ? `<p class="entry-error" role="alert">${esc(notice.text)}</p>` : '';
  const disabled = busy ? 'disabled' : '';
  return `<div class="fields online-name"><label>NAME<input id="player-name" aria-label="Your name" value="${esc(name)}" maxlength="18" autocomplete="nickname"></label></div>
<div class="entry-cards">
<section class="entry-card" aria-labelledby="create-title"><h2 id="create-title">Create a room</h2><p>Host a new private room and invite up to five friends.</p>${hostingHtml(hosting, disabled)}${alert('create')}${busy === 'create' ? `<p class="entry-status" role="status">${hosting === 'device' ? 'Opening a room on this device…' : 'Connecting to the race server…'}</p>` : ''}<button class="entry-button" data-action="create" ${disabled}>${busy === 'create' ? 'Creating…' : 'Create room'}</button></section>
<section class="entry-card" aria-labelledby="join-title"><h2 id="join-title">Join a room</h2><p>Enter the code a friend shared with you.</p><input id="join-code" aria-label="Room code" placeholder="ROOM CODE" value="${esc(code)}" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" ${notice?.card === 'join' ? 'aria-invalid="true"' : ''}>${alert('join')}${busy === 'join' ? `<p class="entry-status" role="status">Connecting to room ${esc(code)}…</p>` : ''}<button class="entry-button" data-action="join" ${disabled}>${busy === 'join' ? 'Joining…' : 'Join room'}</button></section>
</div>`;
}
