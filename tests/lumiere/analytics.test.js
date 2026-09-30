import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dashboard, latestMetricsByPost, followerSeries } from '../../docs/lumiere/js/lib/analytics.js';
import { mapInsightsToSnapshot } from '../../docs/lumiere/js/integrations/instagram.js';

const ideas = [
  { id: 'f1', category: 'founder', tags: ['linen', 'bts'] },
  { id: 'f2', category: 'founder', tags: ['linen'] },
  { id: 's1', category: 'skit', tags: [] },
  { id: 'a1', category: 'aesthetic', tags: [] },
];
const post = (id, ideaId, platform, date, rating, time = '18:00') => ({ id, ideaId, platform, date, status: 'posted', rating, time });
const posts = [
  post('p1', 'f1', 'instagram', '2026-09-01', 'worked'),
  post('p2', 'f2', 'instagram', '2026-09-02', 'worked'),
  post('p3', 's1', 'tiktok', '2026-09-03', 'flopped', '09:00'),
  post('p4', 'a1', 'tiktok', '2026-09-04', 'average', '09:00'),
  { id: 'p5', ideaId: 'a1', platform: 'tiktok', date: '2026-09-05', status: 'planned' },
];
const m = (postId, views, extra = {}) => ({ id: 'm' + postId, postId, source: 'manual', capturedAt: '2026-09-10T00:00:00Z', views, likes: 10, comments: 1, shares: 1, saves: 2, follows: 5, ...extra });
const metrics = [
  m('p1', 10000, { saves: 400 }),
  m('p2', 8000),
  m('p3', 500),
  m('p4', 1500),
  { ...m('p1', 1), capturedAt: '2026-09-02T00:00:00Z', id: 'older' },
  m('p5', 99999), // not posted -> ignored
];

test('latest snapshot wins', () => {
  assert.equal(latestMetricsByPost(metrics).get('p1').views, 10000);
});

test('dashboard ranks categories, platforms and top posts', () => {
  const d = dashboard({ ideas, posts, metrics, followers: [] });
  assert.equal(d.totals.posts, 4);
  assert.equal(d.totals.views, 20000);
  assert.equal(d.categories[0].key, 'founder');
  assert.equal(d.platforms[0].key, 'instagram');
  assert.deepEqual(d.top.map(r => r.post.id), ['p1', 'p2', 'p4', 'p3']);
  assert.match(d.summary[0], /Make more Founder Videos/);
  assert.ok(d.summary.some(s => s.includes('Instagram is outperforming TikTok')));
  assert.ok(d.summary.some(s => s.includes('#linen')));
  assert.ok(d.summary.some(s => s.includes('evening')));
});

test('summary asks for more data when fewer than 3 posts are logged', () => {
  const d = dashboard({ ideas, posts, metrics: metrics.slice(0, 2), followers: [] });
  assert.match(d.summary[0], /at least 3/);
});

test('follower series prefers logged counts, else cumulative follows', () => {
  const followers = [
    { id: 'x', platform: 'instagram', date: '2026-09-10', count: 1200 },
    { id: 'y', platform: 'instagram', date: '2026-09-01', count: 1000 },
  ];
  const s = followerSeries({ ideas, posts, metrics, followers });
  const ig = s.find(x => x.platform === 'instagram');
  assert.equal(ig.kind, 'count');
  assert.deepEqual(ig.points.map(p => p.value), [1000, 1200]);
  const tt = s.find(x => x.platform === 'tiktok');
  assert.equal(tt.kind, 'gained');
  assert.deepEqual(tt.points.map(p => p.value), [5, 10]);
});

test('instagram insights map onto the metric snapshot shape', () => {
  const snap = mapInsightsToSnapshot('p1', '1789', [
    { name: 'views', values: [{ value: 5000 }] },
    { name: 'saved', total_value: { value: 40 } },
    { name: 'profile_activity', total_value: { breakdowns: [{ results: [{ dimension_values: ['bio_link_clicked'], value: 7 }] }] } },
    { name: 'unknown_metric', values: [{ value: 1 }] },
  ], '2026-09-30T00:00:00Z');
  assert.equal(snap.source, 'instagram_api');
  assert.equal(snap.views, 5000);
  assert.equal(snap.saves, 40);
  assert.equal(snap.linkClicks, 7);
  assert.equal(snap.postId, 'p1');
});
