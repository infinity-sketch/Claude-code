// Editors and shared blocks used by several screens (ideas, posts, sounds, metrics).
import * as S from './store.js';
import { state, find } from './store.js';
import { normalizeUrl, splitLinks, detectPlatform } from './lib/links.js';
import { CATEGORIES, STATUSES, STATUS_LABEL, LANES, RATINGS, METRIC_FIELDS, HOT_DAYS, catById, laneById, parseTags, statusIndex } from './lib/model.js';
import { todayISO, addDays, daysBetween, fmtDay, fmtShort, fmtTime } from './lib/dates.js';
import { esc, icon, openSheet, confirmSheet, toast, catChip, statusPill, tagList, linkRow, segmented, laneBadge, on, onInput } from './ui.js';

/* ---------- Sounds: shared display ---------- */
export function soundAge(sound, today = todayISO()) {
  if (!sound?.hot || !sound.hotSince) return { hot: false, outdated: false, days: 0 };
  const days = daysBetween(sound.hotSince, today);
  return { hot: true, outdated: days >= HOT_DAYS, days };
}

export function hotBadge(sound) {
  const a = soundAge(sound);
  if (!a.hot) return '';
  if (a.outdated) return `<span class="badge outdated">${icon.warn} Possibly outdated · hot since ${esc(fmtShort(sound.hotSince))}</span>`;
  return `<span class="badge hot">${icon.fire} Hot right now · ${esc(fmtShort(sound.hotSince))}</span>`;
}

export function soundBlock(soundId, { compact = false } = {}) {
  const s = soundId && find('sounds', soundId);
  if (!s) return '';
  const link = s.link ? normalizeUrl(s.link) : null;
  return `<div class="sound-block">
    <div class="sound-head">
      <span class="sound-ico">${icon.sound}</span>
      <div class="sound-meta"><b>${esc(s.title || 'Untitled sound')}</b><span>${esc(s.artist || '')}${s.mood ? ` · ${esc(s.mood)}` : ''}</span></div>
      ${link?.ok ? `<a class="btn open sm" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">Open ${icon.open}</a>` : ''}
    </div>
    ${link && !link.ok ? `<div class="warn-line">${icon.warn} Sound link can't be opened: ${esc(link.error)}</div>` : ''}
    ${!compact ? hotBadge(s) : ''}
    ${s.fileId ? `<audio class="audio" controls preload="none" data-file="${esc(s.fileId)}"></audio>` : ''}
  </div>`;
}

// <audio> elements get their blob URL after render (blobs live in IndexedDB).
export async function hydrateAudio(root) {
  for (const el of root.querySelectorAll('audio[data-file]')) {
    if (el.src) continue;
    const url = await S.audioUrl(el.dataset.file);
    if (url) el.src = url;
    else el.replaceWith(Object.assign(document.createElement('div'), { className: 'warn-line', textContent: 'Audio file missing on this device.' }));
  }
}

function soundOptions(selected) {
  const sounds = [...state.sounds].sort((a, b) => (b.hot === true) - (a.hot === true) || String(a.title).localeCompare(String(b.title)));
  return `<option value="">No sound</option>` + sounds.map(s =>
    `<option value="${esc(s.id)}" ${s.id === selected ? 'selected' : ''}>${s.hot ? '🔥 ' : ''}${esc(s.title || 'Untitled')}${s.artist ? ' — ' + esc(s.artist) : ''}</option>`).join('');
}

/* ---------- Ideas ---------- */
const allTags = () => [...new Set(state.ideas.flatMap(i => i.tags || []))].sort();

function linkPreview(text) {
  const links = splitLinks(text);
  if (!links.length) return '<p class="hint">Paste one link per line. https:// is added automatically.</p>';
  return links.map(linkRow).join('');
}

export function openIdeaEditor(ideaOrNull, defaults = {}) {
  const idea = ideaOrNull || { title: '', notes: '', links: [], category: defaults.category || 'founder', status: 'idea', tags: [], soundId: '' };
  const tags = allTags();
  openSheet({
    title: ideaOrNull ? 'Edit idea' : 'New idea',
    body: `<form class="form" id="idea-form" autocomplete="off">
      <label class="field"><span>Title</span><input name="title" required maxlength="140" value="${esc(idea.title)}" placeholder="e.g. Founder story: why linen"></label>
      <div class="field"><span>Category</span>${segmented('category', CATEGORIES, idea.category)}</div>
      <div class="field"><span>Status</span>${segmented('status', STATUSES.map(s => ({ id: s, label: STATUS_LABEL[s] })), idea.status)}</div>
      <label class="field"><span>Reference links</span><textarea name="links" rows="3" placeholder="instagram.com/reel/…&#10;tiktok.com/@…" data-input="idea-links">${esc((idea.links || []).join('\n'))}</textarea></label>
      <div class="link-preview" id="link-preview">${linkPreview((idea.links || []).join('\n'))}</div>
      <label class="field"><span>Tags</span><input name="tags" value="${esc((idea.tags || []).join(', '))}" placeholder="linen, summer, bts"></label>
      ${tags.length ? `<div class="chip-row wrap">${tags.map(t => `<button type="button" class="chip tag-add" data-act="tag-add" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
      <label class="field"><span>Sound</span><select name="soundId">${soundOptions(idea.soundId)}</select></label>
      <label class="field"><span>Notes</span><textarea name="notes" rows="4" placeholder="Hook, shots, outfit, script…">${esc(idea.notes)}</textarea></label>
    </form>`,
    footer: `${ideaOrNull ? `<button class="btn ghost danger-text" data-del>${icon.trash}Delete</button>` : ''}<button class="btn primary" form="idea-form" type="submit">Save idea</button>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      if (!ideaOrNull) setTimeout(() => form.elements.title.focus(), 50);
      form.onsubmit = async e => {
        e.preventDefault();
        const title = form.elements.title.value.trim();
        if (!title) return form.elements.title.focus();
        await S.saveIdea({
          ...(ideaOrNull ? { id: ideaOrNull.id } : {}),
          title,
          category: form.elements.category.value,
          status: form.elements.status.value,
          links: splitLinks(form.elements.links.value),
          tags: parseTags(form.elements.tags.value),
          soundId: form.elements.soundId.value || null,
          notes: form.elements.notes.value.trim(),
        });
        close();
        toast(ideaOrNull ? 'Idea saved' : 'Idea added');
      };
      el.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (await confirmSheet({ title: 'Delete idea?', message: `"${idea.title}" will be removed from the library, shoots and the calendar.` })) {
          await S.deleteIdea(ideaOrNull.id);
          close();
          toast('Idea deleted');
        }
      });
    },
  });
}

export function openIdeaDetail(id) {
  const idea = find('ideas', id);
  if (!idea) return;
  const posts = state.posts.filter(p => p.ideaId === id).sort((a, b) => a.date.localeCompare(b.date));
  openSheet({
    title: 'Idea',
    body: `<div class="detail">
      <div class="row gap">${catChip(idea.category)}${statusPill(idea.status)}</div>
      <h3 class="detail-title">${esc(idea.title)}</h3>
      <div class="stepper" role="group" aria-label="Status">
        ${STATUSES.map(s => `<button class="step ${statusIndex(s) <= statusIndex(idea.status) ? 'done' : ''} ${s === idea.status ? 'cur' : ''}" data-act="idea-set-status" data-id="${esc(id)}" data-status="${s}">${esc(STATUS_LABEL[s])}</button>`).join('')}
      </div>
      ${idea.links?.length ? `<div class="block"><h4>References</h4>${idea.links.map(linkRow).join('')}</div>` : ''}
      ${idea.notes ? `<div class="block"><h4>Notes</h4><p class="prewrap">${esc(idea.notes)}</p></div>` : ''}
      ${idea.soundId ? `<div class="block"><h4>Sound</h4>${soundBlock(idea.soundId)}</div>` : ''}
      ${idea.tags?.length ? `<div class="block"><h4>Tags</h4>${tagList(idea.tags)}</div>` : ''}
      ${posts.length ? `<div class="block"><h4>On the calendar</h4>${posts.map(p => `<button class="list-row" data-act="post-open" data-date="${p.date}" data-platform="${p.platform}">${laneBadge(p.platform)}<span>${esc(fmtDay(p.date))}${p.time ? ' · ' + esc(fmtTime(p.time)) : ''}</span>${p.status === 'posted' ? `<span class="ok-dot">${icon.check}</span>` : ''}</button>`).join('')}</div>` : ''}
    </div>`,
    footer: `<button class="btn ghost" data-edit>${icon.edit}Edit</button><button class="btn primary" data-schedule>${icon.calendar}Schedule</button>`,
    onMount(el, close) {
      hydrateAudio(el);
      el.querySelector('[data-edit]').onclick = () => { close(); openIdeaEditor(find('ideas', id)); };
      el.querySelector('[data-schedule]').onclick = () => {
        close();
        const slot = nextEmptySlot();
        openPostEditor({ ...slot, ideaId: id });
      };
    },
  });
}

export function nextEmptySlot(from = todayISO(), platform) {
  const lanes = platform ? [platform] : LANES.map(l => l.id);
  for (let i = 0; i < 120; i++) {
    const date = addDays(from, i);
    for (const p of lanes) if (!S.postAt(date, p)) return { date, platform: p };
  }
  return { date: from, platform: lanes[0] };
}

/* ---------- Posts ---------- */
const assignable = currentIdeaId => state.ideas
  .filter(i => ['shot', 'edited', 'scheduled', 'posted'].includes(i.status) || i.id === currentIdeaId)
  .sort((a, b) => statusIndex(a.status) - statusIndex(b.status) || String(a.title).localeCompare(String(b.title)));

function ideaChoices(selectedId, query = '') {
  const q = query.trim().toLowerCase();
  const list = assignable(selectedId).filter(i => !q || i.title.toLowerCase().includes(q) || (i.tags || []).some(t => t.includes(q)));
  if (!list.length) {
    return `<p class="hint">${q ? 'No matches.' : 'No Shot or Edited ideas yet. Mark ideas as Shot from the Shoot planner.'}</p>`;
  }
  return list.map(i => `
    <label class="choice ${i.id === selectedId ? 'on' : ''}" style="--c:${catById(i.category).color}">
      <input type="radio" name="ideaId" value="${esc(i.id)}" ${i.id === selectedId ? 'checked' : ''}>
      <i class="bar"></i><span class="choice-title">${esc(i.title)}</span>${statusPill(i.status)}
    </label>`).join('');
}

const notesIn = section => state.notes.filter(n => n.section === section);

export function openPostEditor({ date, platform, ideaId: presetIdea }) {
  const existing = S.postAt(date, platform);
  const post = existing || { date, platform, ideaId: presetIdea || null, caption: '', hashtags: '', time: state.settings.defaultTimes[platform] || '', soundId: null, notes: '', status: 'planned' };
  if (presetIdea) post.ideaId = presetIdea;
  const idea = post.ideaId && find('ideas', post.ideaId);
  const soundId = post.soundId || idea?.soundId || '';
  const templates = notesIn('captions');
  const tagSets = notesIn('hashtags');

  openSheet({
    title: existing ? 'Edit post' : 'Plan post',
    wide: true,
    body: `<form class="form" id="post-form" autocomplete="off">
      <div class="grid2">
        <label class="field"><span>Date</span><input type="date" name="date" value="${esc(post.date)}" required></label>
        <label class="field"><span>Time</span><input type="time" name="time" value="${esc(post.time || '')}"></label>
      </div>
      <div class="field"><span>Platform</span>${segmented('platform', LANES, post.platform)}</div>
      <div class="warn-line" id="clash" hidden></div>
      <div class="field"><span>Video</span>
        <div class="search sm">${icon.search}<input type="search" placeholder="Search shot & edited ideas" data-input="post-idea-search"></div>
        <div class="choices" id="idea-choices">${ideaChoices(post.ideaId)}</div>
      </div>
      <label class="field"><span>Caption</span><textarea name="caption" rows="4" placeholder="Write the caption for this platform">${esc(post.caption)}</textarea></label>
      <div class="chip-row wrap" id="caption-helpers"></div>
      <label class="field"><span>Hashtags</span><textarea name="hashtags" rows="2" placeholder="#linen #slowfashion">${esc(post.hashtags)}</textarea></label>
      ${tagSets.length ? `<div class="chip-row wrap">${tagSets.map(n => `<button type="button" class="chip" data-insert="hashtags" data-note="${esc(n.id)}">+ ${esc(n.title || 'Hashtag set')}</button>`).join('')}</div>` : ''}
      <label class="field"><span>Sound</span><select name="soundId">${soundOptions(soundId)}</select></label>
      <label class="field"><span>Post notes</span><textarea name="notes" rows="2" placeholder="Anything to remember for this post">${esc(post.notes || '')}</textarea></label>
      <label class="toggle"><input type="checkbox" name="posted" ${post.status === 'posted' ? 'checked' : ''}><span>Already posted</span></label>
    </form>`,
    footer: `${existing ? `<button class="btn ghost danger-text" data-del>${icon.trash}Clear slot</button>` : ''}<button class="btn primary" form="post-form" type="submit">Save post</button>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const clash = el.querySelector('#clash');
      const helpers = el.querySelector('#caption-helpers');
      let chosen = post.ideaId;

      const renderHelpers = () => {
        const other = chosen && state.posts.find(p => p.ideaId === chosen && p.id !== existing?.id && p.caption);
        helpers.innerHTML = [
          other ? `<button type="button" class="chip" data-copy-from="${esc(other.id)}">${icon.copy} Copy ${esc(laneById(other.platform).label)} caption</button>` : '',
          ...templates.map(n => `<button type="button" class="chip" data-insert="caption" data-note="${esc(n.id)}">+ ${esc(n.title || 'Template')}</button>`),
        ].join('');
      };
      const checkClash = () => {
        const d = form.elements.date.value;
        const p = form.elements.platform.value;
        const other = d && S.postAt(d, p);
        const replacing = other && other.id !== existing?.id;
        clash.hidden = !replacing;
        if (replacing) {
          const t = find('ideas', other.ideaId)?.title || 'a post';
          clash.innerHTML = `${icon.warn} ${esc(laneById(p).label)} on ${esc(fmtShort(d))} already has "${esc(t)}". Saving replaces it.`;
        }
      };
      renderHelpers();
      checkClash();
      form.elements.date.addEventListener('change', checkClash);
      form.addEventListener('change', e => {
        if (e.target.name === 'platform') checkClash();
        if (e.target.name === 'ideaId') {
          chosen = e.target.value;
          el.querySelectorAll('.choice').forEach(c => c.classList.toggle('on', c.querySelector('input').checked));
          const s = find('ideas', chosen)?.soundId;
          if (s && !form.elements.soundId.value) form.elements.soundId.value = s;
          renderHelpers();
        }
      });
      el.querySelector('[data-input="post-idea-search"]').addEventListener('input', e => {
        el.querySelector('#idea-choices').innerHTML = ideaChoices(chosen, e.target.value);
      });
      el.addEventListener('click', e => {
        const ins = e.target.closest('[data-insert]');
        if (ins) {
          const note = find('notes', ins.dataset.note);
          const field = form.elements[ins.dataset.insert];
          field.value = field.value ? `${field.value.trimEnd()}\n${note?.body || ''}` : (note?.body || '');
          field.focus();
        }
        const cp = e.target.closest('[data-copy-from]');
        if (cp) form.elements.caption.value = find('posts', cp.dataset.copyFrom)?.caption || '';
      });
      form.onsubmit = async e => {
        e.preventDefault();
        const saved = await S.savePost({
          ...(existing ? { id: existing.id } : {}),
          date: form.elements.date.value,
          platform: form.elements.platform.value,
          time: form.elements.time.value,
          ideaId: chosen || null,
          caption: form.elements.caption.value.trim(),
          hashtags: form.elements.hashtags.value.trim(),
          soundId: form.elements.soundId.value || null,
          notes: form.elements.notes.value.trim(),
          status: form.elements.posted.checked ? 'posted' : 'planned',
          postedAt: form.elements.posted.checked ? (existing?.postedAt || new Date().toISOString()) : null,
        });
        close();
        toast(`${laneById(saved.platform).label} · ${fmtShort(saved.date)} saved`);
      };
      el.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (await confirmSheet({ title: 'Clear this slot?', message: 'The post and any logged stats for it will be removed. The idea stays in your library.', confirmLabel: 'Clear slot' })) {
          await S.deletePost(existing.id);
          close();
          toast('Slot cleared');
        }
      });
    },
  });
}

/* ---------- Analytics entry ---------- */
export function openMetricsEditor(postId) {
  const post = find('posts', postId);
  if (!post) return;
  const idea = find('ideas', post.ideaId);
  const m = state.metrics.filter(x => x.postId === postId).sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)))[0] || {};
  openSheet({
    title: 'Log results',
    body: `<form class="form" id="metrics-form">
      <div class="row gap">${laneBadge(post.platform)}<span class="muted">${esc(fmtDay(post.date))}</span></div>
      <h3 class="detail-title">${esc(idea?.title || 'Untitled post')}</h3>
      <div class="metric-grid">
        ${METRIC_FIELDS.map(f => `<label class="field"><span>${esc(f.label)}</span><input type="number" inputmode="numeric" min="0" step="1" name="${f.id}" value="${m[f.id] ?? ''}" placeholder="0"></label>`).join('')}
      </div>
      <div class="field"><span>How did it do?</span>${segmented('rating', RATINGS, post.rating || '')}</div>
      <label class="field"><span>Why?</span><textarea name="ratingWhy" rows="3" placeholder="Hook landed in 1s, trending sound, posted too late…">${esc(post.ratingWhy || '')}</textarea></label>
      <label class="field"><span>Post notes</span><textarea name="notes" rows="2">${esc(post.notes || '')}</textarea></label>
      <p class="hint">Entered manually${m.source && m.source !== 'manual' ? ` · last synced from ${esc(m.source)}` : ''}. Instagram API sync is planned for phase 2.</p>
    </form>`,
    footer: `<button class="btn primary" form="metrics-form" type="submit">Save results</button>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      form.onsubmit = async e => {
        e.preventDefault();
        const values = {};
        for (const f of METRIC_FIELDS) {
          const v = form.elements[f.id].value;
          values[f.id] = v === '' ? null : Math.max(0, Math.round(Number(v)));
        }
        await S.saveManualMetrics(postId, values, {
          rating: form.elements.rating.value || null,
          ratingWhy: form.elements.ratingWhy.value.trim(),
          notes: form.elements.notes.value.trim(),
        });
        close();
        toast('Results saved');
      };
    },
  });
}

export function openFollowerEditor() {
  openSheet({
    title: 'Log follower count',
    body: `<form class="form" id="fol-form">
      <div class="field"><span>Platform</span>${segmented('platform', LANES, 'instagram')}</div>
      <div class="grid2">
        <label class="field"><span>Date</span><input type="date" name="date" value="${todayISO()}" required></label>
        <label class="field"><span>Followers</span><input type="number" inputmode="numeric" min="0" name="count" required placeholder="0"></label>
      </div>
    </form>`,
    footer: `<button class="btn primary" form="fol-form" type="submit">Save</button>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      form.onsubmit = async e => {
        e.preventDefault();
        const date = form.elements.date.value;
        const platform = form.elements.platform.value;
        // One count per platform per day: re-logging a day updates it.
        const same = state.followers.find(f => f.date === date && f.platform === platform);
        await S.saveFollowerCount({ id: same?.id, date, platform, count: form.elements.count.value });
        close();
        toast('Follower count saved');
      };
    },
  });
}

/* ---------- Sound editor ---------- */
const SOUND_PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'both', label: 'Both' },
];

export function openSoundEditor(soundOrNull) {
  const s = soundOrNull || { title: '', artist: '', mood: '', platform: 'tiktok', link: '', notes: '', hot: true };
  const moods = [...new Set(state.sounds.map(x => x.mood).filter(Boolean))].sort();
  openSheet({
    title: soundOrNull ? 'Edit sound' : 'Add sound',
    body: `<form class="form" id="sound-form" autocomplete="off">
      <label class="field"><span>Sound link</span><input name="link" value="${esc(s.link || '')}" placeholder="Paste TikTok / Instagram sound link" inputmode="url"></label>
      <div id="sound-link-preview">${s.link ? linkRow(s.link) : ''}</div>
      <div class="field"><span>…or audio file (mp3 / m4a)</span>
        <label class="file-drop">${icon.upload}<span id="file-label">${s.fileName ? esc(s.fileName) : 'Choose audio file'}</span>
          <input type="file" name="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,.mp3,.m4a" hidden>
        </label>
        ${s.fileId ? `<audio class="audio" controls preload="none" data-file="${esc(s.fileId)}"></audio><button type="button" class="btn ghost sm danger-text" data-remove-file>Remove file</button>` : ''}
      </div>
      <label class="field"><span>Title</span><input name="title" required value="${esc(s.title)}" placeholder="Sound name"></label>
      <label class="field"><span>Artist</span><input name="artist" value="${esc(s.artist)}"></label>
      <label class="field"><span>Mood</span><input name="mood" list="moods" value="${esc(s.mood)}" placeholder="dreamy, upbeat, moody…"><datalist id="moods">${moods.map(m => `<option value="${esc(m)}">`).join('')}</datalist></label>
      <div class="field"><span>Platform</span>${segmented('platform', SOUND_PLATFORMS, s.platform)}</div>
      <label class="toggle"><input type="checkbox" name="hot" ${s.hot ? 'checked' : ''}><span>${icon.fire} Hot right now${s.hot && s.hotSince ? ` (since ${esc(fmtShort(s.hotSince))})` : ''}</span></label>
      <label class="field"><span>Notes</span><textarea name="notes" rows="3" placeholder="Where it's trending, which part to use…">${esc(s.notes)}</textarea></label>
    </form>`,
    footer: `${soundOrNull ? `<button class="btn ghost danger-text" data-del>${icon.trash}Delete</button>` : ''}<button class="btn primary" form="sound-form" type="submit">Save sound</button>`,
    onMount(el, close) {
      hydrateAudio(el);
      const form = el.querySelector('form');
      let file = null;
      form.elements.link.addEventListener('input', () => {
        const v = form.elements.link.value.trim();
        el.querySelector('#sound-link-preview').innerHTML = v ? linkRow(v) : '';
        const r = normalizeUrl(v);
        if (r.ok && (r.platform === 'tiktok' || r.platform === 'instagram')) {
          form.querySelector(`input[name=platform][value=${r.platform}]`).click();
        }
      });
      form.elements.file.addEventListener('change', () => {
        const f = form.elements.file.files[0];
        if (!f) return;
        if (!/\.(mp3|m4a)$/i.test(f.name) && !/^audio\//.test(f.type)) {
          toast('Please choose an mp3 or m4a file');
          form.elements.file.value = '';
          return;
        }
        file = f;
        el.querySelector('#file-label').textContent = f.name;
        if (!form.elements.title.value) form.elements.title.value = f.name.replace(/\.[^.]+$/, '');
      });
      el.querySelector('[data-remove-file]')?.addEventListener('click', async () => {
        await S.removeSoundFile(soundOrNull.id);
        close();
        openSoundEditor(find('sounds', soundOrNull.id));
      });
      form.onsubmit = async e => {
        e.preventDefault();
        const link = form.elements.link.value.trim();
        if (!link && !file && !s.fileId) {
          toast('Add a link or an audio file');
          return;
        }
        await S.saveSound({
          ...(soundOrNull ? { id: soundOrNull.id } : {}),
          link,
          title: form.elements.title.value.trim(),
          artist: form.elements.artist.value.trim(),
          mood: form.elements.mood.value.trim().toLowerCase(),
          platform: form.elements.platform.value,
          hot: form.elements.hot.checked,
          notes: form.elements.notes.value.trim(),
        }, file);
        close();
        toast('Sound saved');
      };
      el.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (await confirmSheet({ title: 'Delete sound?', message: 'It will be detached from any ideas and posts that use it.' })) {
          await S.deleteSound(soundOrNull.id);
          close();
          toast('Sound deleted');
        }
      });
    },
  });
}

export { detectPlatform };

/* ---------- Delegated actions shared across screens ---------- */
const closeSheetOf = el => el.closest('.sheet-wrap')?.closeSheet(true);

on('idea-open', el => openIdeaDetail(el.dataset.id));
on('idea-new', el => openIdeaEditor(null, { category: el.dataset.category }));
on('idea-set-status', async el => {
  await S.setIdeaStatus(el.dataset.id, el.dataset.status);
  closeSheetOf(el);
  openIdeaDetail(el.dataset.id);
});
on('post-open', el => {
  closeSheetOf(el);
  openPostEditor({ date: el.dataset.date, platform: el.dataset.platform });
});
on('metrics-open', el => openMetricsEditor(el.dataset.id));
on('sound-open', el => openSoundEditor(find('sounds', el.dataset.id)));
on('sound-new', () => openSoundEditor(null));
on('tag-add', el => {
  const input = el.closest('form').elements.tags;
  const tags = parseTags(input.value);
  if (!tags.includes(el.dataset.tag)) tags.push(el.dataset.tag);
  input.value = tags.join(', ');
});
onInput('idea-links', el => {
  el.closest('form').parentElement.querySelector('#link-preview').innerHTML = linkPreview(el.value);
});
