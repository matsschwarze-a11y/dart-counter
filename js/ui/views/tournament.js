// Turnier: Einrichtung, Turnierbaum, eigene Spiele starten und auswerten.
import { h, clear, fmt, askText, confirmDialog, toast, dateTime } from '../dom.js';
import { createMatch, playerTotals } from '../../core/match.js';
import {
  createTournament, myPendingGame, recordMyResult, myPlacement, entrant, stillIn,
  ROUND_NAMES, ROUND_LEGS, TOURNAMENT_SETTINGS,
} from '../../core/tournament.js';
import { simulateBotMatch } from '../../bot/sim-match.js';
import { MIN_AVERAGE, MAX_AVERAGE } from '../../bot/calibration-table.js';
import { playerStats } from '../../stats/stats.js';

const simulate = (a, b, legs) => simulateBotMatch(a, b, legs, TOURNAMENT_SETTINGS);

export async function renderTournament(root, ctx) {
  ctx.setTitle('Turnier');
  const { repo } = ctx;
  const page = h('div', { class: 'page tournament' });
  root.append(page);

  let t = await repo.getRunningTournament();
  let news = null; // Ergebnis meines gerade beendeten Spiels
  if (t) news = await syncMyGame(t);
  if (t) renderRunning(t, news);
  else await renderSetup();

  // Eigenes Spiel beendet? → Ergebnis eintragen, Runde zu Ende simulieren.
  async function syncMyGame(tour) {
    const pg = myPendingGame(tour);
    if (!pg?.g.matchId) return null;
    const m = await repo.getMatch(pg.g.matchId);
    if (!m || m.status === 'aborted') {
      pg.g.matchId = null;
      await repo.saveTournament(tour);
      return null;
    }
    if (m.status !== 'finished') return null;
    const legs = [0, 1].map((p) => m.legs.filter((l) => l.winnerIndex === p).length);
    const averages = [0, 1].map((p) => playerTotals(m.legs, p).average);
    const oppId = pg.g.a === 'me' ? pg.g.b : pg.g.a;
    recordMyResult(tour, pg, { won: m.winnerIndex === 0, legs, averages, matchId: m.id }, simulate);
    await repo.saveTournament(tour);
    return { round: pg.round, won: m.winnerIndex === 0, legs, averages, opp: entrant(tour, oppId) };
  }

  async function renderSetup() {
    clear(page);
    let players = (await repo.listPlayers()).filter((p) => !p.isBot);
    const matches = await repo.listMatches();
    const last = await repo.getMeta('lastTournamentSetup', {});
    let playerId = players.some((p) => p.id === last.playerId) ? last.playerId : players[0]?.id || null;

    const suggested = (id) => {
      if (!id) return 50;
      const recent = playerStats(matches, id, { period: '30', startScore: '501' }).average;
      const all = playerStats(matches, id, { startScore: '501' }).average;
      const a = recent ?? all;
      return a ? Math.round(Math.min(MAX_AVERAGE, Math.max(MIN_AVERAGE, a))) : 50;
    };
    let avg = last.playerId === playerId && last.average ? last.average : suggested(playerId);

    const avgOut = h('output', { class: 'bot-avg' }, String(avg));
    const range = h('input', { type: 'range', min: MIN_AVERAGE, max: MAX_AVERAGE, step: 1, value: avg, 'aria-label': 'Dein Average' });
    range.addEventListener('input', () => {
      avg = Number(range.value);
      avgOut.textContent = range.value;
    });
    const hint = h('p', { class: 'muted small' });
    const updateHint = () => {
      const s = playerId ? playerStats(matches, playerId, { period: '30', startScore: '501' }).average : null;
      hint.textContent = s ? `Dein 501-Average der letzten 30 Tage: ${fmt(s)}` : 'Noch keine 501-Statistik – stell deinen Average selbst ein.';
    };
    updateHint();

    const select = h('select', { class: 'select', 'aria-label': 'Spieler' },
      players.map((p) => h('option', { value: p.id, selected: p.id === playerId }, p.name)),
      h('option', { value: '__new' }, '+ Neuer Spieler …'));
    select.addEventListener('change', async () => {
      if (select.value === '__new') {
        const name = await askText('Neuer Spieler', '', { placeholder: 'Name' });
        if (name) {
          const p = await repo.createPlayer({ name });
          players = (await repo.listPlayers()).filter((x) => !x.isBot);
          playerId = p.id;
        }
        renderSetupAgain();
        return;
      }
      playerId = select.value;
      avg = suggested(playerId);
      range.value = avg;
      avgOut.textContent = String(avg);
      updateHint();
    });
    const renderSetupAgain = () => {
      repo.setMeta('lastTournamentSetup', { playerId, average: avg }).then(renderSetup);
    };

    page.append(
      h('section', { class: 'card' },
        h('h2', {}, 'Neues Turnier'),
        h('p', { class: 'muted small' }, '8 Teilnehmer im K.-o.-System: du und 7 Gegner, die ungefähr so stark sind wie du. Wie stark ein Gegner genau ist, erfährst du erst nach eurem Spiel.'),
        h('div', { class: 'field' }, h('span', {}, 'Spieler'), players.length ? select : h('button', { class: 'btn', onClick: async () => {
          const name = await askText('Neuer Spieler', '', { placeholder: 'Name' });
          if (name) {
            const p = await repo.createPlayer({ name });
            playerId = p.id;
            renderSetupAgain();
          }
        } }, '+ Spieler anlegen')),
        h('div', { class: 'field' }, h('span', {}, 'Dein Average'), h('div', { class: 'bot-row' }, range, avgOut)),
        hint,
        h('table', { class: 'table' },
          h('tr', {}, h('th', {}, 'Runde'), h('th', {}, 'Format')),
          ROUND_NAMES.map((n, i) => h('tr', {}, h('td', {}, n), h('td', {}, `First to ${ROUND_LEGS[i]} Legs`)))),
        h('p', { class: 'muted small' }, '501 · Double-out. Der Anwurf wird jeweils ausgelost.')),
      h('div', { class: 'sticky-actions' },
        h('button', { class: 'btn primary big block', disabled: !playerId, onClick: start }, 'Turnier starten')));

    const done = (await repo.listTournaments()).filter((x) => x.status === 'finished').slice(0, 5);
    if (done.length) {
      page.append(h('section', { class: 'card' },
        h('h2', {}, 'Letzte Turniere'),
        done.map((x) => h('div', { class: 'row between' },
          h('span', {}, `${dateTime(x.createdAt)} · ${entrant(x, 'me').name} (Ø ${x.myAverage})`),
          h('span', { class: 'muted' }, myPlacement(x) || '')))));
    }

    async function start() {
      const me = players.find((p) => p.id === playerId);
      if (!me) return toast('Bitte einen Spieler wählen');
      await repo.setMeta('lastTournamentSetup', { playerId, average: avg });
      t = createTournament({ me: { playerId: me.id, name: me.name }, myAverage: avg, rand: Math.random });
      await repo.saveTournament(t);
      renderRunning(t, null);
    }
  }

  function renderRunning(tour, result) {
    clear(page);
    const pg = myPendingGame(tour);

    if (result) {
      const opp = result.opp;
      page.append(h('section', { class: 'card reveal' },
        h('div', { class: 'ov-title' }, result.won ? `Sieg im ${ROUND_NAMES[result.round]}!` : `Aus im ${ROUND_NAMES[result.round]}`),
        h('div', {}, `${result.legs[0]} : ${result.legs[1]} gegen ${opp.name}`),
        h('div', { class: 'reveal-avg' }, `${opp.name} spielte mit Ziel-Average `, h('b', {}, String(opp.botAverage))),
        h('div', { class: 'muted small' }, `Gespielt: du Ø ${fmt(result.averages[0])} · ${opp.name} Ø ${fmt(result.averages[1])}`)));
    }

    if (tour.status === 'finished') {
      const champ = entrant(tour, tour.rounds[2][0].winner);
      page.append(h('section', { class: 'card' },
        h('div', { class: 'ov-title' }, champ.id === 'me' ? '🏆 Turniersieg!' : `🏆 ${champ.name} gewinnt das Turnier`),
        h('div', { class: 'muted' }, myPlacement(tour) || '')));
    } else if (pg) {
      const oppId = pg.g.a === 'me' ? pg.g.b : pg.g.a;
      const opp = entrant(tour, oppId);
      page.append(h('section', { class: 'card next-game' },
        h('div', { class: 'muted small' }, `${ROUND_NAMES[pg.round]} · First to ${ROUND_LEGS[pg.round]} Legs · 501 Double-out`),
        h('div', { class: 'ov-title' }, `Du gegen ${opp.name}`),
        h('button', { class: 'btn primary big block', onClick: () => startMyMatch(tour, pg) }, pg.g.matchId ? 'Spiel fortsetzen' : 'Spiel starten')));
    }

    page.append(bracket(tour));

    page.append(tour.status === 'finished'
      ? h('button', { class: 'btn primary big block', onClick: () => { t = null; renderSetup(); } }, 'Neues Turnier')
      : h('button', {
        class: 'btn danger block',
        onClick: async () => {
          if (!(await confirmDialog('Turnier aufgeben?', 'Das Turnier wird beendet. Bereits gespielte Matches bleiben in der Statistik.', { okLabel: 'Aufgeben', danger: true }))) return;
          const running = myPendingGame(tour)?.g.matchId;
          if (running) await repo.abortMatch(running);
          tour.status = 'aborted';
          await repo.saveTournament(tour);
          t = null;
          renderSetup();
        },
      }, 'Turnier aufgeben'));
  }

  function bracket(tour) {
    const box = h('section', { class: 'card bracket' }, h('h2', {}, 'Turnierbaum'));
    tour.rounds.forEach((round, ri) => {
      box.append(h('h3', {}, ROUND_NAMES[ri]));
      for (const g of round) {
        const mine = g.a === 'me' || g.b === 'me';
        box.append(h('div', { class: 'bgame' + (mine ? ' mine' : '') },
          [g.a, g.b].map((id, k) => {
            const e = entrant(tour, id);
            return h('div', { class: 'row between bline' + (g.winner === id ? ' winner' : '') },
              h('span', {}, e.name, e.isBot && e.revealed ? h('span', { class: 'muted small' }, ` · Ziel-Ø ${e.botAverage}`) : null),
              h('span', { class: 'mono' }, g.legs ? String(g.legs[k]) : ''));
          })));
      }
    });
    if (stillIn(tour) && tour.status === 'running') {
      box.append(h('p', { class: 'muted small' }, 'Die Stärke deiner Gegner wird nach jedem eurer Spiele aufgedeckt, die aller übrigen am Turnierende.'));
    }
    return box;
  }

  async function startMyMatch(tour, pg) {
    if (pg.g.matchId) {
      const m = await repo.getMatch(pg.g.matchId);
      if (m?.status === 'running') return ctx.navigate('#/spiel');
    }
    const running = await repo.getRunningMatch();
    if (running) {
      if (!(await confirmDialog('Laufendes Match abbrechen?', `${running.participants.map((p) => p.name).join(' vs. ')} wird abgebrochen.`, { okLabel: 'Abbrechen und starten', danger: true }))) return;
      await repo.abortMatch(running.id);
    }
    const me = entrant(tour, 'me');
    const opp = entrant(tour, pg.g.a === 'me' ? pg.g.b : pg.g.a);
    const match = createMatch({
      settings: { ...TOURNAMENT_SETTINGS, format: { type: 'firstTo', legs: ROUND_LEGS[pg.round], sets: 0 }, startPlayer: Math.random() < 0.5 ? 0 : 1 },
      participants: [
        { playerId: me.playerId, name: me.name, isBot: false },
        { playerId: null, name: opp.name, isBot: true, botAverage: opp.botAverage },
      ],
    });
    match.tournament = { id: tour.id, round: pg.round, roundName: ROUND_NAMES[pg.round] };
    await repo.saveMatch(match);
    pg.g.matchId = match.id;
    await repo.saveTournament(tour);
    ctx.navigate('#/spiel');
  }
}

