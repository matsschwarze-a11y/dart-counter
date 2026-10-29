import { h, confirmDialog, dateTime } from '../dom.js';
import { currentState } from '../../core/match.js';

export async function renderHome(root, ctx) {
  ctx.setTitle('Dart Counter', { back: null });
  const running = await ctx.repo.getRunningMatch();
  const tournament = await ctx.repo.getRunningTournament();

  const items = [];
  if (running) {
    const s = currentState(running);
    items.push(h('section', { class: 'card resume' },
      h('div', { class: 'resume-title' }, 'Laufendes Match'),
      h('div', { class: 'muted' }, `${running.participants.map((p) => p.name).join(' vs. ')} · ${running.settings.startScore} · seit ${dateTime(running.createdAt)}`),
      h('div', { class: 'muted' }, `Rest: ${running.participants.map((p, i) => `${p.name} ${s.rests[i]}`).join(', ')}`),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn primary big grow', onClick: () => ctx.navigate('#/spiel') }, 'Fortsetzen'),
        h('button', {
          class: 'btn danger',
          onClick: async () => {
            if (await confirmDialog('Match abbrechen?', 'Das Match wird als abgebrochen gespeichert und zählt nicht in der Statistik.', { okLabel: 'Abbrechen', danger: true })) {
              await ctx.repo.abortMatch(running.id);
              ctx.navigate('#/');
            }
          },
        }, 'Abbrechen'))));
  }

  items.push(h('nav', { class: 'menu' },
    h('a', { class: 'btn primary big', href: '#/neu' }, running ? 'Neues Match' : 'Neues Match starten'),
    h('a', { class: 'btn big', href: '#/turnier' }, tournament ? 'Turnier fortsetzen' : 'Turnier'),
    h('a', { class: 'btn big', href: '#/statistik' }, 'Statistik'),
    h('a', { class: 'btn big', href: '#/historie' }, 'Match-Historie'),
    h('a', { class: 'btn big', href: '#/spieler' }, 'Spieler'),
    h('a', { class: 'btn big', href: '#/backup' }, 'Sicherung & Export'),
    ctx.dev ? h('a', { class: 'btn big', href: '#/dev' }, 'Entwickler: Bot-Simulation') : null,
  ));
  root.append(h('div', { class: 'page' }, items));
}
