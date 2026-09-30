// Analytics: joins posts with their latest metric snapshot and derives the dashboard.
import { CATEGORIES, LANES, catById, laneById } from './model.js';

export const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Metric snapshots are append-only per source; the newest one wins.
export function latestMetricsByPost(metrics) {
  const map = new Map();
  for (const m of metrics) {
    const cur = map.get(m.postId);
    if (!cur || String(m.capturedAt) > String(cur.capturedAt)) map.set(m.postId, m);
  }
  return map;
}

export function engagement(m) {
  if (!m) return 0;
  return num(m.likes) + num(m.comments) + num(m.shares) + num(m.saves);
}

// Posted posts that have metrics logged, joined with their idea.
export function loggedPosts(state) {
  const latest = latestMetricsByPost(state.metrics);
  const ideas = new Map(state.ideas.map(i => [i.id, i]));
  return state.posts
    .filter(p => p.status === 'posted' && latest.has(p.id))
    .map(p => {
      const m = latest.get(p.id);
      const idea = ideas.get(p.ideaId);
      return {
        post: p,
        idea,
        m,
        category: idea?.category || 'none',
        views: num(m.views),
        eng: engagement(m),
        follows: num(m.follows),
      };
    });
}

function group(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()].map(([key, items]) => {
    const n = items.length;
    const views = items.reduce((s, r) => s + r.views, 0);
    const eng = items.reduce((s, r) => s + r.eng, 0);
    const follows = items.reduce((s, r) => s + r.follows, 0);
    const worked = items.filter(r => r.post.rating === 'worked').length;
    const flopped = items.filter(r => r.post.rating === 'flopped').length;
    return {
      key, n, views, eng, follows, worked, flopped,
      avgViews: views / n,
      avgEng: eng / n,
      workedRate: worked / n,
    };
  });
}

const byPerformance = (a, b) => b.avgViews - a.avgViews || b.workedRate - a.workedRate || b.avgEng - a.avgEng;

export function byCategory(rows) {
  return group(rows.filter(r => r.category !== 'none'), r => r.category).sort(byPerformance);
}

export function byPlatform(rows) {
  return group(rows, r => r.post.platform).sort(byPerformance);
}

export function topPosts(rows, n = 5) {
  return [...rows].sort((a, b) => b.views - a.views || b.eng - a.eng).slice(0, n);
}

function timeBucket(hhmm) {
  if (!hhmm) return null;
  const h = Number(hhmm.split(':')[0]);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// Follower count over time per platform. Uses logged follower counts when present;
// otherwise falls back to cumulative "follows gained" from logged posts.
export function followerSeries(state) {
  const series = [];
  for (const lane of LANES) {
    const snaps = state.followers
      .filter(f => f.platform === lane.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (snaps.length) {
      series.push({ platform: lane.id, kind: 'count', points: snaps.map(s => ({ date: s.date, value: num(s.count) })) });
      continue;
    }
    const rows = loggedPosts(state)
      .filter(r => r.post.platform === lane.id)
      .sort((a, b) => a.post.date.localeCompare(b.post.date));
    let total = 0;
    const points = [];
    for (const r of rows) {
      total += r.follows;
      const last = points[points.length - 1];
      if (last && last.date === r.post.date) last.value = total;
      else points.push({ date: r.post.date, value: total });
    }
    if (points.length) series.push({ platform: lane.id, kind: 'gained', points });
  }
  return series;
}

const fmtN = n => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)));

// Plain-language "what to make more of" bullets.
export function makeMoreSummary(state) {
  const rows = loggedPosts(state);
  if (rows.length < 3) {
    return [`Log stats for at least 3 posts to see patterns (${rows.length} logged so far).`];
  }
  const out = [];
  const overallAvg = rows.reduce((s, r) => s + r.views, 0) / rows.length || 0;

  const cats = byCategory(rows);
  if (cats.length) {
    const best = cats[0];
    const mult = overallAvg ? best.avgViews / overallAvg : 0;
    out.push(`Make more ${catById(best.key).label}: ${fmtN(best.avgViews)} avg views per post` +
      (mult >= 1.1 ? ` (${mult.toFixed(1)}× your average).` : '.'));
    const flop = [...cats].sort((a, b) => b.flopped / b.n - a.flopped / a.n)[0];
    if (flop && flop.flopped && flop.key !== best.key && flop.flopped / flop.n >= 0.5) {
      out.push(`Rethink ${catById(flop.key).label}: ${flop.flopped} of ${flop.n} flopped.`);
    }
  }

  const plats = byPlatform(rows);
  if (plats.length === 2 && plats[1].avgViews > 0) {
    const ratio = plats[0].avgViews / plats[1].avgViews;
    if (ratio >= 1.2) out.push(`${laneById(plats[0].key).label} is outperforming ${laneById(plats[1].key).label} (${ratio.toFixed(1)}× views per post).`);
  }

  const times = group(rows.filter(r => timeBucket(r.post.time)), r => timeBucket(r.post.time)).sort(byPerformance);
  if (times.length >= 2) out.push(`Post in the ${times[0].key}: those posts average ${fmtN(times[0].avgViews)} views.`);

  const tagCounts = new Map();
  for (const r of rows.filter(r => r.post.rating === 'worked')) {
    for (const t of r.idea?.tags || []) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  }
  const topTags = [...tagCounts.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topTags.length) out.push(`Posts that worked often use: ${topTags.map(([t]) => '#' + t).join(', ')}.`);

  const saves = rows.filter(r => r.m.saves).sort((a, b) => num(b.m.saves) - num(a.m.saves))[0];
  if (saves) out.push(`Most saved: "${saves.idea?.title || 'Untitled'}" (${fmtN(num(saves.m.saves))} saves) — saves signal content worth repeating.`);

  return out;
}

export function dashboard(state) {
  const rows = loggedPosts(state);
  return {
    rows,
    totals: {
      posts: rows.length,
      views: rows.reduce((s, r) => s + r.views, 0),
      follows: rows.reduce((s, r) => s + r.follows, 0),
      eng: rows.reduce((s, r) => s + r.eng, 0),
    },
    categories: byCategory(rows),
    platforms: byPlatform(rows),
    top: topPosts(rows),
    followers: followerSeries(state),
    summary: makeMoreSummary(state),
  };
}

export { fmtN, CATEGORIES };
