export type EntryCard = 'create' | 'join';
export interface EntryNotice { card: EntryCard; text: string }

/**
 * Online mode on the home screen: creating and joining are two separate cards of equal weight, so nobody creates a room
 * while meaning to join one. Racer and ability are chosen inside the room.
 */
export function onlineEntryHtml(name: string, code: string, busy: EntryCard | null, notice: EntryNotice | null, esc: (s: string) => string) {
  const alert = (card: EntryCard) => notice?.card === card ? `<p class="entry-error" role="alert">${esc(notice.text)}</p>` : '';
  const disabled = busy ? 'disabled' : '';
  return `<div class="fields online-name"><label>NAME<input id="player-name" aria-label="Your name" value="${esc(name)}" maxlength="18" autocomplete="nickname"></label></div>
<div class="entry-cards">
<section class="entry-card" aria-labelledby="create-title"><h2 id="create-title">Create a room</h2><p>Host a new private room and invite up to five friends.</p>${alert('create')}${busy === 'create' ? '<p class="entry-status" role="status">Connecting to the race server…</p>' : ''}<button class="entry-button" data-action="create" ${disabled}>${busy === 'create' ? 'Creating…' : 'Create room'}</button></section>
<section class="entry-card" aria-labelledby="join-title"><h2 id="join-title">Join a room</h2><p>Enter the code a friend shared with you.</p><input id="join-code" aria-label="Room code" placeholder="ROOM CODE" value="${esc(code)}" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" ${notice?.card === 'join' ? 'aria-invalid="true"' : ''}>${alert('join')}${busy === 'join' ? `<p class="entry-status" role="status">Connecting to room ${esc(code)}…</p>` : ''}<button class="entry-button" data-action="join" ${disabled}>${busy === 'join' ? 'Joining…' : 'Join room'}</button></section>
</div>`;
}
