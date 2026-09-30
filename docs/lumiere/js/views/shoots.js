import * as S from '../store.js';
import { state, find } from '../store.js';
import { catById, statusIndex, uid } from '../lib/model.js';
import { todayISO, fmtDay } from '../lib/dates.js';
import { batchCounter } from '../lib/planning.js';
import { esc, icon, on, openSheet, confirmSheet, toast, catChip, statusPill, pageHead, empty } from '../ui.js';

function counterCol(bc) {
  return `<div class="bc-col">
    <h3>Next ${bc.days} days</h3>
    <div class="bc-big ${bc.toFilm ? 'alert' : 'good'}">${bc.toFilm}<small>to film</small></div>
    <dl class="bc-list">
      <div><dt>Slots</dt><dd>${bc.slots}</dd></div>
      <div><dt>Scheduled</dt><dd>${bc.filled}</dd></div>
      <div class="${bc.empty ? 'alert' : ''}"><dt>Empty</dt><dd>${bc.empty}</dd></div>
      <div><dt>Videos needed</dt><dd>${bc.ideasNeeded}</dd></div>
      <div><dt>Ready</dt><dd>${bc.shot} shot · ${bc.edited} edited</dd></div>
    </dl>
  </div>`;
}

export function batchCounterCard() {
  const today = todayISO();
  const opts = { crossPost: state.settings.crossPost };
  return `<section class="card batch">
    <header class="row between"><h2>Batch counter</h2><span class="muted sm">${state.settings.crossPost ? 'Cross-posting: 1 video fills both lanes' : '1 video per slot'}</span></header>
    <div class="bc-grid">${counterCol(batchCounter(state, today, 7, opts))}${counterCol(batchCounter(state, today, 14, opts))}</div>
  </section>`;
}

function shootRow(s) {
  const done = s.shotList.filter(x => x.done).length;
  return `<a class="card list-card" href="#/shoots/${esc(s.id)}">
    <div class="date-tile"><b>${esc(fmtDay(s.date).split(', ')[1])}</b><span>${esc(fmtDay(s.date).split(',')[0])}</span></div>
    <div><b>${esc(s.location || 'No location yet')}</b><span class="muted">${done}/${s.shotList.length} shot · ${s.checklist.filter(c => c.done).length}/${s.checklist.length} packed</span></div>
    ${icon.right}
  </a>`;
}

function listView() {
  const today = todayISO();
  const upcoming = state.shoots.filter(s => s.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = state.shoots.filter(s => s.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return `${pageHead('Shoot Planner', '', `<button class="btn primary" data-act="shoot-new">${icon.plus} Shoot day</button>`)}
    <div class="stack">
      ${batchCounterCard()}
      <h2 class="section-title">Upcoming</h2>
      ${upcoming.length ? upcoming.map(shootRow).join('') : empty('No shoot days planned.', `<button class="btn ghost" data-act="shoot-new">${icon.plus} Plan a shoot day</button>`)}
      ${past.length ? `<details class="past"><summary>Past shoots (${past.length})</summary><div class="stack">${past.map(shootRow).join('')}</div></details>` : ''}
    </div>`;
}

function detailView(id) {
  const s = find('shoots', id);
  if (!s) return `${pageHead('Shoot not found')}<a class="btn ghost" href="#/shoots">Back to shoots</a>`;
  const ticked = s.shotList.filter(x => x.done).length;
  const toMark = s.shotList.filter(x => x.done && statusIndex(find('ideas', x.ideaId)?.status) < statusIndex('shot')).length;
  return `<a class="back" href="#/shoots">${icon.left} Shoots</a>
    ${pageHead(fmtDay(s.date), esc(s.location || 'No location'), `<button class="icon-btn" data-act="shoot-edit" data-id="${esc(id)}" aria-label="Edit shoot">${icon.edit}</button>`)}
    ${s.notes ? `<p class="prewrap muted">${esc(s.notes)}</p>` : ''}
    <section class="card">
      <header class="row between"><h2>Outfits & props</h2><span class="muted sm">${s.checklist.filter(c => c.done).length}/${s.checklist.length}</span></header>
      <ul class="checklist">
        ${s.checklist.map(c => `<li class="${c.done ? 'done' : ''}">
          <button class="check" data-act="shoot-check" data-id="${esc(id)}" data-item="${esc(c.id)}" aria-pressed="${c.done}" aria-label="Toggle ${esc(c.text)}">${c.done ? icon.check : ''}</button>
          <span>${esc(c.text)}</span>
          <button class="icon-btn sm" data-act="shoot-check-del" data-id="${esc(id)}" data-item="${esc(c.id)}" aria-label="Remove">${icon.x}</button>
        </li>`).join('')}
      </ul>
      <form class="add-inline" data-shoot="${esc(id)}" id="check-add"><input name="text" placeholder="Add outfit or prop…" autocomplete="off"><button class="btn ghost" type="submit">${icon.plus}</button></form>
    </section>
    <section class="card">
      <header class="row between"><h2>Shot list</h2><button class="btn ghost sm" data-act="shot-add" data-id="${esc(id)}">${icon.plus} Add ideas</button></header>
      ${s.shotList.length ? `<ul class="checklist shots">
        ${s.shotList.map(x => {
          const idea = find('ideas', x.ideaId);
          if (!idea) return '';
          return `<li class="${x.done ? 'done' : ''}" style="--c:${catById(idea.category).color}">
            <button class="check big" data-act="shot-toggle" data-id="${esc(id)}" data-idea="${esc(idea.id)}" aria-pressed="${x.done}" aria-label="Tick ${esc(idea.title)}">${x.done ? icon.check : ''}</button>
            <button class="shot-title" data-act="idea-open" data-id="${esc(idea.id)}"><b>${esc(idea.title)}</b><span class="row gap">${catChip(idea.category)}${statusPill(idea.status)}</span></button>
            <button class="icon-btn sm" data-act="shot-remove" data-id="${esc(id)}" data-idea="${esc(idea.id)}" aria-label="Remove from shot list">${icon.x}</button>
          </li>`;
        }).join('')}
      </ul>` : `<p class="muted">Add ideas from your library to build the shot list.</p>`}
    </section>
    <div class="sticky-cta">
      <button class="btn primary big block" data-act="shoot-mark" data-id="${esc(id)}" ${toMark ? '' : 'disabled'}>${icon.check} ${toMark ? `Mark ${toMark} ticked as Shot` : ticked ? 'Ticked ideas are marked Shot' : 'Tick shots while filming'}</button>
    </div>
    <button class="btn ghost danger-text block" data-act="shoot-del" data-id="${esc(id)}">${icon.trash} Delete shoot day</button>`;
}

export function render(params) {
  return params.id ? detailView(params.id) : listView();
}

export function mount(root) {
  const form = root.querySelector('#check-add');
  if (form) form.onsubmit = async e => {
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) return;
    const s = find('shoots', form.dataset.shoot);
    await S.saveShoot({ id: s.id, checklist: [...s.checklist, { id: uid('c_'), text, done: false }] });
    document.querySelector('#check-add input')?.focus();
  };
}

function openShootEditor(shoot) {
  openSheet({
    title: shoot ? 'Edit shoot day' : 'New shoot day',
    body: `<form class="form" id="shoot-form">
      <label class="field"><span>Date</span><input type="date" name="date" required value="${esc(shoot?.date || todayISO())}"></label>
      <label class="field"><span>Location</span><input name="location" value="${esc(shoot?.location || '')}" placeholder="Studio, rooftop, beach…"></label>
      <label class="field"><span>Notes</span><textarea name="notes" rows="3" placeholder="Call time, light, crew…">${esc(shoot?.notes || '')}</textarea></label>
    </form>`,
    footer: `<button class="btn primary" form="shoot-form" type="submit">${shoot ? 'Save' : 'Create shoot day'}</button>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      form.onsubmit = async e => {
        e.preventDefault();
        const saved = await S.saveShoot({
          ...(shoot ? { id: shoot.id } : {}),
          date: form.elements.date.value,
          location: form.elements.location.value.trim(),
          notes: form.elements.notes.value.trim(),
        });
        close();
        if (!shoot) location.hash = `#/shoots/${saved.id}`;
      };
    },
  });
}

function openShotPicker(shootId) {
  const s = find('shoots', shootId);
  const inList = new Set(s.shotList.map(x => x.ideaId));
  const candidates = state.ideas
    .filter(i => !inList.has(i.id))
    .sort((a, b) => statusIndex(a.status) - statusIndex(b.status) || String(a.title).localeCompare(String(b.title)));
  const rows = q => {
    const ql = q.trim().toLowerCase();
    const list = candidates.filter(i => !ql || i.title.toLowerCase().includes(ql) || (i.tags || []).some(t => t.includes(ql)));
    return list.length ? list.map(i => `<label class="choice" style="--c:${catById(i.category).color}">
        <input type="checkbox" name="pick" value="${esc(i.id)}"><i class="bar"></i><span class="choice-title">${esc(i.title)}</span>${statusPill(i.status)}
      </label>`).join('') : '<p class="hint">No ideas to add. Create ideas in the library first.</p>';
  };
  openSheet({
    title: 'Add to shot list',
    body: `<div class="search sm">${icon.search}<input type="search" placeholder="Search ideas" id="pick-q"></div>
      <form id="pick-form"><div class="choices multi" id="pick-list">${rows('')}</div></form>`,
    footer: `<button class="btn primary" form="pick-form" type="submit">Add selected</button>`,
    onMount(el, close) {
      const picked = new Set();
      el.querySelector('#pick-q').addEventListener('input', e => {
        el.querySelector('#pick-list').innerHTML = rows(e.target.value);
        el.querySelectorAll('input[name=pick]').forEach(c => { c.checked = picked.has(c.value); c.closest('.choice').classList.toggle('on', c.checked); });
      });
      el.addEventListener('change', e => {
        if (e.target.name !== 'pick') return;
        e.target.checked ? picked.add(e.target.value) : picked.delete(e.target.value);
        e.target.closest('.choice').classList.toggle('on', e.target.checked);
      });
      el.querySelector('form').onsubmit = async e => {
        e.preventDefault();
        if (!picked.size) return close();
        const cur = find('shoots', shootId);
        await S.saveShoot({ id: shootId, shotList: [...cur.shotList, ...[...picked].map(ideaId => ({ ideaId, done: false }))] });
        close();
        toast(`${picked.size} added to shot list`);
      };
    },
  });
}

const updateShoot = (id, fn) => {
  const s = find('shoots', id);
  return S.saveShoot({ id, ...fn(s) });
};

on('shoot-new', () => openShootEditor(null));
on('shoot-edit', el => openShootEditor(find('shoots', el.dataset.id)));
on('shoot-del', async el => {
  if (await confirmSheet({ title: 'Delete shoot day?', message: 'The shot list and checklist are removed. Ideas stay in your library.' })) {
    await S.deleteShoot(el.dataset.id);
    location.hash = '#/shoots';
  }
});
on('shoot-check', el => updateShoot(el.dataset.id, s => ({ checklist: s.checklist.map(c => (c.id === el.dataset.item ? { ...c, done: !c.done } : c)) })));
on('shoot-check-del', el => updateShoot(el.dataset.id, s => ({ checklist: s.checklist.filter(c => c.id !== el.dataset.item) })));
on('shot-toggle', el => updateShoot(el.dataset.id, s => ({ shotList: s.shotList.map(x => (x.ideaId === el.dataset.idea ? { ...x, done: !x.done } : x)) })));
on('shot-remove', el => updateShoot(el.dataset.id, s => ({ shotList: s.shotList.filter(x => x.ideaId !== el.dataset.idea) })));
on('shot-add', el => openShotPicker(el.dataset.id));
on('shoot-mark', async el => {
  const n = await S.markTickedAsShot(el.dataset.id);
  toast(n ? `${n} idea${n === 1 ? '' : 's'} marked as Shot` : 'Nothing new to mark');
});
