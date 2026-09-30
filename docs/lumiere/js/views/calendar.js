import * as S from '../store.js';
import { find } from '../store.js';
import { LANES, catById } from '../lib/model.js';
import { todayISO, startOfWeek, rangeDays, monthGrid, sameMonth, addDays, addMonths, fmtShort, fmtMonth, fmtDow, dayNum, fmtTime } from '../lib/dates.js';
import { emptySlots } from '../lib/planning.js';
import { state } from '../store.js';
import { esc, icon, on, pageHead } from '../ui.js';
import { openPostEditor } from '../editors.js';

const MODE_KEY = 'lumiere-cal-mode';
const view = {
  mode: (() => { try { return localStorage.getItem(MODE_KEY) || 'week'; } catch { return 'week'; } })(),
  anchor: todayISO(),
};

function laneCell(date, lane, today) {
  const p = S.postAt(date, lane.id);
  const past = date < today;
  if (!p) {
    return `<button class="lane-cell empty ${past ? 'past' : ''}" data-act="cal-slot" data-date="${date}" data-platform="${lane.id}" aria-label="Empty ${esc(lane.label)} slot ${esc(fmtShort(date))}">
      <span class="lc-lane" style="--c:${lane.color}">${icon[lane.id]}</span><span class="lc-flag">${icon.flag} Empty</span>
    </button>`;
  }
  const idea = p.ideaId && find('ideas', p.ideaId);
  return `<button class="lane-cell full ${p.status === 'posted' ? 'posted' : ''}" style="--c:${lane.color};--cat:${idea ? catById(idea.category).color : 'var(--muted)'}" data-act="cal-slot" data-date="${date}" data-platform="${lane.id}">
    <span class="lc-lane">${icon[lane.id]}</span>
    <span class="lc-body"><b>${esc(idea?.title || 'No video')}</b><small>${p.time ? esc(fmtTime(p.time)) : ''}${p.status === 'posted' ? ' · Posted' : ''}</small></span>
    ${p.status === 'posted' ? `<span class="ok-dot">${icon.check}</span>` : ''}
  </button>`;
}

function weekView(today) {
  const start = startOfWeek(view.anchor);
  const days = rangeDays(start, 7);
  return `<div class="cal-nav">
      <button class="icon-btn" data-act="cal-prev" aria-label="Previous week">${icon.left}</button>
      <b>${esc(fmtShort(days[0]))} – ${esc(fmtShort(days[6]))}</b>
      <button class="icon-btn" data-act="cal-next" aria-label="Next week">${icon.right}</button>
    </div>
    <div class="lane-legend">${LANES.map(l => `<span style="--c:${l.color}">${icon[l.id]} ${esc(l.label)}</span>`).join('')}</div>
    <div class="week">
      ${days.map(d => `<div class="wk-day ${d === today ? 'is-today' : ''} ${d < today ? 'is-past' : ''}">
        <div class="wk-date"><span>${esc(fmtDow(d))}</span><b>${dayNum(d)}</b></div>
        <div class="wk-lanes">${LANES.map(l => laneCell(d, l, today)).join('')}</div>
      </div>`).join('')}
    </div>`;
}

function monthView(today) {
  const grid = monthGrid(view.anchor);
  const upcomingEmpty = emptySlots(state, grid.filter(d => sameMonth(d, view.anchor) && d >= today)).length;
  return `<div class="cal-nav">
      <button class="icon-btn" data-act="cal-prev" aria-label="Previous month">${icon.left}</button>
      <b>${esc(fmtMonth(view.anchor))}</b>
      <button class="icon-btn" data-act="cal-next" aria-label="Next month">${icon.right}</button>
    </div>
    <p class="month-flags ${upcomingEmpty ? 'alert' : 'good'}">${upcomingEmpty ? `${icon.flag} ${upcomingEmpty} empty slot${upcomingEmpty === 1 ? '' : 's'} left this month` : `${icon.check} Every upcoming slot is filled`}</p>
    <div class="month">
      ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="m-head">${d}</div>`).join('')}
      ${grid.map(d => {
        const out = !sameMonth(d, view.anchor);
        return `<button class="m-cell ${out ? 'out' : ''} ${d === today ? 'is-today' : ''} ${d < today ? 'is-past' : ''}" data-act="cal-day" data-date="${d}" aria-label="${esc(fmtShort(d))}">
          <span class="m-num">${dayNum(d)}</span>
          ${LANES.map(l => {
            const p = S.postAt(d, l.id);
            return `<i class="m-bar ${p ? (p.status === 'posted' ? 'posted' : 'full') : 'empty'}" style="--c:${l.color}" title="${esc(l.label)}"></i>`;
          }).join('')}
        </button>`;
      }).join('')}
    </div>
    <div class="lane-legend">${LANES.map(l => `<span style="--c:${l.color}"><i class="m-bar full"></i>${esc(l.label)}</span>`).join('')}<span><i class="m-bar empty"></i>Empty</span></div>`;
}

export function render() {
  const today = todayISO();
  return `${pageHead('Calendar', '', `<div class="seg small" role="tablist">
      <button class="seg-opt ${view.mode === 'week' ? 'on' : ''}" data-act="cal-mode" data-v="week" role="tab">Week</button>
      <button class="seg-opt ${view.mode === 'month' ? 'on' : ''}" data-act="cal-mode" data-v="month" role="tab">Month</button>
    </div>`)}
    ${view.mode === 'week' ? weekView(today) : monthView(today)}
    <button class="btn ghost block" data-act="cal-today">Jump to today</button>`;
}

let refresh = () => {};
export function mount(root, rerender) { refresh = rerender; }

on('cal-mode', el => {
  view.mode = el.dataset.v;
  try { localStorage.setItem(MODE_KEY, view.mode); } catch { /* ignore */ }
  refresh();
});
on('cal-prev', () => { view.anchor = view.mode === 'week' ? addDays(view.anchor, -7) : addMonths(view.anchor, -1); refresh(); });
on('cal-next', () => { view.anchor = view.mode === 'week' ? addDays(view.anchor, 7) : addMonths(view.anchor, 1); refresh(); });
on('cal-today', () => { view.anchor = todayISO(); refresh(); });
on('cal-day', el => { view.anchor = el.dataset.date; view.mode = 'week'; refresh(); });
on('cal-slot', el => openPostEditor({ date: el.dataset.date, platform: el.dataset.platform }));
