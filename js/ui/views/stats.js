import { h, clear, fmt, pct, segmented } from '../dom.js';
import { lineChart } from '../chart.js';
import { boardHeatmap } from '../board-svg.js';
import { dartLabel } from '../../core/board.js';
import { playerStats, averageHistory, doubleTable, headToHead, throwPattern, scatterTendency, SCORING_GROUPS } from '../../stats/stats.js';

export async function renderStats(root, ctx) {
  ctx.setTitle('Statistik');
  const { repo } = ctx;
  const [players, matches] = await Promise.all([repo.listPlayers({ includeDeleted: true }), repo.listMatches()]);
  const active = players.filter((p) => !p.deleted);
  const page = h('div', { class: 'page stats' });
  root.append(page);

  if (!active.length) {
    page.append(h('p', { class: 'muted' }, 'Noch keine Spieler. Lege unter „Spieler" ein Profil an und spiele ein Match.'));
    return;
  }

  const saved = (await repo.getMeta('statsFilter', null)) || {};
  const state = {
    playerId: active.some((p) => p.id === saved.playerId) ? saved.playerId : (active.find((p) => !p.isBot) || active[0]).id,
    period: saved.period || 'all',
    opponent: saved.opponent || 'all',
    startScore: saved.startScore || 'all',
    h2h: saved.h2h || '',
    dartNo: saved.dartNo || 'all',
  };
  const botBands = [...new Set(players.filter((p) => p.isBot).map((p) => Math.floor(p.botAverage / 10) * 10))].sort((a, b) => a - b);

  const sel = (label, key, options) => {
    const s = h('select', { class: 'select', 'aria-label': label }, options.map(([v, l]) => h('option', { value: v, selected: String(state[key]) === String(v) }, l)));
    s.addEventListener('change', () => {
      state[key] = s.value;
      repo.setMeta('statsFilter', state);
      render();
    });
    return h('label', { class: 'filter' }, h('span', {}, label), s);
  };

  const content = h('div');

  function render() {
    clear(page);
    const others = active.filter((p) => p.id !== state.playerId);
    page.append(h('section', { class: 'card filters' },
      sel('Spieler', 'playerId', active.map((p) => [p.id, p.name])),
      sel('Zeitraum', 'period', [['all', 'Gesamt'], ['7', '7 Tage'], ['30', '30 Tage'], ['365', '12 Monate']]),
      sel('Gegner', 'opponent', [['all', 'Alle'], ...others.map((p) => [p.id, p.name]), ...botBands.map((b) => [`bot:${b}`, `Bots ${b}–${b + 9}`])]),
      sel('Startscore', 'startScore', [['all', 'Alle'], ['301', '301'], ['501', '501']])));
    page.append(content);
    clear(content);

    const filter = { period: state.period, opponent: state.opponent, startScore: state.startScore };
    const s = playerStats(matches, state.playerId, filter);
    if (!s.matches) {
      content.append(h('p', { class: 'muted card' }, 'Keine abgeschlossenen Matches für diese Auswahl.'));
    } else {
      const tile = (label, value, sub) => h('div', { class: 'tile' }, h('div', { class: 'tile-value' }, value), h('div', { class: 'tile-label' }, label), sub ? h('div', { class: 'tile-sub' }, sub) : null);
      content.append(h('div', { class: 'tiles' },
        tile('3-Dart-Ø', fmt(s.average)),
        tile('First 9 Ø', fmt(s.first9)),
        tile('Checkout', pct(s.checkoutRate), `${s.checkouts}/${s.attempts}`),
        tile('Bestes Finish', s.bestFinish ? String(s.bestFinish) : '–'),
        tile('Bestes Leg', s.bestLeg ? `${s.bestLeg} Darts` : '–'),
        tile('Siege Matches', pct(s.matchWinRate, 0), `${s.matchesWon}/${s.matches}`),
        tile('Siege Legs', pct(s.legWinRate, 0), `${s.legsWon}/${s.legsPlayed}`),
        tile('60+', String(s.c60)),
        tile('100+', String(s.c100)),
        tile('140+', String(s.c140)),
        tile('180', String(s.c180)),
        tile('Darts', String(s.darts))));

      content.append(h('section', { class: 'card' },
        h('h2', {}, 'Average-Verlauf'),
        lineChart(averageHistory(matches, state.playerId, filter)),
        h('p', { class: 'muted small' }, 'Punkte: Average je Match · Linie hell: gleitender Durchschnitt über 5 Matches')));

      const dt = doubleTable(s);
      content.append(h('section', { class: 'card' },
        h('h2', {}, 'Doppelquote je Feld'),
        dt.length
          ? h('table', { class: 'table' },
            h('tr', {}, h('th', {}, 'Feld'), h('th', {}, 'Treffer'), h('th', {}, 'Versuche'), h('th', {}, 'Quote')),
            dt.map((d) => h('tr', {}, h('td', {}, d.field), h('td', {}, String(d.hits)), h('td', {}, String(d.attempts)), h('td', {}, pct(d.rate)))))
          : h('p', { class: 'muted' }, 'Noch keine Doppelversuche.')));

      content.append(throwPatternCard(filter));
      content.append(scatterCard(filter));
    }

    // Head-to-Head
    const h2hSel = h('select', { class: 'select', 'aria-label': 'Gegner für Head-to-Head' },
      h('option', { value: '' }, 'Gegner wählen …'),
      others.map((p) => h('option', { value: p.id, selected: state.h2h === p.id }, p.name)));
    h2hSel.addEventListener('change', () => {
      state.h2h = h2hSel.value;
      repo.setMeta('statsFilter', state);
      render();
    });
    const h2hBox = h('section', { class: 'card' }, h('h2', {}, 'Head-to-Head'), h2hSel);
    if (state.h2h && others.some((p) => p.id === state.h2h)) {
      const r = headToHead(matches, state.playerId, state.h2h, { period: state.period, startScore: state.startScore });
      const nameA = players.find((p) => p.id === state.playerId)?.name;
      const nameB = players.find((p) => p.id === state.h2h)?.name;
      const line = (label, a, b) => h('tr', {}, h('td', {}, a), h('th', {}, label), h('td', {}, b));
      h2hBox.append(r.matches
        ? h('table', { class: 'table h2h' },
          h('tr', {}, h('th', {}, nameA), h('th', {}, ''), h('th', {}, nameB)),
          line('Matches', String(r.a.matchesWon), String(r.b.matchesWon)),
          line('Legs', String(r.a.legsWon), String(r.b.legsWon)),
          line('Ø', fmt(r.a.average), fmt(r.b.average)),
          line('First 9', fmt(r.a.first9), fmt(r.b.first9)),
          line('Checkout', pct(r.a.checkoutRate), pct(r.b.checkoutRate)),
          line('180', String(r.a.c180), String(r.b.c180)))
        : h('p', { class: 'muted' }, 'Noch kein gemeinsames Match.'));
    }
    content.append(h2hBox);
    content.append(h('a', { class: 'btn block', href: '#/historie' }, 'Match-Historie'));
  }

  // Wurfbild: Heatmap auf der Scheibe, filterbar nach Dart 1/2/3 der Aufnahme
  function throwPatternCard(filter) {
    const box = h('div', { class: 'pattern' });
    const label = (key) => {
      const [seg, mult] = key.split('|').map(Number);
      return dartLabel({ seg, mult });
    };
    const draw = () => {
      clear(box);
      const tp = throwPattern(matches, state.playerId, filter, state.dartNo);
      if (!tp.total) {
        box.append(h('p', { class: 'muted' }, 'Noch keine Darts.'));
        return;
      }
      const top = Object.entries(tp.counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
      box.append(boardHeatmap(tp.counts, tp.total),
        h('div', { class: 'top-fields' }, top.map(([key, n]) => h('span', { class: 'top-field' }, h('b', {}, label(key)), ` ${pct(n / tp.total, 1)}`))),
        h('p', { class: 'muted small' }, `${tp.total} Darts · daneben (0): ${tp.counts['0|1'] || 0}. Single innen und außen werden gemeinsam gezählt.`));
    };
    draw();
    return h('section', { class: 'card' },
      h('h2', {}, 'Wurfbild'),
      segmented([{ value: 'all', label: 'Alle' }, { value: 1, label: '1. Dart' }, { value: 2, label: '2. Dart' }, { value: 3, label: '3. Dart' }], state.dartNo, (v) => {
        state.dartNo = v;
        repo.setMeta('statsFilter', state);
        draw();
      }, { name: 'Dart in der Aufnahme' }),
      box);
  }

  // Streutendenz beim Punkten (Rest ab 100) im 20er- und 19er-Bereich
  function scatterCard(filter) {
    const st = scatterTendency(matches, state.playerId, filter);
    const card = h('section', { class: 'card' }, h('h2', {}, 'Streutendenz beim Punkten'));
    if (!st.scoring) {
      card.append(h('p', { class: 'muted' }, 'Noch keine Darts bei Rest ab 100.'));
      return card;
    }
    const share = (x, n) => (n ? pct(x / n, 0) : '–');
    const row = (cells, tag = 'td') => h('tr', {}, cells.map((c) => h(tag, {}, c)));
    for (const [num, g] of Object.entries(SCORING_GROUPS)) {
      const t = st.groups[num];
      if (!t.n) continue;
      const lean = t.left - t.right;
      const hint = Math.abs(lean) < t.n * 0.05 ? 'Seitlich ausgeglichen.' : lean > 0 ? `Tendenz nach links (${g.left}).` : `Tendenz nach rechts (${g.right}).`;
      const t20 = t.byDart.reduce((s, b) => s + b.triple, 0);
      card.append(
        h('h3', {}, `${num}er-Bereich · ${t.n} Darts (${share(t.n, st.scoring)})`),
        h('table', { class: 'table compact' },
          row([`Links ${g.left}`, `Mitte ${num}`, `Rechts ${g.right}`], 'th'),
          row([share(t.left, t.n), share(t.center, t.n), share(t.right, t.n)])),
        h('table', { class: 'table compact' },
          row(['Triple', 'Single', 'Double (zu weit)'], 'th'),
          row([share(t.triple, t.n), share(t.single, t.n), share(t.double, t.n)])),
        h('table', { class: 'table compact' },
          row([`T${num}`, '1. Dart', '2. Dart', '3. Dart'], 'th'),
          row([share(t20, t.n), ...t.byDart.map((b) => share(b.triple, b.n))])),
        h('p', { class: 'muted small' }, hint));
    }
    card.append(h('p', { class: 'muted small' },
      `Ausgewertet werden Darts bei Rest ab 100, also beim Punkten. ${share(st.outside, st.scoring)} landeten außerhalb von 20er- und 19er-Bereich. Ob eine Single 20 über oder unter dem Triple lag, lässt sich aus der Eingabe nicht erkennen.`));
    return card;
  }

  render();
}
