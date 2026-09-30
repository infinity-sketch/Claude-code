// Tiny UI toolkit: escaping, icons, event delegation, bottom sheets, toasts.
import { normalizeUrl } from './lib/links.js';
import { catById, laneById, STATUS_LABEL } from './lib/model.js';

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const svg = (body, extra = '') => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const icon = {
  today: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  ideas: svg('<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/>'),
  shoot: svg('<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>'),
  calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  more: svg('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),
  sound: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  chart: svg('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'),
  note: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="M20 6L9 17l-5-5"/>'),
  x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  open: svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14L21 3"/>'),
  copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  flag: svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>'),
  fire: svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.3 1.3 2.3 2.5 2.8z"/>'),
  lock: svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  left: svg('<path d="M15 18l-6-6 6-6"/>'),
  right: svg('<path d="M9 18l6-6-6-6"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  warn: svg('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  link: svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  instagram: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>'),
  tiktok: svg('<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.6 2.4 4.5 5 5"/>'),
  youtube: svg('<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>'),
  pinterest: svg('<circle cx="12" cy="12" r="10"/><path d="M11 8.5c3-1 5 .8 4.5 3.2-.4 2.2-2.4 3-3.8 2.3M11.5 10l-2.5 11"/>'),
  web: svg('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'),
};

/* ---------- Event delegation ---------- */
const handlers = { click: {}, change: {}, input: {} };
export const on = (name, fn) => { handlers.click[name] = fn; };
export const onChange = (name, fn) => { handlers.change[name] = fn; };
export const onInput = (name, fn) => { handlers.input[name] = fn; };

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = handlers.click[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el) handlers.change[el.dataset.change]?.(el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el) handlers.input[el.dataset.input]?.(el, e);
});

/* ---------- Sheets ---------- */
const sheetRoot = () => document.getElementById('sheets');

export function openSheet({ title, body, footer = '', onMount, wide = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop"></div>
    <section class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="sheet-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn" data-sheet-close aria-label="Close">${icon.x}</button>
      </header>
      <div class="sheet-body">${body}</div>
      ${footer ? `<footer class="sheet-foot">${footer}</footer>` : ''}
    </section>`;
  const close = (instant = false) => {
    wrap.classList.add('closing');
    if (instant === true) wrap.remove(); else setTimeout(() => wrap.remove(), 160);
    document.removeEventListener('keydown', onKey);
    if (!sheetRoot().querySelector('.sheet-wrap:not(.closing)')) document.body.classList.remove('sheet-open');
  };
  const onKey = e => {
    if (e.key === 'Escape' && sheetRoot().lastElementChild === wrap) close();
  };
  wrap.querySelector('.sheet-backdrop').addEventListener('click', close);
  wrap.querySelector('[data-sheet-close]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  wrap.closeSheet = close;
  sheetRoot().appendChild(wrap);
  document.body.classList.add('sheet-open');
  const el = wrap.querySelector('.sheet');
  onMount?.(el, close);
  return close;
}

export function closeAllSheets() {
  sheetRoot().innerHTML = '';
  document.body.classList.remove('sheet-open');
}

export function confirmSheet({ title, message, confirmLabel = 'Delete', danger = true }) {
  return new Promise(resolve => {
    let done = false;
    const close = openSheet({
      title,
      body: `<p class="muted">${esc(message)}</p>`,
      footer: `<button class="btn ghost" data-no>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(confirmLabel)}</button>`,
      onMount(el, closeFn) {
        el.querySelector('[data-no]').onclick = () => { done = true; resolve(false); closeFn(); };
        el.querySelector('[data-yes]').onclick = () => { done = true; resolve(true); closeFn(); };
        el.closest('.sheet-wrap').querySelector('.sheet-backdrop').addEventListener('click', () => { if (!done) resolve(false); });
        el.querySelector('[data-sheet-close]').addEventListener('click', () => { if (!done) resolve(false); });
      },
    });
    void close;
  });
}

/* ---------- Toast ---------- */
let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Copied');
}

/* ---------- Shared fragments ---------- */
export const catChip = id => {
  const c = catById(id);
  return `<span class="chip cat" style="--c:${c.color}"><i></i>${esc(c.label)}</span>`;
};

export const statusPill = s => `<span class="pill st-${s}">${esc(STATUS_LABEL[s] || s)}</span>`;

export const laneBadge = id => {
  const l = laneById(id);
  return `<span class="lane-badge" style="--c:${l.color}">${icon[l.id]}<span>${esc(l.label)}</span></span>`;
};

export const tagList = tags => (tags?.length ? `<div class="tags">${tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : '');

// Bulletproof link row: valid links get a big Open button (new tab), invalid ones a warning.
export function linkRow(raw) {
  const r = normalizeUrl(raw);
  if (!r.ok) {
    return `<div class="link-row bad">${icon.warn}<div class="link-meta"><b>Link can't be opened</b><span>${esc(r.raw)} — ${esc(r.error)}</span></div></div>`;
  }
  return `<div class="link-row">
    <span class="plat-icon plat-${r.platform}">${icon[r.platform]}</span>
    <div class="link-meta"><b>${esc(r.platformLabel)}</b><span>${esc(r.host)}</span></div>
    <a class="btn open" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Open ${icon.open}</a>
  </div>`;
}

export const empty = (text, cta = '') => `<div class="empty"><p>${esc(text)}</p>${cta}</div>`;

export function pageHead(title, sub = '', action = '') {
  return `<header class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${action}</header>`;
}

export function segmented(name, options, value) {
  return `<div class="seg" role="radiogroup">${options.map(o => `
    <label class="seg-opt ${o.id === value ? 'on' : ''}" ${o.color ? `style="--c:${o.color}"` : ''}>
      <input type="radio" name="${esc(name)}" value="${esc(o.id)}" ${o.id === value ? 'checked' : ''}>
      ${o.color ? '<i></i>' : ''}${esc(o.label)}
    </label>`).join('')}</div>`;
}

// Keep segmented controls' "on" class in sync without re-rendering.
document.addEventListener('change', e => {
  if (e.target.matches('.seg input[type=radio]')) {
    const group = e.target.closest('.seg');
    group.querySelectorAll('.seg-opt').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
  }
});

export const formValue = (form, name) => form.elements[name]?.value ?? '';
