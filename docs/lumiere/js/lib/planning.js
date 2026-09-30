// Planning math: calendar slots and the shoot batch counter. Pure functions over app state.
import { rangeDays } from './dates.js';
import { LANES } from './model.js';

export function postKey(date, platform) {
  return `${date}|${platform}`;
}

export function indexPosts(posts) {
  const map = new Map();
  for (const p of posts) map.set(postKey(p.date, p.platform), p);
  return map;
}

// How much content is needed to fill the next `days` days (starting today) vs. what is ready.
// With cross-posting on, one video can fill both lanes of a day, so a day only needs a new
// video when both lanes are empty; a half-filled day can reuse the other lane's video.
export function batchCounter(state, today, days, { crossPost = true } = {}) {
  const byKey = indexPosts(state.posts);
  let filled = 0;
  let empty = 0;
  let emptyDays = 0;
  for (const date of rangeDays(today, days)) {
    let dayEmpty = 0;
    for (const lane of LANES) {
      if (byKey.has(postKey(date, lane.id))) filled++;
      else { empty++; dayEmpty++; }
    }
    if (dayEmpty === LANES.length) emptyDays++;
  }
  const shot = state.ideas.filter(i => i.status === 'shot').length;
  const edited = state.ideas.filter(i => i.status === 'edited').length;
  const ready = shot + edited;
  const ideasNeeded = crossPost ? emptyDays : empty;
  return {
    days,
    slots: days * LANES.length,
    filled,
    empty,
    shot,
    edited,
    ready,
    ideasNeeded,
    toFilm: Math.max(0, ideasNeeded - ready),
  };
}

export function emptySlots(state, dates) {
  const byKey = indexPosts(state.posts);
  const out = [];
  for (const date of dates) for (const lane of LANES) {
    if (!byKey.has(postKey(date, lane.id))) out.push({ date, platform: lane.id });
  }
  return out;
}
