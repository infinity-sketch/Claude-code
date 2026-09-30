import { state } from '../store.js';
import { CATEGORIES, STATUSES, STATUS_LABEL, catById, statusIndex } from '../lib/model.js';
import { normalizeUrl } from '../lib/links.js';
import { esc, icon, on, onInput, catChip, statusPill, pageHead, empty } from '../ui.js';

// Filters survive navigation within the session.
const f = { category: 'all', status: 'all', tags: new Set(), q: '' };

export function filterIdeas(ideas, filters = f) {
  const q = filters.q.trim().toLowerCase();
  return ideas
    .filter(i => filters.category === 'all' || i.category === filters.category)
    .filter(i => filters.status === 'all' || i.status === filters.status)
    .filter(i => [...filters.tags].every(t => (i.tags || []).includes(t)))
    .filter(i => !q || [i.title, i.notes, ...(i.tags || [])].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => statusIndex(a.status) - statusIndex(b.status) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function card(i) {
  const c = catById(i.category);
  const links = (i.links || []).map(normalizeUrl);
  const bad = links.filter(l => !l.ok).length;
  return `<button class="card idea-card" style="--c:${c.color}" data-act="idea-open" data-id="${esc(i.id)}">
    <div class="idea-main">
      <h3>${esc(i.title)}</h3>
      <div class="row gap wrap">${statusPill(i.status)}
        ${links.filter(l => l.ok).slice(0, 4).map(l => `<span class="plat-icon sm plat-${l.platform}" title="${esc(l.platformLabel)}">${icon[l.platform]}</span>`).join('')}
        ${bad ? `<span class="badge outdated">${icon.warn} ${bad} bad link${bad > 1 ? 's' : ''}</span>` : ''}
        ${i.soundId ? `<span class="plat-icon sm" title="Sound attached">${icon.sound}</span>` : ''}
      </div>
      ${i.tags?.length ? `<div class="tags">${i.tags.slice(0, 5).map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
    </div>
  </button>`;
}

function listHtml() {
  const list = filterIdeas(state.ideas);
  if (!state.ideas.length) return empty('Your idea library is empty.', `<button class="btn primary" data-act="idea-new">${icon.plus} Add your first idea</button>`);
  if (!list.length) return empty('No ideas match these filters.', `<button class="btn ghost" data-act="ideas-clear">Clear filters</button>`);
  return `<p class="count">${list.length} idea${list.length === 1 ? '' : 's'}</p>${list.map(card).join('')}`;
}

export function render() {
  const tags = [...new Set(state.ideas.flatMap(i => i.tags || []))].sort();
  for (const t of f.tags) if (!tags.includes(t)) f.tags.delete(t);
  const counts = Object.fromEntries(CATEGORIES.map(c => [c.id, state.ideas.filter(i => i.category === c.id).length]));
  return `${pageHead('Ideas', `${state.ideas.length} in library`, `<button class="btn primary" data-act="idea-new" data-category="${f.category === 'all' ? 'founder' : f.category}">${icon.plus} New</button>`)}
    <nav class="cat-tabs" aria-label="Categories">
      <button class="cat-tab ${f.category === 'all' ? 'on' : ''}" data-act="ideas-cat" data-v="all">All</button>
      ${CATEGORIES.map(c => `<button class="cat-tab ${f.category === c.id ? 'on' : ''}" style="--c:${c.color}" data-act="ideas-cat" data-v="${c.id}"><i></i>${esc(c.label)}<small>${counts[c.id]}</small></button>`).join('')}
    </nav>
    <div class="search">${icon.search}<input type="search" placeholder="Search ideas, notes, tags" value="${esc(f.q)}" data-input="ideas-q" aria-label="Search ideas"></div>
    <div class="chip-row" role="group" aria-label="Status">
      <button class="chip ${f.status === 'all' ? 'on' : ''}" data-act="ideas-status" data-v="all">Any status</button>
      ${STATUSES.map(s => `<button class="chip ${f.status === s ? 'on' : ''}" data-act="ideas-status" data-v="${s}">${esc(STATUS_LABEL[s])}</button>`).join('')}
    </div>
    ${tags.length ? `<div class="chip-row" role="group" aria-label="Tags">${tags.map(t => `<button class="chip ${f.tags.has(t) ? 'on' : ''}" data-act="ideas-tag" data-v="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
    <div class="stack" id="idea-list">${listHtml()}</div>`;
}

let refresh = () => {};
export function mount(root, rerender) {
  refresh = rerender;
}

on('ideas-cat', el => { f.category = el.dataset.v; refresh(); });
on('ideas-status', el => { f.status = el.dataset.v; refresh(); });
on('ideas-tag', el => { f.tags.has(el.dataset.v) ? f.tags.delete(el.dataset.v) : f.tags.add(el.dataset.v); refresh(); });
on('ideas-clear', () => { f.category = 'all'; f.status = 'all'; f.tags.clear(); f.q = ''; refresh(); });
onInput('ideas-q', el => {
  f.q = el.value;
  const list = document.getElementById('idea-list');
  if (list) list.innerHTML = listHtml();
});
