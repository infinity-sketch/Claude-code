// In-memory app state mirrored to IndexedDB, plus the domain actions that keep
// idea statuses, calendar slots and analytics consistent with each other.
import { db, STORES } from './db.js';
import { uid, statusIndex } from './lib/model.js';
import { postKey } from './lib/planning.js';

const COLLECTIONS = ['ideas', 'shoots', 'posts', 'sounds', 'metrics', 'followers', 'notes'];

const DEFAULT_SETTINGS = {
  id: 'settings',
  crossPost: true,
  defaultTimes: { instagram: '18:00', tiktok: '19:00' },
};

export const state = {
  ideas: [], shoots: [], posts: [], sounds: [], metrics: [], followers: [], notes: [],
  settings: { ...DEFAULT_SETTINGS },
};

const listeners = new Set();
export const subscribe = fn => (listeners.add(fn), () => listeners.delete(fn));
const notify = () => listeners.forEach(fn => fn());

export async function load() {
  for (const c of COLLECTIONS) state[c] = await db.getAll(c);
  const settings = await db.get('meta', 'settings');
  state.settings = { ...DEFAULT_SETTINGS, ...(settings || {}), defaultTimes: { ...DEFAULT_SETTINGS.defaultTimes, ...(settings?.defaultTimes || {}) } };
}

async function put(collection, obj) {
  const list = state[collection];
  const i = list.findIndex(x => x.id === obj.id);
  if (i >= 0) list[i] = obj; else list.push(obj);
  await db.put(collection, obj);
}

async function remove(collection, id) {
  state[collection] = state[collection].filter(x => x.id !== id);
  await db.delete(collection, id);
}

export const find = (collection, id) => state[collection].find(x => x.id === id);
const now = () => new Date().toISOString();

/* ---------- Settings ---------- */
export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await db.put('meta', state.settings);
  notify();
}

/* ---------- Ideas ---------- */
export async function saveIdea(data) {
  const existing = data.id && find('ideas', data.id);
  const idea = { ...(existing || { id: uid('i_'), createdAt: now(), status: 'idea' }), ...data, updatedAt: now() };
  await put('ideas', idea);
  notify();
  return idea;
}

export async function setIdeaStatus(id, status) {
  const idea = find('ideas', id);
  if (!idea || idea.status === status) return;
  await put('ideas', { ...idea, status, updatedAt: now() });
  notify();
}

export async function deleteIdea(id) {
  await remove('ideas', id);
  for (const s of state.shoots.filter(s => s.shotList?.some(x => x.ideaId === id))) {
    await put('shoots', { ...s, shotList: s.shotList.filter(x => x.ideaId !== id) });
  }
  for (const p of state.posts.filter(p => p.ideaId === id)) await put('posts', { ...p, ideaId: null });
  notify();
}

/* ---------- Shoots ---------- */
export async function saveShoot(data) {
  const existing = data.id && find('shoots', data.id);
  const shoot = { ...(existing || { id: uid('s_'), createdAt: now(), checklist: [], shotList: [] }), ...data, updatedAt: now() };
  await put('shoots', shoot);
  notify();
  return shoot;
}

export async function deleteShoot(id) {
  await remove('shoots', id);
  notify();
}

// Ticked shot-list items become "Shot" — never downgrading ideas that are already further along.
export async function markTickedAsShot(shootId) {
  const shoot = find('shoots', shootId);
  if (!shoot) return 0;
  let n = 0;
  for (const item of shoot.shotList.filter(x => x.done)) {
    const idea = find('ideas', item.ideaId);
    if (idea && statusIndex(idea.status) < statusIndex('shot')) {
      await put('ideas', { ...idea, status: 'shot', updatedAt: now() });
      n++;
    }
  }
  notify();
  return n;
}

/* ---------- Posts (calendar slots) ---------- */
export const postAt = (date, platform) => state.posts.find(p => postKey(p.date, p.platform) === postKey(date, platform));

async function onIdeaScheduled(ideaId) {
  const idea = ideaId && find('ideas', ideaId);
  if (idea && (idea.status === 'shot' || idea.status === 'edited')) {
    await put('ideas', { ...idea, preScheduleStatus: idea.status, status: 'scheduled', updatedAt: now() });
  }
}

async function onIdeaUnscheduled(ideaId) {
  const idea = ideaId && find('ideas', ideaId);
  if (!idea || idea.status !== 'scheduled') return;
  if (state.posts.some(p => p.ideaId === ideaId)) return;
  await put('ideas', { ...idea, status: idea.preScheduleStatus || 'edited', updatedAt: now() });
}

export async function savePost(data) {
  const existing = data.id && find('posts', data.id);
  const post = { ...(existing || { id: uid('p_'), createdAt: now(), status: 'planned' }), ...data, updatedAt: now() };
  // One post per day per platform: a post moved onto an occupied slot replaces it.
  const clash = state.posts.find(p => p.id !== post.id && p.date === post.date && p.platform === post.platform);
  if (clash) await remove('posts', clash.id);
  await put('posts', post);
  if (post.status === 'posted') await setPostedStatus(post.ideaId);
  else await onIdeaScheduled(post.ideaId);
  if (existing && existing.ideaId !== post.ideaId) await onIdeaUnscheduled(existing.ideaId);
  if (clash && clash.ideaId !== post.ideaId) await onIdeaUnscheduled(clash.ideaId);
  notify();
  return post;
}

export async function deletePost(id) {
  const post = find('posts', id);
  if (!post) return;
  await remove('posts', id);
  for (const m of state.metrics.filter(m => m.postId === id)) await remove('metrics', m.id);
  await onIdeaUnscheduled(post.ideaId);
  notify();
}

async function setPostedStatus(ideaId) {
  const idea = ideaId && find('ideas', ideaId);
  if (idea && idea.status !== 'posted') await put('ideas', { ...idea, status: 'posted', updatedAt: now() });
}

export async function markPosted(id, posted = true) {
  const post = find('posts', id);
  if (!post) return;
  await put('posts', { ...post, status: posted ? 'posted' : 'planned', postedAt: posted ? now() : null, updatedAt: now() });
  if (posted) await setPostedStatus(post.ideaId);
  else {
    const idea = post.ideaId && find('ideas', post.ideaId);
    const stillPosted = state.posts.some(p => p.ideaId === post.ideaId && p.status === 'posted');
    if (idea && idea.status === 'posted' && !stillPosted) await put('ideas', { ...idea, status: 'scheduled', updatedAt: now() });
  }
  notify();
}

/* ---------- Analytics ---------- */
// Manual entry keeps one editable snapshot per post; API imports (phase 2) append their own.
export async function saveManualMetrics(postId, values, { rating, ratingWhy, notes } = {}) {
  const snap = { ...values, id: `manual_${postId}`, postId, source: 'manual', capturedAt: now() };
  await put('metrics', snap);
  const post = find('posts', postId);
  if (post) await put('posts', { ...post, rating: rating ?? post.rating ?? null, ratingWhy: ratingWhy ?? post.ratingWhy ?? '', notes: notes ?? post.notes ?? '', updatedAt: now() });
  notify();
}

export async function saveFollowerCount({ id, date, platform, count }) {
  await put('followers', { id: id || uid('f_'), date, platform, count: Number(count) || 0, source: 'manual', capturedAt: now() });
  notify();
}

export async function deleteFollowerCount(id) {
  await remove('followers', id);
  notify();
}

/* ---------- Sounds ---------- */
const objectUrls = new Map();

export async function saveSound(data, file) {
  const existing = data.id && find('sounds', data.id);
  const sound = { ...(existing || { id: uid('snd_'), createdAt: now() }), ...data, updatedAt: now() };
  if (sound.hot && !existing?.hot) sound.hotSince = sound.hotSince || new Date().toISOString().slice(0, 10);
  if (!sound.hot) sound.hotSince = null;
  if (file) {
    if (existing?.fileId) await dropFile(existing.fileId);
    const fileId = uid('file_');
    await db.put('files', { id: fileId, blob: file, name: file.name, type: file.type });
    sound.fileId = fileId;
    sound.fileName = file.name;
  }
  await put('sounds', sound);
  notify();
  return sound;
}

export async function removeSoundFile(soundId) {
  const sound = find('sounds', soundId);
  if (!sound?.fileId) return;
  await dropFile(sound.fileId);
  await put('sounds', { ...sound, fileId: null, fileName: null });
  notify();
}

async function dropFile(fileId) {
  await db.delete('files', fileId);
  const url = objectUrls.get(fileId);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(fileId);
}

export async function deleteSound(id) {
  const sound = find('sounds', id);
  if (sound?.fileId) await dropFile(sound.fileId);
  await remove('sounds', id);
  for (const i of state.ideas.filter(i => i.soundId === id)) await put('ideas', { ...i, soundId: null });
  for (const p of state.posts.filter(p => p.soundId === id)) await put('posts', { ...p, soundId: null });
  notify();
}

export async function audioUrl(fileId) {
  if (!fileId) return null;
  if (objectUrls.has(fileId)) return objectUrls.get(fileId);
  const rec = await db.get('files', fileId);
  if (!rec?.blob) return null;
  const url = URL.createObjectURL(rec.blob);
  objectUrls.set(fileId, url);
  return url;
}

/* ---------- Notes ---------- */
export async function saveNote(data) {
  const existing = data.id && find('notes', data.id);
  const note = { ...(existing || { id: uid('n_'), createdAt: now() }), ...data, updatedAt: now() };
  await put('notes', note);
  notify();
  return note;
}

export async function deleteNote(id) {
  await remove('notes', id);
  notify();
}

/* ---------- Backup ---------- */
const blobToDataUrl = blob => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

export async function exportAll({ includeAudio = true } = {}) {
  const out = { app: 'lumiere-content-hq', version: 1, exportedAt: now(), settings: state.settings };
  for (const c of COLLECTIONS) out[c] = state[c];
  out.files = [];
  if (includeAudio) {
    for (const f of await db.getAll('files')) {
      out.files.push({ id: f.id, name: f.name, type: f.type, dataUrl: await blobToDataUrl(f.blob) });
    }
  }
  return out;
}

export async function importAll(data) {
  if (!data || data.app !== 'lumiere-content-hq') throw new Error('This is not a Lumière backup file.');
  for (const c of [...COLLECTIONS, 'files']) await db.clear(c);
  for (const c of COLLECTIONS) await db.bulkPut(c, Array.isArray(data[c]) ? data[c] : []);
  for (const f of data.files || []) {
    const blob = await (await fetch(f.dataUrl)).blob();
    await db.put('files', { id: f.id, name: f.name, type: f.type, blob });
  }
  if (data.settings) await db.put('meta', { ...data.settings, id: 'settings' });
  objectUrls.forEach(u => URL.revokeObjectURL(u));
  objectUrls.clear();
  await load();
  notify();
}

export async function eraseAll() {
  for (const s of STORES.filter(s => s !== 'meta')) await db.clear(s);
  await db.delete('meta', 'settings');
  await load();
  notify();
}
