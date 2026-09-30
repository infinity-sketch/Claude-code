import * as S from '../store.js';
import { state, find } from '../store.js';
import { catById, laneById, RATINGS } from '../lib/model.js';
import { dashboard, latestMetricsByPost, fmtN, num } from '../lib/analytics.js';
import { fmtShort, parseISO } from '../lib/dates.js';
import { esc, icon, on, pageHead, empty, laneBadge, confirmSheet } from '../ui.js';
import { openFollowerEditor } from '../editors.js';

const view = { tab: 'dashboard' };
const RATING_LABEL = Object.fromEntries(RATINGS.map(r => [r.id, r.label]));

const ratingChip = r => (r ? `<span class="rating r-${r}">${esc(RATING_LABEL[r])}</span>` : '');

function kpis(d) {
  const rate = d.totals.views ? (d.totals.eng / d.totals.views) * 100 : 0;
  return `<div class="kpis">
    <div class="kpi"><span>${d.totals.posts}</span><small>Posts logged</small></div>
    <div class="kpi"><span>${fmtN(d.totals.views)}</span><small>Views</small></div>
    <div class="kpi"><span>${fmtN(d.totals.follows)}</span><small>Follows gained</small></div>
    <div class="kpi"><span>${rate.toFixed(1)}%</span><small>Engagement</small></div>
  </div>`;
}

function rankCard(title, groups, labelFn, colorFn) {
  if (!groups.length) return '';
  const max = Math.max(...groups.map(g => g.avgViews), 1);
  const best = groups[0];
  return `<section class="card">
    <h2>${esc(title)}</h2>
    <p class="winner">${esc(labelFn(best.key))}</p>
    <ul class="rank">
      ${groups.map(g => `<li>
        <div class="rank-top"><span><i class="dot" style="--c:${colorFn(g.key)}"></i>${esc(labelFn(g.key))}</span><span class="muted sm">${fmtN(g.avgViews)} avg views · ${g.n} post${g.n === 1 ? '' : 's'} · ${Math.round(g.workedRate * 100)}% worked</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${(g.avgViews / max) * 100}%;--c:${colorFn(g.key)}"></div></div>
      </li>`).join('')}
    </ul>
  </section>`;
}

/* ---------- Follower growth line chart ---------- */
const W = 340, H = 190, PAD = { l: 40, r: 64, t: 12, b: 26 };

function chartModel(series) {
  const all = series.flatMap(s => s.points);
  const t = p => parseISO(p.date).getTime();
  let x0 = Math.min(...all.map(t)), x1 = Math.max(...all.map(t));
  if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
  let y0 = Math.min(...all.map(p => p.value)), y1 = Math.max(...all.map(p => p.value));
  if (y0 === y1) { y0 = Math.max(0, y0 - 10); y1 += 10; }
  const pad = (y1 - y0) * 0.1;
  y0 = Math.max(0, y0 - pad); y1 += pad;
  const sx = v => PAD.l + ((v - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = v => PAD.t + (1 - (v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  return { x0, x1, y0, y1, sx, sy, t };
}

function followerChart(series) {
  if (!series.length) {
    return empty('Log your follower count now and then to see growth here.', `<button class="btn ghost" data-act="fol-new">${icon.plus} Log follower count</button>`);
  }
  const m = chartModel(series);
  const ticks = [0, 0.5, 1].map(f => m.y0 + (m.y1 - m.y0) * f);
  const dates = [...new Set(series.flatMap(s => s.points.map(p => p.date)))].sort();
  const kindNote = series.some(s => s.kind === 'gained') ? '<p class="hint">Lines without logged follower counts show cumulative follows gained from logged posts.</p>' : '';
  const paths = series.map(s => {
    const lane = laneById(s.platform);
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${m.sx(m.t(p)).toFixed(1)},${m.sy(p.value).toFixed(1)}`).join('');
    const last = s.points[s.points.length - 1];
    return `<path d="${d}" fill="none" stroke="${lane.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${lane.id === 'tiktok' ? 'stroke-dasharray="5 3"' : ''}/>
      <circle cx="${m.sx(m.t(last))}" cy="${m.sy(last.value)}" r="4" fill="${lane.color}" stroke="var(--surface)" stroke-width="2"/>
      <text x="${m.sx(m.t(last)) + 8}" y="${m.sy(last.value) + 4}" class="ch-label">${esc(lane.short)} ${fmtN(last.value)}</text>`;
  }).join('');
  return `<div class="chart-wrap" id="fol-chart" data-series='${esc(JSON.stringify(series))}'>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Follower growth over time">
      ${ticks.map(v => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${m.sy(v)}" y2="${m.sy(v)}" class="ch-grid"/><text x="${PAD.l - 6}" y="${m.sy(v) + 4}" class="ch-axis" text-anchor="end">${fmtN(v)}</text>`).join('')}
      <text x="${PAD.l}" y="${H - 6}" class="ch-axis">${esc(fmtShort(dates[0]))}</text>
      <text x="${W - PAD.r}" y="${H - 6}" class="ch-axis" text-anchor="end">${esc(fmtShort(dates[dates.length - 1]))}</text>
      ${paths}
      <line class="ch-cross" id="ch-cross" y1="${PAD.t}" y2="${H - PAD.b}" x1="0" x2="0" visibility="hidden"/>
      <rect x="${PAD.l}" y="0" width="${W - PAD.l - PAD.r}" height="${H}" fill="transparent" id="ch-hit"/>
    </svg>
    <div class="ch-tip" id="ch-tip" hidden></div>
  </div>
  <div class="lane-legend">${series.map(s => `<span style="--c:${laneById(s.platform).color}"><i class="leg-line ${s.platform}"></i>${esc(laneById(s.platform).label)}${s.kind === 'gained' ? ' (follows gained)' : ''}</span>`).join('')}</div>
  ${kindNote}
  <details class="table-view"><summary>Show as table</summary>
    <table><thead><tr><th>Date</th>${series.map(s => `<th>${esc(laneById(s.platform).label)}</th>`).join('')}</tr></thead>
    <tbody>${dates.map(d => `<tr><td>${esc(fmtShort(d))}</td>${series.map(s => `<td>${s.points.find(p => p.date === d)?.value ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody></table>
  </details>`;
}

function bindChart(root) {
  const wrap = root.querySelector('#fol-chart');
  if (!wrap) return;
  const series = JSON.parse(wrap.dataset.series);
  const m = chartModel(series);
  const svgEl = wrap.querySelector('svg');
  const cross = wrap.querySelector('#ch-cross');
  const tip = wrap.querySelector('#ch-tip');
  const dates = [...new Set(series.flatMap(s => s.points.map(p => p.date)))].sort();
  const move = e => {
    const r = svgEl.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = dates[0];
    for (const d of dates) if (Math.abs(m.sx(m.t({ date: d })) - x) < Math.abs(m.sx(m.t({ date: best })) - x)) best = d;
    const cx = m.sx(m.t({ date: best }));
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.innerHTML = `<b>${esc(fmtShort(best))}</b>` + series.map(s => {
      const p = s.points.find(q => q.date === best);
      return p ? `<span><i class="dot" style="--c:${laneById(s.platform).color}"></i>${esc(laneById(s.platform).label)} <b>${num(p.value).toLocaleString()}</b></span>` : '';
    }).join('');
    const left = (cx / W) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 70), r.width - 70)}px`;
  };
  const leave = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };
  const hit = wrap.querySelector('#ch-hit');
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', leave);
}

function dashboardView() {
  const d = dashboard(state);
  return `${kpis(d)}
    <section class="card summary">
      <h2>What to make more of</h2>
      <ul>${d.summary.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    </section>
    ${rankCard('Best category', d.categories, k => catById(k).label, k => catById(k).color)}
    ${rankCard('Best platform', d.platforms, k => laneById(k).label, k => laneById(k).color)}
    <section class="card">
      <h2>Top 5 posts</h2>
      ${d.top.length ? `<ol class="top">${d.top.map(r => `<li><button class="top-row" data-act="metrics-open" data-id="${esc(r.post.id)}">
        <span class="lane-dot" style="--c:${laneById(r.post.platform).color}">${icon[r.post.platform]}</span>
        <span class="top-main"><b>${esc(r.idea?.title || 'Untitled')}</b><small class="muted">${esc(fmtShort(r.post.date))} · ${fmtN(r.eng)} engagements · +${fmtN(r.follows)} follows</small></span>
        <span class="top-views">${fmtN(r.views)}<small>views</small></span>
      </button></li>`).join('')}</ol>` : '<p class="muted">Log results for posted content to rank them.</p>'}
    </section>
    <section class="card">
      <header class="row between"><h2>Follower growth</h2><button class="btn ghost sm" data-act="fol-new">${icon.plus} Log count</button></header>
      ${followerChart(d.followers)}
      ${state.followers.length ? `<details class="table-view"><summary>Logged counts (${state.followers.length})</summary><ul class="plain">${[...state.followers].sort((a, b) => b.date.localeCompare(a.date)).map(f => `<li>${laneBadge(f.platform)} ${esc(fmtShort(f.date))} · ${num(f.count).toLocaleString()} <button class="icon-btn sm" data-act="fol-del" data-id="${esc(f.id)}" aria-label="Delete">${icon.x}</button></li>`).join('')}</ul></details>` : ''}
    </section>`;
}

function postsView() {
  const latest = latestMetricsByPost(state.metrics);
  const posted = state.posts.filter(p => p.status === 'posted').sort((a, b) => b.date.localeCompare(a.date));
  if (!posted.length) return empty('Posts you mark as posted show up here, ready for their results.');
  const missing = posted.filter(p => !latest.has(p.id)).length;
  return `${missing ? `<p class="month-flags alert">${icon.flag} ${missing} post${missing === 1 ? '' : 's'} waiting for results</p>` : ''}
    ${posted.map(p => {
      const m = latest.get(p.id);
      const idea = find('ideas', p.ideaId);
      return `<button class="card list-card" data-act="metrics-open" data-id="${esc(p.id)}">
        <span class="lane-dot" style="--c:${laneById(p.platform).color}">${icon[p.platform]}</span>
        <div><b>${esc(idea?.title || 'Untitled')}</b>
          <span class="muted">${esc(fmtShort(p.date))} · ${m ? `${fmtN(num(m.views))} views · ${fmtN(num(m.likes))} likes` : 'No results yet'}</span>
          ${p.ratingWhy ? `<span class="note-line">${esc(p.ratingWhy)}</span>` : ''}
        </div>
        ${m ? ratingChip(p.rating) : `<span class="btn primary sm">Log</span>`}
      </button>`;
    }).join('')}`;
}

export function render() {
  return `${pageHead('Analytics', 'Manual entry · Instagram API in phase 2')}
    <div class="seg small tabs" role="tablist">
      <button class="seg-opt ${view.tab === 'dashboard' ? 'on' : ''}" data-act="an-tab" data-v="dashboard" role="tab">Dashboard</button>
      <button class="seg-opt ${view.tab === 'posts' ? 'on' : ''}" data-act="an-tab" data-v="posts" role="tab">Log results</button>
    </div>
    <div class="stack">${view.tab === 'dashboard' ? dashboardView() : postsView()}</div>`;
}

let refresh = () => {};
export function mount(root, rerender) {
  refresh = rerender;
  bindChart(root);
}

on('an-tab', el => { view.tab = el.dataset.v; refresh(); });
on('fol-new', () => openFollowerEditor());
on('fol-del', async el => {
  if (await confirmSheet({ title: 'Delete this count?', message: 'The follower count entry will be removed.' })) await S.deleteFollowerCount(el.dataset.id);
});

