// Spielbildschirm: Anzeige oben, Eingabe im unteren Drittel, Bot-Ablauf.
import { h, clear, fmt, modal, toast } from '../dom.js';
import { currentState, addDart, undo, editVisit, isLegEditable, playerTotals, createMatch } from '../../core/match.js';
import { dartLabel, dartPoints } from '../../core/board.js';
import { getCheckout } from '../../core/checkout.js';
import { maxCheckout } from '../../core/rules.js';
import { visibleChips } from '../../core/quick.js';
import { isBotTurn, nextBotDart } from '../../bot/bot-player.js';
import { matchPlayerStats } from '../../stats/stats.js';

const BOT_DELAY = 1000;
const OUT_LABEL = { double: 'Double-out', master: 'Master-out', straight: 'Straight-out' };

export async function renderGame(root, ctx) {
  const { repo } = ctx;
  let match = await repo.getRunningMatch();
  if (!match) {
    ctx.setTitle('Spiel');
    root.append(h('div', { class: 'page' },
      h('p', {}, 'Kein laufendes Match.'),
      h('a', { class: 'btn primary big block', href: '#/neu' }, 'Neues Match starten')));
    return;
  }

  let mult = 1;
  let paused = false;
  let botTimer = null;
  let overlay = null; // {type:'leg'|'match', ...}
  let destroyed = false;
  let saveChain = Promise.resolve();

  const s0 = match.settings;
  const fmtLabel = `${s0.format.type === 'bestOf' ? 'Best of' : 'First to'} ${s0.format.sets ? `${s0.format.sets} Sets · ` : ''}${s0.format.legs} Legs`;
  ctx.setTitle(`${s0.startScore} · ${OUT_LABEL[s0.outMode]}${s0.doubleIn ? ' · Double-in' : ''}`, {
    back: '#/',
    right: h('button', { class: 'btn small ghost', onClick: () => openHistorySheet() }, 'Verlauf'),
  });

  const game = h('div', { class: 'game' });
  root.append(game);

  // ---------- Wake Lock ----------
  let wakeLock = null;
  const lockScreen = async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible' && !destroyed) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch {
      /* nicht verfügbar */
    }
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') lockScreen();
  };
  document.addEventListener('visibilitychange', onVisible);
  lockScreen();

  // ---------- Speichern ----------
  function save() {
    const snapshot = structuredClone(match);
    saveChain = saveChain.then(() => repo.saveMatch(snapshot)).catch((e) => {
      console.error(e);
      toast('Speichern fehlgeschlagen');
    });
  }

  // ---------- Eingabe ----------
  function input(dart) {
    if (overlay || match.status !== 'running') return;
    const legsBefore = match.legs.length;
    const legIdx = legsBefore - 1;
    addDart(match, dart);
    mult = 1;
    save();
    if (match.status === 'finished') {
      overlay = { type: 'match' };
    } else if (match.legs.length > legsBefore) {
      overlay = { type: 'leg', legIndex: legIdx };
    }
    render();
  }

  function doUndo() {
    if (!match.inputs.length) return;
    stopBot();
    overlay = null;
    undo(match);
    mult = 1;
    if (isBotTurn(match)) paused = true;
    save();
    render();
  }

  // ---------- Bot ----------
  function stopBot() {
    clearTimeout(botTimer);
    botTimer = null;
  }

  function scheduleBot() {
    stopBot();
    if (destroyed || paused || overlay || !isBotTurn(match)) return;
    botTimer = setTimeout(() => {
      botTimer = null;
      if (destroyed || paused || overlay || !isBotTurn(match)) return;
      input(nextBotDart(match));
    }, BOT_DELAY);
  }

  function finishBotVisit() {
    stopBot();
    const st = currentState(match);
    const p = st.player;
    const legs = match.legs.length;
    let guard = 0;
    while (!overlay && isBotTurn(match) && guard++ < 3) {
      const now = currentState(match);
      if (now.player !== p || match.legs.length !== legs) break;
      input(nextBotDart(match));
    }
    paused = false;
    render();
  }

  // ---------- Darstellung ----------
  function render() {
    if (destroyed) return;
    const st = currentState(match);
    const n = match.participants.length;
    const botTurn = isBotTurn(match) && !overlay;
    clear(game);

    // Status
    const setInfo = s0.format.sets ? `Set ${st.set} · ` : '';
    game.append(h('div', { class: 'status-line' },
      h('span', {}, `${setInfo}Leg ${st.leg}`),
      h('span', { class: 'muted' }, fmtLabel)));

    // Spielerkarten
    const board = h('div', { class: `scoreboard n${n}` });
    match.participants.forEach((part, i) => {
      const tot = playerTotals(match.legs, i);
      const leg = match.legs[st.legIndex];
      const myVisits = leg ? leg.visits.filter((v) => v.p === i && (v.darts.length === 3 || v.bust || v.checkout)) : [];
      const lastVisit = myVisits[myVisits.length - 1];
      const active = i === st.player && !st.finished;
      board.append(h('div', { class: 'pcard' + (active ? ' active' : '') + (part.isBot ? ' bot' : '') },
        h('div', { class: 'pname' }, part.name, i === match.legs[st.legIndex]?.starter ? h('span', { class: 'starter', title: 'Anwurf' }, ' ●') : null),
        h('div', { class: 'prest' }, String(st.rests[i])),
        h('div', { class: 'pmeta' },
          h('span', {}, s0.format.sets ? `Sets ${st.setsWon[i]} · Legs ${st.legsInSet[i]}` : `Legs ${st.legsWonTotal[i]}`),
          h('span', {}, `Ø ${fmt(tot.average)}`)),
        h('div', { class: 'plast' }, lastVisit ? `Letzte: ${lastVisit.bust ? 'Bust' : lastVisit.score}` : ' ')));
    });
    game.append(board);

    // Aktuelle Aufnahme
    const vd = st.visitDarts;
    const visitSum = vd.reduce((s, d) => s + d.points, 0);
    const restNow = st.rests[st.player];
    game.append(h('div', { class: 'visit-line', 'aria-live': 'polite' },
      [0, 1, 2].map((k) => h('div', { class: 'vdart' + (vd[k] ? ' filled' : '') + (k === vd.length && !st.finished ? ' next' : '') }, vd[k] ? dartLabel(vd[k]) : '–')),
      h('div', { class: 'vsum' }, vd.length ? String(visitSum) : '')));

    // Letzte abgeschlossene Aufnahme (damit Bot-Darts sichtbar bleiben)
    const curLeg = match.legs[st.legIndex];
    const done = curLeg ? curLeg.visits.filter((v) => v.darts.length === 3 || v.bust || v.checkout) : [];
    const prev = done[done.length - 1];
    game.append(h('div', { class: 'last-line' }, prev && !vd.length
      ? `${match.participants[prev.p].name}: ${prev.darts.map(dartLabel).join(' · ')} = ${prev.bust ? 'Bust' : prev.score}`
      : ' '));

    // Checkout-Vorschlag
    let hasRoute = false;
    let co = ' ';
    if (!st.finished) {
      if (s0.doubleIn && !st.opened[st.player]) co = 'Double-in: zuerst ein Doppel';
      else if (restNow <= maxCheckout(s0.outMode, st.dartsLeft) || restNow <= 170) {
        const route = getCheckout(restNow, st.dartsLeft, s0.outMode);
        if (route) {
          co = route.join(' · ');
          hasRoute = true;
        }
        else if (restNow <= maxCheckout(s0.outMode, 3)) co = st.dartsLeft < 3 ? `Kein Finish mit ${st.dartsLeft} Dart${st.dartsLeft > 1 ? 's' : ''}` : 'Kein Finish möglich';
      }
    }
    game.append(h('div', { class: 'checkout' + (hasRoute ? ' has' : '') }, co));

    // Eingabebereich
    const pad = h('div', { class: 'pad' });
    game.append(pad);
    if (overlay) {
      pad.append(renderOverlay(st));
    } else if (botTurn) {
      const name = match.participants[st.player].name;
      pad.append(h('div', { class: 'bot-panel' },
        h('div', { class: 'bot-status' }, paused ? `${name} pausiert` : `${name} wirft …`),
        h('div', { class: 'row gap' },
          h('button', { class: 'btn big grow', onClick: () => { paused = !paused; render(); } }, paused ? 'Weiter' : 'Pause'),
          h('button', { class: 'btn big grow', onClick: finishBotVisit }, 'Sofort beenden')),
        h('button', { class: 'btn big block', onClick: doUndo }, '↶ Rückgängig')));
    } else {
      buildPad(pad, st);
    }
    if (botTurn) scheduleBot();
    else stopBot();
  }

  function buildPad(pad, st) {
    const chips = visibleChips(st.rests[st.player], st.opened[st.player], s0, st.visitDarts.length);
    if (chips.length) {
      pad.append(h('div', { class: 'chips', role: 'group', 'aria-label': 'Schnellwahl' },
        chips.map((c) => h('button', {
          class: 'chip',
          title: c.darts.map(dartLabel).join(' '),
          onClick: () => {
            for (const d of c.darts) {
              if (overlay || match.status !== 'running') break;
              input(d);
            }
          },
        }, String(c.score)))));
    } else {
      pad.append(h('div', { class: 'chips empty' }));
    }
    pad.append(multiplierRow());
    const grid = h('div', { class: 'numgrid' });
    for (let n = 1; n <= 20; n++) {
      grid.append(h('button', { class: 'num', onClick: () => input({ seg: n, mult }) }, String(n)));
    }
    pad.append(grid);
    pad.append(h('div', { class: 'specials' },
      h('button', { class: 'num special', onClick: () => input({ seg: 25, mult: 1 }) }, '25'),
      h('button', { class: 'num special', onClick: () => input({ seg: 25, mult: 2 }) }, 'BULL'),
      h('button', { class: 'num special miss', onClick: () => input({ seg: 0, mult: 1 }) }, '0'),
      h('button', { class: 'num special undo', 'aria-label': 'Rückgängig', disabled: !match.inputs.length, onClick: doUndo }, '↶')));
  }

  function multiplierRow() {
    const row = h('div', { class: 'mults', role: 'radiogroup', 'aria-label': 'Multiplikator' });
    for (const [m, label] of [[1, 'Single'], [2, 'Double'], [3, 'Triple']]) {
      row.append(h('button', {
        class: 'mult' + (mult === m ? ' active' : '') + ` m${m}`,
        role: 'radio',
        'aria-checked': String(mult === m),
        onClick: () => {
          mult = mult === m ? 1 : m;
          for (const b of row.children) b.classList.toggle('active', b.classList.contains(`m${mult}`));
        },
      }, label));
    }
    return row;
  }

  function renderOverlay() {
    if (overlay.type === 'leg') {
      const leg = match.legs[overlay.legIndex];
      const w = leg.winnerIndex;
      const darts = leg.visits.filter((v) => v.p === w).reduce((s, v) => s + v.darts.length, 0);
      const legAvg = playerTotals([leg], w).average;
      const lastV = leg.visits[leg.visits.length - 1];
      return h('div', { class: 'overlay-panel' },
        h('div', { class: 'ov-title' }, `Leg an ${match.participants[w].name}`),
        h('div', { class: 'ov-sub' }, `${darts} Darts · Ø ${fmt(legAvg)} · Finish ${lastV.score}`),
        h('button', { class: 'btn primary big block', onClick: () => { overlay = null; paused = false; render(); } }, 'Nächstes Leg'),
        h('button', { class: 'btn big block', onClick: doUndo }, '↶ Rückgängig'));
    }
    const w = match.winnerIndex;
    return h('div', { class: 'overlay-panel' },
      h('div', { class: 'ov-title' }, `🏆 ${match.participants[w].name} gewinnt`),
      h('table', { class: 'ov-table' },
        h('tr', {}, h('th', {}, ''), h('th', {}, 'Legs'), h('th', {}, 'Ø'), h('th', {}, 'Doppel')),
        match.participants.map((p, i) => {
          const s = matchPlayerStats(match, i);
          return h('tr', {}, h('td', {}, p.name), h('td', {}, String(s.legsWon)), h('td', {}, fmt(s.average)), h('td', {}, s.attempts ? `${s.checkouts}/${s.attempts}` : '–'));
        })),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn primary big grow', onClick: rematch }, 'Revanche'),
        h('a', { class: 'btn big grow', href: `#/historie/${match.id}` }, 'Details')),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn grow', onClick: doUndo }, '↶ Rückgängig'),
        h('a', { class: 'btn grow', href: '#/' }, 'Startseite')));
  }

  async function rematch() {
    const n = match.participants.length;
    const next = createMatch({
      settings: { ...structuredClone(match.settings), startPlayer: (match.settings.startPlayer + 1) % n },
      participants: match.participants,
    });
    await saveChain;
    await repo.saveMatch(next);
    match = next;
    overlay = null;
    paused = false;
    render();
  }

  // ---------- Verlauf & Bearbeiten ----------
  function openHistorySheet() {
    const legsToShow = [];
    const last = match.legs.length - 1;
    if (last >= 1 && isLegEditable(match, last - 1)) legsToShow.push(last - 1);
    legsToShow.push(last);
    const content = h('div', { class: 'history-sheet' });
    for (const li of legsToShow) {
      const leg = match.legs[li];
      content.append(h('h3', {}, `${s0.format.sets ? `Set ${leg.set} · ` : ''}Leg ${leg.leg}${leg.winnerIndex !== null ? ' (beendet)' : ''}`));
      if (!leg.visits.length) content.append(h('p', { class: 'muted' }, 'Noch keine Aufnahme.'));
      leg.visits.forEach((v, vi) => {
        const complete = v.darts.length === 3 || v.bust || v.checkout;
        content.append(h('div', { class: 'hrow' },
          h('span', { class: 'hname' }, match.participants[v.p].name),
          h('span', { class: 'hdarts' }, v.darts.map(dartLabel).join(' ')),
          h('span', { class: 'hscore' }, v.bust ? 'Bust' : String(v.score)),
          h('span', { class: 'hrest' }, String(v.endRest)),
          complete && isLegEditable(match, li)
            ? h('button', { class: 'btn small', onClick: (e) => { e.target.closest('.modal').querySelector('.btn.primary').click(); editDialog(li, vi); } }, 'Ändern')
            : h('span', {})));
      });
    }
    return modal({ title: 'Verlauf', content, buttons: [{ label: 'Schließen', value: null, primary: true }] });
  }

  async function editDialog(legIdx, visitIdx) {
    stopBot();
    const visit = match.legs[legIdx].visits[visitIdx];
    const darts = [];
    let m = 1;
    const display = h('div', { class: 'visit-line small' });
    const refresh = () => {
      clear(display);
      [0, 1, 2].forEach((k) => display.append(h('div', { class: 'vdart' + (darts[k] ? ' filled' : '') }, darts[k] ? dartLabel(darts[k]) : '–')));
      display.append(h('div', { class: 'vsum' }, String(darts.reduce((s, d) => s + dartPoints(d), 0))));
    };
    refresh();
    const add = (d) => {
      if (darts.length >= 3) return;
      darts.push(d);
      m = 1;
      for (const b of mults.children) b.classList.toggle('active', b.dataset.m === '1');
      refresh();
    };
    const mults = h('div', { class: 'mults' }, [[1, 'S'], [2, 'D'], [3, 'T']].map(([v, l]) => h('button', {
      class: 'mult' + (v === 1 ? ' active' : ''),
      'data-m': String(v),
      onClick: (e) => {
        m = m === v ? 1 : v;
        for (const b of mults.children) b.classList.toggle('active', Number(b.dataset.m) === m);
        e.preventDefault();
      },
    }, l)));
    const grid = h('div', { class: 'numgrid compact' });
    for (let n = 1; n <= 20; n++) grid.append(h('button', { class: 'num', onClick: () => add({ seg: n, mult: m }) }, String(n)));
    const specials = h('div', { class: 'specials compact' },
      h('button', { class: 'num', onClick: () => add({ seg: 25, mult: 1 }) }, '25'),
      h('button', { class: 'num', onClick: () => add({ seg: 25, mult: 2 }) }, 'BULL'),
      h('button', { class: 'num', onClick: () => add({ seg: 0, mult: 1 }) }, '0'),
      h('button', { class: 'num', onClick: () => { darts.pop(); refresh(); } }, '⌫'));
    const content = h('div', { class: 'edit-visit' },
      h('p', { class: 'muted small' }, `${match.participants[visit.p].name}: bisher ${visit.darts.map(dartLabel).join(' ')} (${visit.bust ? 'Bust' : visit.score})`),
      display, mults, grid, specials);
    const ok = await modal({
      title: 'Aufnahme ändern',
      content,
      buttons: [{ label: 'Abbrechen', value: false }, { label: 'Übernehmen', value: true, primary: true }],
      dismissValue: false,
    });
    if (!ok || !darts.length) {
      render();
      return;
    }
    try {
      const wasFinished = match.status === 'finished';
      const { dropped, padded } = editVisit(match, legIdx, visitIdx, darts);
      overlay = null;
      if (match.status === 'finished' && !wasFinished) overlay = { type: 'match' };
      else if (match.legs.length - 1 > legIdx && match.legs[legIdx].winnerIndex !== null && match.legs[match.legs.length - 1].visits.length === 0) {
        overlay = { type: 'leg', legIndex: legIdx };
      }
      if (isBotTurn(match)) paused = true;
      save();
      if (dropped) toast(`Leg endet jetzt früher – ${dropped} spätere Aufnahme(n) verworfen`);
      else if (padded) toast(`${padded} fehlende Dart(s) als 0 ergänzt`);
      else toast('Aufnahme geändert');
    } catch (e) {
      toast(e.message);
    }
    render();
  }

  render();

  return () => {
    destroyed = true;
    stopBot();
    document.removeEventListener('visibilitychange', onVisible);
    wakeLock?.release?.().catch(() => {});
  };
}

