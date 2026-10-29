// App-Shell: Datenbank, Router, Service Worker, Update-Hinweis.
import { openIndexedDb, memoryDb } from '../data/db.js';
import { Repo } from '../data/repo.js';
import { clear, toast } from './dom.js';
import { renderHome } from './views/home.js';
import { renderSetup } from './views/setup.js';
import { renderGame } from './views/game.js';
import { renderPlayers } from './views/players.js';
import { renderStats } from './views/stats.js';
import { renderHistory, renderMatchDetail } from './views/history.js';
import { renderBackup } from './views/backup.js';
import { renderDev } from './views/dev.js';

const view = document.getElementById('view');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('back');
const rightEl = document.getElementById('topbar-right');

const ctx = {
  repo: null,
  dev: false,
  navigate(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  },
  setTitle(title, { back = '#/', right = null } = {}) {
    titleEl.textContent = title;
    document.title = title === 'Dart Counter' ? title : `${title} – Dart Counter`;
    backBtn.hidden = !back;
    backBtn.onclick = () => ctx.navigate(back);
    clear(rightEl);
    if (right) rightEl.append(right);
  },
};

let cleanup = null;

const ROUTES = [
  [/^#?\/?$/, renderHome],
  [/^#\/neu$/, renderSetup],
  [/^#\/spiel$/, renderGame],
  [/^#\/spieler$/, renderPlayers],
  [/^#\/statistik$/, renderStats],
  [/^#\/historie$/, renderHistory],
  [/^#\/historie\/(.+)$/, renderMatchDetail],
  [/^#\/backup$/, renderBackup],
  [/^#\/dev$/, renderDev],
];

async function route() {
  if (typeof cleanup === 'function') {
    try {
      cleanup();
    } catch (e) {
      console.error(e);
    }
  }
  cleanup = null;
  const hash = location.hash || '#/';
  const found = ROUTES.find(([re]) => re.test(hash)) || ROUTES[0];
  const params = hash.match(found[0])?.slice(1) || [];
  clear(view);
  document.body.dataset.view = found[1].name;
  window.scrollTo(0, 0);
  try {
    cleanup = await found[1](view, ctx, ...params);
  } catch (e) {
    console.error(e);
    view.textContent = 'Fehler: ' + e.message;
  }
}

async function init() {
  const params = new URLSearchParams(location.search);
  try {
    if (params.get('dev') === '1') sessionStorage.setItem('dc-dev', '1');
    if (params.get('dev') === '0') sessionStorage.removeItem('dc-dev');
    ctx.dev = sessionStorage.getItem('dc-dev') === '1';
  } catch {
    ctx.dev = params.get('dev') === '1';
  }
  try {
    ctx.repo = new Repo(await openIndexedDb());
  } catch (e) {
    console.error(e);
    ctx.repo = new Repo(memoryDb());
    toast('Speicher nicht verfügbar – Daten gehen beim Schließen verloren', 6000);
  }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  window.addEventListener('hashchange', route);
  await route();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const banner = document.getElementById('update-banner');
  const btn = document.getElementById('update-btn');
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const showUpdate = (worker) => {
      banner.hidden = false;
      btn.onclick = () => worker.postMessage('skipWaiting');
    };
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
      });
    });
    // Beim Zurückkehren in die App nach Updates suchen
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((e) => console.warn('Service Worker nicht registriert', e));
}

init();
