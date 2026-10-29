import { h, fmt, dateTime, confirmDialog, toast } from '../dom.js';
import { dartLabel } from '../../core/board.js';
import { matchSummary, matchPlayerStats } from '../../stats/stats.js';

const STATUS = { running: 'läuft', finished: 'beendet', aborted: 'abgebrochen' };

export async function renderHistory(root, ctx) {
  ctx.setTitle('Match-Historie');
  const matches = await ctx.repo.listMatches();
  const page = h('div', { class: 'page' });
  root.append(page);
  if (!matches.length) {
    page.append(h('p', { class: 'muted' }, 'Noch keine Matches gespielt.'));
    return;
  }
  for (const m of matches) {
    const { legsWon, averages } = matchSummary(m);
    page.append(h('a', { class: 'card match-item', href: m.status === 'running' ? '#/spiel' : `#/historie/${m.id}` },
      h('div', { class: 'row between' },
        h('span', { class: 'muted small' }, `${dateTime(m.createdAt)} · ${m.settings.startScore}`),
        h('span', { class: 'badge ' + m.status }, STATUS[m.status])),
      m.participants.map((p, i) => h('div', { class: 'row between' + (m.winnerIndex === i ? ' winner' : '') },
        h('span', {}, p.name),
        h('span', { class: 'mono' }, `${legsWon[i]} · Ø ${fmt(averages[i])}`)))));
  }
}

export async function renderMatchDetail(root, ctx, id) {
  ctx.setTitle('Match', { back: '#/historie' });
  const m = await ctx.repo.getMatch(decodeURIComponent(id));
  const page = h('div', { class: 'page' });
  root.append(page);
  if (!m) {
    page.append(h('p', {}, 'Match nicht gefunden.'));
    return;
  }
  const f = m.settings.format;
  page.append(h('section', { class: 'card' },
    h('div', { class: 'muted small' }, `${dateTime(m.createdAt)} · ${m.settings.startScore} · ${{ double: 'Double-out', master: 'Master-out', straight: 'Straight-out' }[m.settings.outMode]}${m.settings.doubleIn ? ' · Double-in' : ''} · ${f.type === 'bestOf' ? 'Best of' : 'First to'} ${f.sets ? f.sets + ' Sets à ' : ''}${f.legs} Legs`),
    h('table', { class: 'table' },
      h('tr', {}, h('th', {}, ''), h('th', {}, 'Legs'), h('th', {}, 'Ø'), h('th', {}, 'F9'), h('th', {}, 'Checkout'), h('th', {}, '100+')),
      m.participants.map((p, i) => {
        const s = matchPlayerStats(m, i);
        return h('tr', { class: m.winnerIndex === i ? 'winner' : '' },
          h('td', {}, p.name), h('td', {}, String(s.legsWon)), h('td', {}, fmt(s.average)), h('td', {}, fmt(s.first9)),
          h('td', {}, s.attempts ? `${s.checkouts}/${s.attempts}` : '–'), h('td', {}, String(s.c100)));
      }))));

  for (const leg of m.legs) {
    if (!leg.visits.length) continue;
    const title = `${f.sets ? `Set ${leg.set} · ` : ''}Leg ${leg.leg}` + (leg.winnerIndex !== null && leg.winnerIndex !== undefined ? ` – ${m.participants[leg.winnerIndex].name}` : '');
    page.append(h('details', { class: 'card leg', open: m.legs.length <= 3 },
      h('summary', {}, title),
      h('table', { class: 'table visits' },
        h('tr', {}, h('th', {}, 'Spieler'), h('th', {}, 'Darts'), h('th', {}, 'Pkt'), h('th', {}, 'Rest')),
        leg.visits.map((v) => h('tr', { class: v.checkout ? 'checkout-row' : v.bust ? 'bust-row' : '' },
          h('td', {}, m.participants[v.p].name),
          h('td', { class: 'mono' }, v.darts.map(dartLabel).join(' ')),
          h('td', {}, v.bust ? 'Bust' : String(v.score)),
          h('td', {}, String(v.endRest)))))));
  }

  page.append(h('button', {
    class: 'btn danger block',
    onClick: async () => {
      if (await confirmDialog('Match löschen?', 'Das Match wird endgültig aus der Statistik entfernt.', { okLabel: 'Löschen', danger: true })) {
        await ctx.repo.deleteMatch(m.id);
        toast('Match gelöscht');
        ctx.navigate('#/historie');
      }
    },
  }, 'Match löschen'));
}
