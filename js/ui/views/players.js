import { h, clear, askText, confirmDialog, toast } from '../dom.js';

export async function renderPlayers(root, ctx) {
  ctx.setTitle('Spieler');
  const { repo } = ctx;
  const page = h('div', { class: 'page' });
  root.append(page);

  async function render() {
    const players = await repo.listPlayers();
    clear(page);
    const humans = players.filter((p) => !p.isBot);
    const bots = players.filter((p) => p.isBot);

    const row = (p) => h('div', { class: 'list-row' },
      h('span', { class: 'grow' }, p.name),
      h('button', {
        class: 'btn small',
        onClick: async () => {
          const name = await askText('Umbenennen', p.name);
          if (name) {
            await repo.renamePlayer(p.id, name);
            render();
          }
        },
      }, 'Umbenennen'),
      h('button', {
        class: 'btn small danger',
        onClick: async () => {
          const ok = await confirmDialog(`${p.name} löschen?`, 'Bisherige Matches bleiben in der Historie erhalten, der Spieler erscheint aber nicht mehr in der Auswahl.', { okLabel: 'Löschen', danger: true });
          if (ok) {
            await repo.deletePlayer(p.id);
            toast('Gelöscht');
            render();
          }
        },
      }, 'Löschen'));

    page.append(h('section', { class: 'card' },
      h('h2', {}, 'Spielerprofile'),
      humans.length ? humans.map(row) : h('p', { class: 'muted' }, 'Noch keine Spieler angelegt.'),
      h('button', {
        class: 'btn primary block',
        onClick: async () => {
          const name = await askText('Neuer Spieler', '', { placeholder: 'Name' });
          if (name) {
            await repo.createPlayer({ name });
            render();
          }
        },
      }, '+ Spieler anlegen'),
      h('p', { class: 'muted small' }, 'Gastspieler (ohne Statistik) wählst du direkt beim Match-Start.')));

    page.append(h('section', { class: 'card' },
      h('h2', {}, 'Bots'),
      h('p', { class: 'muted small' }, 'Für jede Bot-Stufe wird beim ersten Match automatisch ein Profil angelegt, damit du gegen jede Stufe eine eigene Statistik hast.'),
      bots.length ? bots.map(row) : h('p', { class: 'muted' }, 'Noch keine Bots gespielt.')));
  }

  await render();
}
