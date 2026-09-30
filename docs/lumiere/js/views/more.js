import * as S from '../store.js';
import { state } from '../store.js';
import { LANES } from '../lib/model.js';
import { todayISO } from '../lib/dates.js';
import * as auth from '../auth.js';
import { instagramConnection } from '../integrations/instagram.js';
import { esc, icon, on, onChange, pageHead, toast, confirmSheet, openSheet } from '../ui.js';

const TILES = [
  { href: '#/sounds', icon: 'sound', label: 'Sound Library', sub: s => `${s.sounds.length} saved` },
  { href: '#/analytics', icon: 'chart', label: 'Analytics', sub: s => `${s.posts.filter(p => p.status === 'posted').length} posted` },
  { href: '#/notes', icon: 'note', label: 'Notes', sub: s => `${s.notes.length} notes` },
  { href: '#/settings', icon: 'settings', label: 'Settings', sub: () => 'Backup, passcode' },
];

export function renderMore() {
  return `${pageHead('More')}
    <div class="tiles">${TILES.map(t => `<a class="tile" href="${t.href}">${icon[t.icon]}<b>${esc(t.label)}</b><span>${esc(t.sub(state))}</span></a>`).join('')}</div>`;
}

export function renderSettings() {
  const s = state.settings;
  return `${pageHead('Settings')}
    <div class="stack">
      <section class="card">
        <h2>Planning</h2>
        <label class="toggle"><input type="checkbox" data-change="set-crosspost" ${s.crossPost ? 'checked' : ''}><span>Cross-post: one video can fill both Instagram and TikTok</span></label>
        <p class="hint">Used by the Batch Counter to work out how many videos you need to film.</p>
        <div class="grid2">
          ${LANES.map(l => `<label class="field"><span>Default ${esc(l.label)} time</span><input type="time" data-change="set-time" data-lane="${l.id}" value="${esc(s.defaultTimes[l.id] || '')}"></label>`).join('')}
        </div>
      </section>
      <section class="card">
        <h2>Instagram connection <span class="pill">Phase 2</span></h2>
        <p class="muted">${esc(instagramConnection.describe())}</p>
        <p class="hint">Posts and stats are already stored with a source and external post id, so API analytics can slot in next to your manual entries without changing anything you have logged.</p>
      </section>
      <section class="card">
        <h2>Backup</h2>
        <p class="muted">Everything is saved on this device. Export a backup regularly, and use it to move to a new phone.</p>
        <div class="btn-row">
          <button class="btn ghost big" data-act="backup-export">Export backup</button>
          <label class="btn ghost big">Import backup<input type="file" accept="application/json,.json" data-change="backup-import" hidden></label>
        </div>
      </section>
      <section class="card">
        <h2>Security</h2>
        <div class="btn-row">
          <button class="btn ghost big" data-act="pass-change">Change passcode</button>
          <button class="btn ghost big" data-act="lock-now">${icon.lock} Lock now</button>
        </div>
      </section>
      <section class="card danger-zone">
        <h2>Danger zone</h2>
        <button class="btn danger block" data-act="erase-all">Erase all content on this device</button>
      </section>
    </div>`;
}

onChange('set-crosspost', el => S.saveSettings({ crossPost: el.checked }));
onChange('set-time', el => S.saveSettings({ defaultTimes: { ...state.settings.defaultTimes, [el.dataset.lane]: el.value } }));

on('backup-export', async () => {
  const data = await S.exportAll();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `lumiere-backup-${todayISO()}.json` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded');
});

onChange('backup-import', async el => {
  const file = el.files[0];
  el.value = '';
  if (!file) return;
  if (!(await confirmSheet({ title: 'Replace everything?', message: 'Importing replaces all ideas, shoots, posts, sounds, stats and notes on this device with the backup.', confirmLabel: 'Import' }))) return;
  try {
    await S.importAll(JSON.parse(await file.text()));
    toast('Backup imported');
  } catch (err) {
    toast(err.message || 'Could not read that file');
  }
});

on('erase-all', async () => {
  if (await confirmSheet({ title: 'Erase everything?', message: 'All content on this device is deleted permanently. Export a backup first if you might need it.', confirmLabel: 'Erase all' })) {
    await S.eraseAll();
    toast('All content erased');
  }
});

on('lock-now', () => {
  auth.lock();
  location.reload();
});

on('pass-change', () => {
  openSheet({
    title: 'Change passcode',
    body: `<form class="form" id="pass-form">
      <label class="field"><span>Current passcode</span><input type="password" name="cur" required autocomplete="current-password"></label>
      <label class="field"><span>New passcode (min 4)</span><input type="password" name="next" required minlength="4" autocomplete="new-password"></label>
      <p class="warn-line" id="pass-err" hidden></p>
    </form>`,
    footer: `<button class="btn primary" form="pass-form" type="submit">Update</button>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      form.onsubmit = async e => {
        e.preventDefault();
        const err = el.querySelector('#pass-err');
        if (!(await auth.verify(form.elements.cur.value))) {
          err.hidden = false;
          err.textContent = 'Current passcode is wrong.';
          return;
        }
        await auth.setPasscode(form.elements.next.value);
        close();
        toast('Passcode updated');
      };
    },
  });
});
