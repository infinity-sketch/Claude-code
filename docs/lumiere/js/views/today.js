import * as S from '../store.js';
import { state, find } from '../store.js';
import { LANES, laneById } from '../lib/model.js';
import { todayISO, fmtDay, fmtDow, dayNum, rangeDays, fmtTime, fmtShort, daysBetween } from '../lib/dates.js';
import { batchCounter } from '../lib/planning.js';
import { latestMetricsByPost } from '../lib/analytics.js';
import { esc, icon, on, copyText, toast, catChip, laneBadge, pageHead } from '../ui.js';
import { soundBlock, hydrateAudio, openPostEditor } from '../editors.js';

const fullText = p => [p.caption, p.hashtags].filter(Boolean).join('\n\n');

function laneCard(date, lane) {
  const p = S.postAt(date, lane.id);
  if (!p) {
    return `<article class="card lane-card empty-slot" style="--c:${lane.color}">
      <div class="lane-top">${laneBadge(lane.id)}<span class="flag">${icon.flag} Empty</span></div>
      <p class="muted">Nothing planned for ${esc(lane.label)} today.</p>
      <button class="btn primary block" data-act="today-fill" data-platform="${lane.id}">${icon.plus} Fill this slot</button>
    </article>`;
  }
  const idea = p.ideaId && find('ideas', p.ideaId);
  const soundId = p.soundId || idea?.soundId;
  const posted = p.status === 'posted';
  return `<article class="card lane-card ${posted ? 'is-posted' : ''}" style="--c:${lane.color}">
    <div class="lane-top">${laneBadge(lane.id)}<span class="time">${p.time ? esc(fmtTime(p.time)) : 'Any time'}</span></div>
    <button class="lane-title" data-act="post-open" data-date="${esc(date)}" data-platform="${lane.id}">
      <h3>${esc(idea?.title || 'No video attached')}</h3>${idea ? catChip(idea.category) : ''}
    </button>
    ${!idea ? `<div class="warn-line">${icon.warn} Attach a video to this post.</div>` : ''}
    <div class="caption-box">
      ${p.caption ? `<p class="prewrap">${esc(p.caption)}</p>` : '<p class="muted">No caption yet.</p>'}
      ${p.hashtags ? `<p class="hashtags">${esc(p.hashtags)}</p>` : ''}
    </div>
    ${soundId ? soundBlock(soundId) : ''}
    ${p.notes ? `<p class="note-line">${esc(p.notes)}</p>` : ''}
    <div class="btn-row">
      <button class="btn ghost big" data-act="today-copy" data-id="${esc(p.id)}" ${fullText(p) ? '' : 'disabled'}>${icon.copy} Copy</button>
      ${posted
        ? `<button class="btn done big" data-act="today-unpost" data-id="${esc(p.id)}">${icon.check} Posted</button>`
        : `<button class="btn primary big" data-act="today-post" data-id="${esc(p.id)}">${icon.check} Mark as Posted</button>`}
    </div>
    ${posted ? `<button class="btn ghost block" data-act="metrics-open" data-id="${esc(p.id)}">${icon.chart} Log results</button>` : ''}
  </article>`;
}

function weekStrip(today) {
  const days = rangeDays(today, 7);
  return `<a class="card week-strip" href="#/calendar">
    ${days.map(d => `<div class="ws-day ${d === today ? 'is-today' : ''}">
      <span class="ws-dow">${esc(fmtDow(d))}</span><span class="ws-num">${dayNum(d)}</span>
      ${LANES.map(l => `<i class="ws-dot ${S.postAt(d, l.id) ? 'full' : 'emptyflag'}" style="--c:${l.color}" title="${esc(l.label)}"></i>`).join('')}
    </div>`).join('')}
  </a>`;
}

export function render() {
  const today = todayISO();
  const bc = batchCounter(state, today, 7, { crossPost: state.settings.crossPost });
  const latest = latestMetricsByPost(state.metrics);
  const needStats = state.posts
    .filter(p => p.status === 'posted' && !latest.has(p.id) && daysBetween(p.date, today) >= 1)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const nextShoot = state.shoots.filter(s => s.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];

  return `${pageHead('Today', esc(fmtDay(today)))}
    <div class="stack">
      ${LANES.map(l => laneCard(today, l)).join('')}
      <h2 class="section-title">Next 7 days</h2>
      ${weekStrip(today)}
      <a class="card stat-card" href="#/shoots">
        <div><span class="stat-num ${bc.toFilm ? 'alert' : 'good'}">${bc.toFilm}</span><span class="stat-label">to film this week</span></div>
        <p class="muted">${bc.empty} empty slot${bc.empty === 1 ? '' : 's'} · ${bc.ready} ready (shot/edited)</p>
      </a>
      ${nextShoot ? `<a class="card list-card" href="#/shoots/${esc(nextShoot.id)}">${icon.shoot}<div><b>Next shoot · ${esc(fmtDay(nextShoot.date))}</b><span class="muted">${esc(nextShoot.location || 'No location')} · ${nextShoot.shotList.length} shots</span></div>${icon.right}</a>` : ''}
      ${needStats.length ? `<h2 class="section-title">Log results</h2>
        ${needStats.map(p => `<button class="card list-card" data-act="metrics-open" data-id="${esc(p.id)}">${laneBadge(p.platform)}<div><b>${esc(find('ideas', p.ideaId)?.title || 'Untitled')}</b><span class="muted">Posted ${esc(fmtShort(p.date))}</span></div>${icon.right}</button>`).join('')}` : ''}
    </div>`;
}

export function mount(root) {
  hydrateAudio(root);
}

on('today-fill', el => openPostEditor({ date: todayISO(), platform: el.dataset.platform }));
on('today-copy', el => {
  const p = find('posts', el.dataset.id);
  if (p) copyText(fullText(p));
});
on('today-post', async el => {
  await S.markPosted(el.dataset.id, true);
  const p = find('posts', el.dataset.id);
  toast(`Posted on ${laneById(p.platform).label} ✓`);
});
on('today-unpost', async el => {
  await S.markPosted(el.dataset.id, false);
  toast('Marked as not posted');
});
