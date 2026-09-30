import * as S from './store.js';
import * as auth from './auth.js';
import { esc, icon, closeAllSheets } from './ui.js';
import * as today from './views/today.js';
import * as ideas from './views/ideas.js';
import * as shoots from './views/shoots.js';
import * as calendar from './views/calendar.js';
import * as sounds from './views/sounds.js';
import * as analytics from './views/analytics.js';
import * as notes from './views/notes.js';
import { renderMore, renderSettings } from './views/more.js';

const ROUTES = {
  today: { view: today, tab: 'today' },
  ideas: { view: ideas, tab: 'ideas' },
  shoots: { view: shoots, tab: 'shoots' },
  calendar: { view: calendar, tab: 'calendar' },
  sounds: { view: sounds, tab: 'more' },
  analytics: { view: analytics, tab: 'more' },
  notes: { view: notes, tab: 'more' },
  more: { view: { render: renderMore }, tab: 'more' },
  settings: { view: { render: renderSettings }, tab: 'more' },
};

const NAV = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'ideas', label: 'Ideas', icon: 'ideas' },
  { id: 'shoots', label: 'Shoot', icon: 'shoot' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'more', label: 'More', icon: 'more' },
];
const SIDEBAR = [
  ...NAV.slice(0, 4),
  { id: 'sounds', label: 'Sounds', icon: 'sound' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'notes', label: 'Notes', icon: 'note' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

let current = null;

function parseHash() {
  const [name, id] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: ROUTES[name] ? name : 'today', id: id ? decodeURIComponent(id) : null };
}

function render({ keepScroll = false } = {}) {
  const route = parseHash();
  const main = document.getElementById('view');
  const def = ROUTES[route.name];
  const scroll = keepScroll ? window.scrollY : 0;
  main.innerHTML = def.view.render({ id: route.id });
  def.view.mount?.(main, () => render({ keepScroll: true }));
  window.scrollTo(0, scroll);
  document.querySelectorAll('[data-nav]').forEach(a => {
    const active = a.closest('.tabbar') ? a.dataset.nav === def.tab : a.dataset.nav === route.name;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  current = route;
}

function shell() {
  document.getElementById('app').innerHTML = `
    <aside class="sidebar">
      <div class="brand">Lumière<small>Content HQ</small></div>
      ${SIDEBAR.map(n => `<a href="#/${n.id}" data-nav="${n.id}">${icon[n.icon]}<span>${esc(n.label)}</span></a>`).join('')}
    </aside>
    <main id="view" class="view"></main>
    <nav class="tabbar" aria-label="Main">
      ${NAV.map(n => `<a href="#/${n.id}" data-nav="${n.id}">${icon[n.icon]}<span>${esc(n.label)}</span></a>`).join('')}
    </nav>`;
}

async function start() {
  await S.load();
  document.getElementById('lock').hidden = true;
  document.getElementById('app').hidden = false;
  shell();
  render();
  window.addEventListener('hashchange', () => { closeAllSheets(); render(); });
  S.subscribe(() => render({ keepScroll: true }));
  // Re-render when coming back to the app so "Today" rolls over at midnight.
  let lastDay = new Date().toDateString();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && new Date().toDateString() !== lastDay) {
      lastDay = new Date().toDateString();
      render({ keepScroll: true });
    }
  });
}

/* ---------- Lock screen ---------- */
async function lockScreen() {
  const el = document.getElementById('lock');
  if (!auth.cryptoAvailable()) {
    el.innerHTML = `<div class="lock-card"><div class="brand big">Lumière</div><p class="warn-line">This page must be opened over https (or localhost) for the passcode lock to work.</p></div>`;
    return;
  }
  const firstRun = !(await auth.hasPasscode());
  el.innerHTML = `<form class="lock-card" id="lock-form" autocomplete="off">
    <div class="brand big">Lumière<small>Content HQ</small></div>
    <p class="muted">${firstRun ? 'Welcome. Choose a passcode to lock your planner on this device.' : 'Enter your passcode.'}</p>
    <input type="password" name="pass" placeholder="Passcode" required minlength="4" autocomplete="${firstRun ? 'new-password' : 'current-password'}" aria-label="Passcode">
    ${firstRun ? '<input type="password" name="confirm" placeholder="Repeat passcode" required minlength="4" autocomplete="new-password" aria-label="Repeat passcode">' : ''}
    <label class="toggle"><input type="checkbox" name="remember" checked><span>Keep me signed in on this device</span></label>
    <p class="warn-line" id="lock-err" hidden></p>
    <button class="btn primary big block" type="submit">${firstRun ? 'Create passcode' : 'Unlock'}</button>
  </form>`;
  const form = el.querySelector('form');
  const err = el.querySelector('#lock-err');
  form.elements.pass.focus();
  form.onsubmit = async e => {
    e.preventDefault();
    err.hidden = true;
    const pass = form.elements.pass.value;
    if (firstRun) {
      if (pass !== form.elements.confirm.value) {
        err.hidden = false;
        err.textContent = "Passcodes don't match.";
        return;
      }
      await auth.setPasscode(pass);
    } else if (!(await auth.verify(pass))) {
      err.hidden = false;
      err.textContent = 'Wrong passcode.';
      form.elements.pass.select();
      return;
    }
    auth.markUnlocked(form.elements.remember.checked);
    start();
  };
}

async function boot() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  if ((await auth.hasPasscode()) && auth.isUnlocked()) start();
  else lockScreen();
}

boot().catch(e => {
  document.getElementById('lock').innerHTML = `<div class="lock-card"><p class="warn-line">Could not start: ${esc(e.message)}</p></div>`;
});

export { current };
