// Shared constants for the content model. See docs/lumiere/README.md for the full schema.

export const CATEGORIES = [
  { id: 'founder', label: 'Founder Videos', color: '#d8b36a' },
  { id: 'film', label: 'Short Films', color: '#7aa7ff' },
  { id: 'skit', label: 'Skits', color: '#f07fa6' },
  { id: 'aesthetic', label: 'Aesthetics', color: '#a996f5' },
];

export const STATUSES = ['idea', 'ready', 'shot', 'edited', 'scheduled', 'posted'];
export const STATUS_LABEL = {
  idea: 'Idea',
  ready: 'Ready to Shoot',
  shot: 'Shot',
  edited: 'Edited',
  scheduled: 'Scheduled',
  posted: 'Posted',
};

// Posting lanes. Chart colors validated for CVD separation on the dark surface.
export const LANES = [
  { id: 'instagram', label: 'Instagram', short: 'IG', color: '#e0527f' },
  { id: 'tiktok', label: 'TikTok', short: 'TT', color: '#1fa3ae' },
];

export const RATINGS = [
  { id: 'worked', label: 'Worked' },
  { id: 'average', label: 'Average' },
  { id: 'flopped', label: 'Flopped' },
];

export const METRIC_FIELDS = [
  { id: 'views', label: 'Views' },
  { id: 'likes', label: 'Likes' },
  { id: 'comments', label: 'Comments' },
  { id: 'shares', label: 'Shares' },
  { id: 'saves', label: 'Saves' },
  { id: 'follows', label: 'Follows gained' },
  { id: 'linkClicks', label: 'Link clicks' },
];

export const NOTE_SECTIONS = [
  { id: 'hooks', label: 'Hooks that work' },
  { id: 'captions', label: 'Caption templates' },
  { id: 'hashtags', label: 'Hashtag sets' },
  { id: 'voice', label: 'Brand voice' },
  { id: 'general', label: 'General' },
];

export const HOT_DAYS = 14;

export const catById = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
export const laneById = id => LANES.find(l => l.id === id) || LANES[0];
export const statusIndex = s => STATUSES.indexOf(s);

export function uid(prefix = '') {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return prefix + Date.now().toString(36) + rand;
}

export function parseTags(text) {
  return [...new Set(String(text ?? '')
    .split(/[,#\n]+/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean))];
}
