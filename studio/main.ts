import './style.css';
import { ELEMENTS, elementById } from './registry.ts';
import { searchElements } from './search.ts';
import { BACKGROUNDS, MAX_PANES, SPEEDS, decodeState, encodeState, type Background, type PaneState, type Quality, type StudioState } from './state.ts';
import { setOrbDetail } from '../src/gfx/orbs/index.ts';
import { CATEGORIES, type StudioElement } from './types.ts';
import { Viewport, defaultView, type ViewState } from './viewport.ts';
import { StudioMusicPlayer } from './music-player.ts';
import { musicForVariant } from './music/review.ts';

const LETTERS = 'ABCD';
const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const defaultVariant = (e: StudioElement) => (e.variants.find(v => v.inGame) ?? e.variants[0]).id;
const resolve = (element: string, variant: string): PaneState | null => {
  const e = elementById.get(element); if (!e) return null;
  return { element, variant: e.variants.some(v => v.id === variant) ? variant : defaultVariant(e) };
};
const FALLBACK: StudioState = { panes: [{ element: ELEMENTS[0].id, variant: defaultVariant(ELEMENTS[0]) }], active: 0, background: 'night', ground: true, quality: 'high', link: true, spin: false, speed: 1 };

let state = decodeState(location.hash, FALLBACK, resolve);
let paused = false, clock = 0, query = '', highlight = 0, captureNext = false;
const sharedView = defaultView(), panes: { vp: Viewport; el: HTMLElement; own: ViewState }[] = [];
const musicPlayer = new StudioMusicPlayer();
let musicVolume = 1;
Object.defineProperty(window, '__studioAudio', { get: () => musicPlayer.status });

document.querySelector('#studio')!.innerHTML = `
  <header class="bar">
    <div class="brand">Chocobo Racing <b>Studio</b></div>
    <div class="group" role="group" aria-label="Panes"><span class="label">Compare</span>${[1, 2, 3, 4].map(n => `<button class="seg" data-count="${n}" title="Show ${n} pane${n > 1 ? 's' : ''}">${n}</button>`).join('')}</div>
    <div class="group"><button id="play" title="Pause or play (Space)">Pause</button><button id="restart" title="Restart every pane in step (R)">Restart</button>
      <label class="select" title="Playback speed"><select id="speed" aria-label="Playback speed">${SPEEDS.map(s => `<option value="${s}">${s}x</option>`).join('')}</select></label></div>
    <div class="group"><label class="select">Background<select id="bg">${Object.keys(BACKGROUNDS).map(b => `<option value="${b}">${b[0].toUpperCase() + b.slice(1)}</option>`).join('')}</select></label>
      <button class="toggle" data-flag="link" title="Turn every pane together (L)">Link cameras</button><button class="toggle" data-flag="spin" title="Turntable (T)">Turntable</button>
      <button class="toggle" data-flag="ground" title="Ground grid and shadows">Ground</button><label class="select">Quality<select id="quality" title="Matches the game's quality setting"><option value="high">High</option><option value="low">Low</option></select></label></div>
    <div class="group end"><button id="copy" title="Copy a link to this exact comparison">Copy link</button><button id="save" title="Download all panes as one image">Save image</button></div>
  </header>
  <aside class="library">
    <div class="search"><input id="q" type="search" placeholder="Search elements" autocomplete="off" spellcheck="false" aria-controls="results"><kbd>/</kbd></div>
    <div id="results" class="results" role="listbox" aria-label="Elements"></div>
    <dl class="hint"><dt><kbd>Enter</kbd></dt><dd>Show in the active pane</dd><dt><kbd>Shift</kbd> <kbd>Enter</kbd></dt><dd>Add as a new pane</dd><dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>Previous or next variant</dd><dt><kbd>V</kbd></dt><dd>Compare all variants</dd><dt><kbd>1</kbd> to <kbd>4</kbd></dt><dd>Focus a pane</dd></dl>
  </aside>
  <main id="panes" class="panes"></main>
  <div id="toast" class="toast" role="status"></div>`;

const results = $<HTMLDivElement>('#results'), search = $<HTMLInputElement>('#q'), paneHost = $<HTMLElement>('#panes');

function commit() {
  history.replaceState(null, '', encodeState(state));
  document.querySelectorAll<HTMLButtonElement>('.seg').forEach(b => b.classList.toggle('on', Number(b.dataset.count) === state.panes.length));
  document.querySelectorAll<HTMLButtonElement>('.toggle').forEach(b => { const on = state[b.dataset.flag as 'link' | 'spin' | 'ground']; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  $<HTMLSelectElement>('#bg').value = state.background; $<HTMLSelectElement>('#quality').value = state.quality; setOrbDetail(state.quality === 'high' ? 1 : .5); $<HTMLSelectElement>('#speed').value = String(state.speed);
  $('#play').textContent = paused ? 'Play' : 'Pause';
  syncPanes();
  const activePane = state.panes[state.active];
  musicPlayer.select(musicForVariant(elementById.get(activePane.element), activePane.variant));
  musicPlayer.update(paused, document.hidden);
  updateMusicPanels(); renderResults();
}

// ---- Panes ----
function syncPanes() {
  while (panes.length > state.panes.length) { const p = panes.pop()!; p.vp.dispose(); p.el.remove(); }
  while (panes.length < state.panes.length) {
    const own = { ...sharedView }, vp = new Viewport(state.link ? sharedView : own), el = document.createElement('section'); el.className = 'pane';
    el.innerHTML = `<div class="pane-head"><span class="letter"></span><div class="title"><strong></strong><small></small></div><select class="variant" aria-label="Variant"></select><button class="all" title="Compare all variants of this element (V)">All variants</button><button class="close" title="Close pane" aria-label="Close pane">&times;</button></div><span class="badge">In game</span>
      <section class="music-card" hidden aria-label="Music preview">
        <span class="music-label">Newly composed music preview</span><h2 class="music-title"></h2><p class="music-info"></p>
        <p class="music-reference"></p><p class="music-direction"></p>
        <div class="music-controls"><button class="music-play">Play music</button><button class="music-restart">Restart music</button></div>
        <label class="music-volume">Volume<input type="range" min="0" max="100" value="100" aria-label="Music volume"></label>
        <progress class="music-progress" value="0" max="1" aria-label="Music loop progress"></progress>
        <p class="music-status"></p>
        <p class="music-note">Revised compositions are used in the game. Previous compositions are available for comparison through the same updated instruments. Only the active pane plays audio. These are newly authored pieces, not the original recordings.</p>
        <a class="music-source" href="https://sqex.lnk.to/gzCQxWYWTP" target="_blank" rel="noopener noreferrer">Listen to the original Chocobo Racing album</a>
      </section>`;
    el.prepend(vp.canvas); paneHost.append(el); panes.push({ vp, el, own });
    el.addEventListener('pointerdown', () => { if (state.active !== panes.findIndex(p => p.el === el)) { state.active = panes.findIndex(p => p.el === el); commit(); } });
    $<HTMLSelectElement>('.variant', el).addEventListener('change', e => { const i = panes.findIndex(p => p.el === el); state.panes[i] = { ...state.panes[i], variant: (e.target as HTMLSelectElement).value }; commit(); });
    $('.music-play', el).addEventListener('pointerdown', e => e.stopPropagation());
    $('.music-play', el).addEventListener('click', () => {
      const index = panes.findIndex(p => p.el === el), wasActive = index === state.active;
      state.active = index; commit();
      if (wasActive ? !(paused && musicPlayer.status.playing) : !musicPlayer.status.playing) musicPlayer.toggle();
      if (musicPlayer.status.playing) paused = false;
      commit();
    });
    $('.music-restart', el).addEventListener('click', () => {
      state.active = panes.findIndex(p => p.el === el); commit(); musicPlayer.restart(); updateMusicPanels();
    });
    $<HTMLInputElement>('.music-volume input', el).addEventListener('input', e => {
      musicVolume = Number((e.target as HTMLInputElement).value) / 100;
      musicPlayer.setVolume(musicVolume); updateMusicPanels();
    });
    $('.all', el).addEventListener('click', () => compareVariants(panes.findIndex(p => p.el === el)));
    $('.close', el).addEventListener('click', e => { e.stopPropagation(); closePane(panes.findIndex(p => p.el === el)); });
  }
  paneHost.dataset.count = String(panes.length);
  panes.forEach((p, i) => {
    const want = state.panes[i], e = elementById.get(want.element)!, variant = e.variants.find(v => v.id === want.variant)!;
    p.vp.view = state.link ? sharedView : p.own;
    if (p.vp.element !== e || p.vp.variant !== want.variant) p.vp.load(e, want.variant);
    p.vp.setOptions(state);
    p.el.classList.toggle('active', i === state.active && panes.length > 1);
    $('.letter', p.el).textContent = LETTERS[i]; $('strong', p.el).textContent = e.name; $('small', p.el).textContent = e.category;
    const select = $<HTMLSelectElement>('.variant', p.el);
    if (select.dataset.element !== e.id) { select.innerHTML = e.variants.map(v => `<option value="${v.id}">${esc(v.label)}</option>`).join(''); select.dataset.element = e.id; }
    select.value = want.variant; select.hidden = e.variants.length < 2; $('.all', p.el).hidden = e.variants.length < 2;
    $('.close', p.el).hidden = panes.length < 2;
    $('.badge', p.el).hidden = !variant.inGame || e.variants.every(v => v.inGame);
    p.el.classList.toggle('music-pane', !!e.music);
    $('.music-card', p.el).hidden = !e.music;
    const score = musicForVariant(e, want.variant);
    if (score) {
      $('.music-title', p.el).textContent = score.title;
      $('.music-info', p.el).textContent = `${variant.label} · ${score.bpm} BPM · ${score.beats / 4} bars · ${(score.beats * 60 / score.bpm).toFixed(1)} second loop`;
      $('.music-reference', p.el).textContent = e.musicReference ? `1999 reference: ${e.musicReference.title} · OST ${e.musicReference.track}` : '';
      $('.music-direction', p.el).textContent = want.variant === 'previous' ? 'Previous composition, kept for before/after review.' : e.musicReference?.direction ?? '';
    }
  });
}

function updateMusicPanels() {
  const status = musicPlayer.status;
  panes.forEach((p, i) => {
    const score = musicForVariant(p.vp.element, p.vp.variant); if (!score) return;
    const active = i === state.active;
    $('.music-play', p.el).textContent = active && status.playing ? paused ? 'Resume music' : 'Pause music' : 'Play music';
    $('.music-status', p.el).textContent = !active ? 'Select this pane to listen.'
      : status.running ? `Playing · ${status.positionSeconds.toFixed(1)} s`
      : status.playing && !paused && !document.hidden ? 'Audio is unavailable or blocked. Pause and play to retry.'
      : status.playing ? 'Paused' : 'Ready. Press Play music to listen.';
    const progress = $<HTMLProgressElement>('.music-progress', p.el);
    progress.max = score.beats * 60 / score.bpm; progress.value = active ? status.positionSeconds : 0;
    $<HTMLInputElement>('.music-volume input', p.el).value = String(Math.round(musicVolume * 100));
  });
}

function addPane(p: PaneState) { if (state.panes.length >= MAX_PANES) return toast(`A comparison holds at most ${MAX_PANES} panes`); state.panes.push(p); state.active = state.panes.length - 1; commit(); }
function closePane(i: number) { if (state.panes.length < 2) return; state.panes.splice(i, 1); state.active = Math.min(state.active, state.panes.length - 1); commit(); }
function setCount(n: number) {
  while (state.panes.length > n) state.panes.pop();
  while (state.panes.length < n) {
    // A new pane shows the active element's next variant that is not on screen yet, for a quick A/B.
    const base = state.panes[state.active], e = elementById.get(base.element)!, shown = new Set(state.panes.filter(p => p.element === e.id).map(p => p.variant));
    state.panes.push({ element: e.id, variant: (e.variants.find(v => !shown.has(v.id)) ?? e.variants.find(v => v.id === base.variant)!).id });
  }
  state.active = Math.min(state.active, n - 1); commit();
}
function compareVariants(i: number) {
  const e = elementById.get(state.panes[i].element)!, start = Math.max(0, e.variants.findIndex(v => v.id === state.panes[i].variant));
  const picks = [...e.variants.slice(start), ...e.variants.slice(0, start)].slice(0, MAX_PANES);
  state.panes = picks.map(v => ({ element: e.id, variant: v.id })); state.active = 0; commit();
  if (e.variants.length > MAX_PANES) toast(`Showing ${MAX_PANES} of ${e.variants.length} variants`);
}
function stepVariant(dir: number) {
  const p = state.panes[state.active], e = elementById.get(p.element)!, i = e.variants.findIndex(v => v.id === p.variant);
  state.panes[state.active] = { ...p, variant: e.variants[(i + dir + e.variants.length) % e.variants.length].id }; commit();
}

// ---- Library ----
function visible() { return searchElements(ELEMENTS, query); }
function renderResults() {
  const list = visible(); highlight = Math.min(highlight, Math.max(0, list.length - 1));
  const groups = query ? [{ name: `${list.length} result${list.length === 1 ? '' : 's'}`, items: list }] : CATEGORIES.map(c => ({ name: c, items: list.filter(e => e.category === c) }));
  let n = 0;
  results.innerHTML = list.length ? groups.filter(g => g.items.length).map(g => `<div class="group-name">${g.name}</div>${g.items.map(e => {
    const i = n++, shownIn = state.panes.flatMap((p, k) => p.element === e.id ? [LETTERS[k]] : []);
    return `<div class="item${i === highlight ? ' hl' : ''}${shownIn.length ? ' current' : ''}" role="option" id="opt-${i}" data-id="${e.id}" aria-selected="${i === highlight}">
      <span class="name">${esc(e.name)}${shownIn.map(l => `<span class="chip${state.panes.length > 1 && l === LETTERS[state.active] ? ' on' : ''}">${l}</span>`).join('')}</span><span class="meta">${query ? `${e.category} - ` : ''}${e.variants.length} variant${e.variants.length > 1 ? 's' : ''}</span>
      <button class="add" data-add="${e.id}" title="Add as a new pane" aria-label="Add ${esc(e.name)} as a new pane">+</button></div>`;
  }).join('')}`).join('') : `<p class="empty">No element matches "${esc(query)}".</p>`;
  search.setAttribute('aria-activedescendant', list.length ? `opt-${highlight}` : '');
  document.getElementById(`opt-${highlight}`)?.scrollIntoView({ block: 'nearest' });
}
function pick(e: StudioElement, asNew: boolean) {
  const p = { element: e.id, variant: defaultVariant(e) };
  if (asNew) addPane(p); else { state.panes[state.active] = p; commit(); }
}
results.addEventListener('click', ev => {
  const t = ev.target as HTMLElement, add = t.closest<HTMLElement>('[data-add]'), item = t.closest<HTMLElement>('.item');
  if (add) pick(elementById.get(add.dataset.add!)!, true); else if (item) pick(elementById.get(item.dataset.id!)!, false);
});
search.addEventListener('input', () => { query = search.value; highlight = 0; renderResults(); });
search.addEventListener('keydown', e => {
  const list = visible();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); highlight = (highlight + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % Math.max(1, list.length); renderResults(); }
  else if (e.key === 'Enter' && list[highlight]) { e.preventDefault(); pick(list[highlight], e.shiftKey); }
  else if (e.key === 'Escape') { if (search.value) { search.value = query = ''; renderResults(); } else search.blur(); }
});

// ---- Toolbar and keys ----
document.querySelectorAll<HTMLButtonElement>('.seg').forEach(b => b.addEventListener('click', () => setCount(Number(b.dataset.count))));
document.querySelectorAll<HTMLButtonElement>('.toggle').forEach(b => b.addEventListener('click', () => toggle(b.dataset.flag as 'link' | 'spin' | 'ground')));
function toggle(flag: 'link' | 'spin' | 'ground') {
  // Unlinking leaves every pane where it was; relinking snaps them all to the active pane's view.
  if (flag === 'link') { if (state.link) panes.forEach(p => Object.assign(p.own, sharedView)); else Object.assign(sharedView, panes[state.active].own); }
  state[flag] = !state[flag]; commit();
}
$('#play').addEventListener('click', () => { paused = !paused; commit(); });
$('#restart').addEventListener('click', restart);
$<HTMLSelectElement>('#speed').addEventListener('change', e => { state.speed = Number((e.target as HTMLSelectElement).value); commit(); });
$<HTMLSelectElement>('#quality').addEventListener('change', e => { state.quality = (e.target as HTMLSelectElement).value as Quality; commit(); });
$<HTMLSelectElement>('#bg').addEventListener('change', e => { state.background = (e.target as HTMLSelectElement).value as Background; commit(); });
$('#copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); toast('Link copied'); } catch { toast('Copy failed. Use the address bar.'); } });
$('#save').addEventListener('click', () => { captureNext = true; });
function restart() { clock = 0; musicPlayer.restart(); panes.forEach(p => { const e = p.vp.element!; p.vp.load(e, p.vp.variant); }); updateMusicPanels(); }

addEventListener('keydown', e => {
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); search.focus(); search.select(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); paused = !paused; commit(); }
  else if (k === 'r') restart();
  else if (k === '[' || k === ']') stepVariant(k === ']' ? 1 : -1);
  else if (k === 'v') compareVariants(state.active);
  else if (k === 't') toggle('spin');
  else if (k === 'l') toggle('link');
  else if (k >= '1' && k <= '4' && Number(k) <= panes.length) { state.active = Number(k) - 1; commit(); }
});
addEventListener('hashchange', () => { if (location.hash !== encodeState(state)) { state = decodeState(location.hash, FALLBACK, resolve); commit(); } });
document.addEventListener('visibilitychange', () => { musicPlayer.update(paused, document.hidden); updateMusicPanels(); });
addEventListener('pagehide', () => musicPlayer.update(paused, true));

let toastTimer = 0;
function toast(text: string) { const t = $('#toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = window.setTimeout(() => t.classList.remove('show'), 1800); }

/** Lays the panes side by side with their letter, element and variant, so a choice can be discussed from the image alone. */
function saveImage() {
  const ratio = devicePixelRatio, head = Math.round(34 * ratio), rects = panes.map(p => p.el.getBoundingClientRect()), left = Math.min(...rects.map(r => r.left)), top = Math.min(...rects.map(r => r.top));
  const out = document.createElement('canvas'); out.width = Math.round((Math.max(...rects.map(r => r.right)) - left) * ratio); out.height = Math.round((Math.max(...rects.map(r => r.bottom)) - top) * ratio);
  const g = out.getContext('2d')!; g.fillStyle = '#0d0e1c'; g.fillRect(0, 0, out.width, out.height);
  panes.forEach((p, i) => {
    const r = rects[i], x = (r.left - left) * ratio, y = (r.top - top) * ratio, w = r.width * ratio, h = r.height * ratio, e = p.vp.element!, v = e.variants.find(q => q.id === p.vp.variant)!;
    g.drawImage(p.vp.canvas, x, y, w, h);
    g.fillStyle = '#0d0e1ccc'; g.fillRect(x, y + h - head, w, head); g.fillStyle = '#ffffff'; g.font = `600 ${Math.round(15 * ratio)}px Barlow, Arial, sans-serif`; g.textBaseline = 'middle';
    g.fillText(`${LETTERS[i]}   ${e.name} - ${v.label}${v.inGame && !e.variants.every(q => q.inGame) ? '  (in game)' : ''}`, x + 12 * ratio, y + h - head / 2);
  });
  const a = document.createElement('a'); a.download = `studio-${state.panes.map(p => `${p.element}-${p.variant}`).join('_vs_')}.png`.replace(/[^a-z0-9._-]+/gi, '-'); a.href = out.toDataURL('image/png'); a.click();
}

// ---- Frame loop ----
const resizer = new ResizeObserver(() => panes.forEach(p => p.vp.resize(p.el.clientWidth, p.el.clientHeight)));
resizer.observe(paneHost);
let last = performance.now();
function frame(now: number) {
  const real = Math.min(.1, (now - last) / 1000); last = now;
  const dt = paused ? 0 : real * state.speed; clock += dt;
  if (state.spin && !paused) for (const v of new Set(panes.map(p => p.vp.view))) v.az += real * .5;
  musicPlayer.update(paused, document.hidden);
  updateMusicPanels();
  for (const p of panes) { p.vp.resize(p.el.clientWidth, p.el.clientHeight); if (!p.vp.element?.music) p.vp.render(clock, dt); }
  if (captureNext) { captureNext = false; saveImage(); }
  requestAnimationFrame(frame);
}
commit(); requestAnimationFrame(frame);
