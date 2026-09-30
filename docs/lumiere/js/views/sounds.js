import { state } from '../store.js';
import { normalizeUrl } from '../lib/links.js';
import { fmtShort } from '../lib/dates.js';
import { esc, icon, on, onInput, pageHead, empty } from '../ui.js';
import { hotBadge, hydrateAudio, soundAge } from '../editors.js';

const f = { filter: 'all', q: '' };
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'hot', label: 'Hot' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
];
const PLAT_LABEL = { tiktok: 'TikTok', instagram: 'Instagram', both: 'IG + TikTok' };

function filtered() {
  const q = f.q.trim().toLowerCase();
  return state.sounds
    .filter(s => f.filter === 'all'
      || (f.filter === 'hot' && s.hot)
      || s.platform === f.filter || (s.platform === 'both' && (f.filter === 'tiktok' || f.filter === 'instagram')))
    .filter(s => !q || [s.title, s.artist, s.mood, s.notes].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => {
      const A = soundAge(a); const B = soundAge(b);
      return (B.hot && !B.outdated) - (A.hot && !A.outdated) || String(b.createdAt).localeCompare(String(a.createdAt));
    });
}

function card(s) {
  const link = s.link ? normalizeUrl(s.link) : null;
  const uses = state.ideas.filter(i => i.soundId === s.id).length + state.posts.filter(p => p.soundId === s.id).length;
  return `<article class="card sound-card">
    <button class="sound-main" data-act="sound-open" data-id="${esc(s.id)}">
      <span class="sound-ico">${icon.sound}</span>
      <div class="sound-meta"><b>${esc(s.title || 'Untitled sound')}</b><span>${esc(s.artist || 'Unknown artist')}</span></div>
    </button>
    <div class="row gap wrap">
      ${s.mood ? `<span class="chip">${esc(s.mood)}</span>` : ''}
      <span class="chip">${esc(PLAT_LABEL[s.platform] || 'TikTok')}</span>
      ${uses ? `<span class="chip">Used ${uses}×</span>` : ''}
      <span class="muted sm">Added ${esc(fmtShort(String(s.createdAt).slice(0, 10)))}</span>
    </div>
    ${hotBadge(s)}
    ${s.notes ? `<p class="note-line">${esc(s.notes)}</p>` : ''}
    ${link && !link.ok ? `<div class="warn-line">${icon.warn} Link can't be opened: ${esc(link.error)}</div>` : ''}
    ${s.fileId ? `<audio class="audio" controls preload="none" data-file="${esc(s.fileId)}"></audio>` : ''}
    ${link?.ok ? `<a class="btn open block" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">Open on ${esc(link.platformLabel)} ${icon.open}</a>` : ''}
  </article>`;
}

function listHtml() {
  const list = filtered();
  if (!state.sounds.length) return empty('Save viral sounds here so they are ready when you edit.', `<button class="btn primary" data-act="sound-new">${icon.plus} Add a sound</button>`);
  if (!list.length) return empty('No sounds match.');
  return list.map(card).join('');
}

export function render() {
  return `${pageHead('Sounds', `${state.sounds.filter(s => s.hot).length} hot right now`, `<button class="btn primary" data-act="sound-new">${icon.plus} Add</button>`)}
    <div class="search">${icon.search}<input type="search" placeholder="Search title, artist, mood" value="${esc(f.q)}" data-input="sounds-q" aria-label="Search sounds"></div>
    <div class="chip-row">${FILTERS.map(x => `<button class="chip ${f.filter === x.id ? 'on' : ''}" data-act="sounds-filter" data-v="${x.id}">${x.id === 'hot' ? icon.fire : ''}${esc(x.label)}</button>`).join('')}</div>
    <div class="stack" id="sound-list">${listHtml()}</div>`;
}

let refresh = () => {};
export function mount(root, rerender) {
  refresh = rerender;
  hydrateAudio(root);
}

on('sounds-filter', el => { f.filter = el.dataset.v; refresh(); });
onInput('sounds-q', el => {
  f.q = el.value;
  const list = document.getElementById('sound-list');
  if (list) { list.innerHTML = listHtml(); hydrateAudio(list); }
});
