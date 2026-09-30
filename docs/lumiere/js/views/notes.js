import * as S from '../store.js';
import { state, find } from '../store.js';
import { NOTE_SECTIONS } from '../lib/model.js';
import { esc, icon, on, openSheet, confirmSheet, copyText, toast, pageHead, empty, segmented } from '../ui.js';

const view = { section: 'hooks' };
const HINTS = {
  hooks: 'Openers that stopped the scroll. e.g. "3 things nobody tells you about linen…"',
  captions: 'Reusable caption skeletons — insert them straight into a post.',
  hashtags: 'Hashtag sets you can drop into any post with one tap.',
  voice: 'How Lumière sounds: words to use, words to avoid, tone.',
  general: 'Anything else worth keeping.',
};

export function render() {
  const notes = state.notes.filter(n => n.section === view.section).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return `${pageHead('Notes', '', `<button class="btn primary" data-act="note-new">${icon.plus} Note</button>`)}
    <div class="chip-row">${NOTE_SECTIONS.map(s => `<button class="chip ${view.section === s.id ? 'on' : ''}" data-act="notes-section" data-v="${s.id}">${esc(s.label)} <small>${state.notes.filter(n => n.section === s.id).length}</small></button>`).join('')}</div>
    <p class="hint">${esc(HINTS[view.section])}</p>
    <div class="stack">
      ${notes.length ? notes.map(n => `<article class="card note-card">
        <button class="note-main" data-act="note-edit" data-id="${esc(n.id)}">
          ${n.title ? `<h3>${esc(n.title)}</h3>` : ''}
          <p class="prewrap">${esc(n.body)}</p>
        </button>
        <button class="btn ghost sm" data-act="note-copy" data-id="${esc(n.id)}">${icon.copy} Copy</button>
      </article>`).join('') : empty('Nothing here yet.', `<button class="btn ghost" data-act="note-new">${icon.plus} Add a note</button>`)}
    </div>`;
}

let refresh = () => {};
export function mount(root, rerender) { refresh = rerender; }

function openNoteEditor(note) {
  openSheet({
    title: note ? 'Edit note' : 'New note',
    body: `<form class="form" id="note-form">
      <div class="field"><span>Section</span>${segmented('section', NOTE_SECTIONS, note?.section || view.section)}</div>
      <label class="field"><span>Title</span><input name="title" value="${esc(note?.title || '')}" placeholder="e.g. Summer drop hashtags"></label>
      <label class="field"><span>Note</span><textarea name="body" rows="8" required>${esc(note?.body || '')}</textarea></label>
    </form>`,
    footer: `${note ? `<button class="btn ghost danger-text" data-del>${icon.trash}Delete</button>` : ''}<button class="btn primary" form="note-form" type="submit">Save</button>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      if (!note) setTimeout(() => form.elements.title.focus(), 50);
      form.onsubmit = async e => {
        e.preventDefault();
        const body = form.elements.body.value.trim();
        if (!body) return form.elements.body.focus();
        const section = form.elements.section.value;
        await S.saveNote({ ...(note ? { id: note.id } : {}), section, title: form.elements.title.value.trim(), body });
        view.section = section;
        close();
        refresh();
        toast('Note saved');
      };
      el.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (await confirmSheet({ title: 'Delete note?', message: 'This note will be removed.' })) {
          await S.deleteNote(note.id);
          close();
        }
      });
    },
  });
}

on('notes-section', el => { view.section = el.dataset.v; refresh(); });
on('note-new', () => openNoteEditor(null));
on('note-edit', el => openNoteEditor(find('notes', el.dataset.id)));
on('note-copy', el => copyText(find('notes', el.dataset.id)?.body || ''));
