// Phase 2: Instagram Graph API connection (not active yet — analytics are entered manually).
//
// The data model is already shaped for this:
//   - posts carry `externalId` (IG media id) and `permalink`
//   - metric snapshots carry `source` ('manual' | 'instagram_api') and `capturedAt`,
//     and are append-only, so API pulls simply add newer snapshots next to manual ones
//   - follower counts are snapshots too (`followers` store, `source` field)
//
// Connecting later means: obtain a token via Instagram Login (business/creator account),
// list media (GET /{ig-user-id}/media), match media to posts (by permalink, or by
// date + caption), then call GET /{media-id}/insights and store the result through
// `mapInsightsToSnapshot` below. A token must never be embedded in this static site —
// the fetch should run from a small server/edge function that holds the secret.

// Graph API insight metric name -> our metric field.
export const INSIGHT_METRIC_MAP = {
  views: 'views',
  likes: 'likes',
  comments: 'comments',
  shares: 'shares',
  saved: 'saves',
  follows: 'follows',
  // Link clicks arrive as profile_activity broken down by action_type=bio_link_clicked.
  profile_activity: 'linkClicks',
};

// `insights` is the `data` array from GET /{media-id}/insights.
export function mapInsightsToSnapshot(postId, mediaId, insights, capturedAt = new Date().toISOString()) {
  const snap = { id: `ig_${mediaId}_${capturedAt}`, postId, externalId: mediaId, source: 'instagram_api', capturedAt };
  for (const item of insights || []) {
    const field = INSIGHT_METRIC_MAP[item.name];
    if (!field) continue;
    if (item.name === 'profile_activity') {
      const breakdown = item.total_value?.breakdowns?.[0]?.results || [];
      const clicks = breakdown.find(r => (r.dimension_values || []).includes('bio_link_clicked'));
      snap.linkClicks = clicks ? Number(clicks.value) || 0 : 0;
      continue;
    }
    const value = item.total_value?.value ?? item.values?.[0]?.value;
    snap[field] = Number(value) || 0;
  }
  return snap;
}

export const instagramConnection = {
  status: 'not_connected',
  describe: () => 'Manual entry is active. The Instagram API connection is planned for phase 2.',
};
