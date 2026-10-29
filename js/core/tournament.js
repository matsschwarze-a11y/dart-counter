// Turnier: K.-o.-System mit 8 Teilnehmern (du + 7 Bots), Bot-Stärken rund um deinen Average.
// Reine Logik ohne DOM; Bot-gegen-Bot-Matches werden über eine übergebene Funktion simuliert.
import { gaussian } from './rng.js';
import { newId } from './match.js';
import { MIN_AVERAGE, MAX_AVERAGE } from '../bot/calibration-table.js';

export const TOURNAMENT_SIZE = 8;
export const ROUND_NAMES = ['Viertelfinale', 'Halbfinale', 'Finale'];
// First to … Legs je Runde (Viertel-, Halbfinale, Finale)
export const ROUND_LEGS = [3, 3, 4];
export const TOURNAMENT_SETTINGS = Object.freeze({ startScore: 501, outMode: 'double', doubleIn: false });

// Setzliste 1–8 → Paarungen 1–8, 4–5, 2–7, 3–6 (Favoriten treffen sich erst spät)
const SEED_ORDER = [0, 7, 3, 4, 1, 6, 2, 5];

const FIRST = ['Jonas', 'Lukas', 'Tim', 'Felix', 'Max', 'Paul', 'Leon', 'Jan', 'Niklas', 'Tobias', 'Florian', 'Sebastian', 'Kevin', 'Dennis', 'Marco', 'Sven',
  'Stefan', 'Andreas', 'Thomas', 'Michael', 'Daniel', 'Patrick', 'Christian', 'Markus', 'Sarah', 'Julia', 'Lisa', 'Anna', 'Laura', 'Nina', 'Katrin', 'Sandra'];
const LAST = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf',
  'Neumann', 'Schwarz', 'Braun', 'Zimmermann', 'Krüger', 'Hartmann', 'Lange', 'Werner', 'Krause', 'Lehmann', 'Köhler', 'Herrmann', 'Walter', 'König'];

/**
 * Bot-Averages für ein realistisches Teilnehmerfeld rund um `myAverage`:
 * gleichmäßig über eine Normalverteilung (σ = 10 % des Averages, mind. 3) verteilt, leicht zufällig verschoben,
 * höchstens 2 σ entfernt und im Bereich 25–100.
 */
export function botAverages(myAverage, rand, count = TOURNAMENT_SIZE - 1) {
  const sd = Math.max(3, myAverage * 0.1);
  const lo = Math.max(MIN_AVERAGE, myAverage - 2 * sd);
  const hi = Math.min(MAX_AVERAGE, myAverage + 2 * sd);
  const out = [];
  for (let i = 0; i < count; i++) {
    const z = normalQuantile((i + 0.5) / count) + gaussian(rand) * 0.25;
    out.push(Math.round(Math.min(hi, Math.max(lo, myAverage + z * sd))));
  }
  return out;
}

// Quantil der Standardnormalverteilung (Näherung nach Acklam, für 0 < p < 1 ausreichend genau).
function normalQuantile(p) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const q = Math.min(p, 1 - p);
  let x;
  if (q < 0.02425) {
    const t = Math.sqrt(-2 * Math.log(q));
    x = (((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) / ((((d[0] * t + d[1]) * t + d[2]) * t + d[3]) * t + 1);
  } else {
    const t = q - 0.5;
    const r = t * t;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * t) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    return p < 0.5 ? x : -x;
  }
  return p < 0.5 ? -x : x;
}

function botNames(rand, count) {
  const names = new Set();
  while (names.size < count) {
    names.add(`${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`);
  }
  return [...names];
}

/** Neues Turnier. me: {playerId, name}. */
export function createTournament({ me, myAverage, rand, id = newId(), now = Date.now() }) {
  const avgs = botAverages(myAverage, rand);
  const names = botNames(rand, avgs.length);
  const entrants = [
    { id: 'me', name: me.name, playerId: me.playerId, isBot: false, average: myAverage },
    ...avgs.map((a, i) => ({ id: `b${i}`, name: names[i], playerId: null, isBot: true, botAverage: a, average: a, revealed: false })),
  ];
  // Setzliste nach Stärke; bei Gleichstand entscheidet der Zufall
  const seeded = entrants.map((e) => ({ e, r: rand() })).sort((x, y) => y.e.average - x.e.average || x.r - y.r).map((x) => x.e.id);
  const order = SEED_ORDER.map((s) => seeded[s]);
  const first = [];
  for (let i = 0; i < order.length; i += 2) first.push({ a: order[i], b: order[i + 1], winner: null, legs: null, averages: null, matchId: null });
  return {
    id,
    createdAt: now,
    finishedAt: null,
    status: 'running', // running | finished | aborted
    myAverage,
    entrants,
    rounds: [first],
  };
}

export const entrant = (t, id) => t.entrants.find((e) => e.id === id);

/** Mein offenes Spiel (oder null, wenn ausgeschieden bzw. fertig). */
export function myPendingGame(t) {
  if (t.status !== 'running') return null;
  const ri = t.rounds.length - 1;
  const gi = t.rounds[ri].findIndex((g) => (g.a === 'me' || g.b === 'me') && !g.winner);
  return gi < 0 ? null : { round: ri, game: gi, g: t.rounds[ri][gi] };
}

/** Bin ich noch im Turnier? */
export function stillIn(t) {
  const last = t.rounds[t.rounds.length - 1];
  return last.some((g) => (g.a === 'me' || g.b === 'me') && (!g.winner || g.winner === 'me'));
}

/**
 * Ergebnis meines Spiels eintragen, übrige Spiele der Runde simulieren und weiterschalten.
 * simulate(entrantA, entrantB, legsToWin) → {winner: 'a'|'b', legs: [x, y], averages: [x, y]}
 * Bin ich raus, wird der Rest des Turniers sofort durchsimuliert.
 */
export function recordMyResult(t, { round, game }, { won, legs, averages, matchId }, simulate, now = Date.now()) {
  const g = t.rounds[round][game];
  const meIsA = g.a === 'me';
  g.winner = won ? 'me' : meIsA ? g.b : g.a;
  g.legs = meIsA ? legs : [legs[1], legs[0]];
  g.averages = meIsA ? averages : [averages[1], averages[0]];
  g.matchId = matchId;
  entrant(t, meIsA ? g.b : g.a).revealed = true;
  advance(t, simulate, now);
  return t;
}

function advance(t, simulate, now) {
  for (;;) {
    const ri = t.rounds.length - 1;
    const round = t.rounds[ri];
    for (const g of round) {
      if (g.winner || g.a === 'me' || g.b === 'me') continue;
      const r = simulate(entrant(t, g.a), entrant(t, g.b), ROUND_LEGS[ri]);
      g.winner = r.winner === 'a' ? g.a : g.b;
      g.legs = r.legs;
      g.averages = r.averages;
    }
    if (round.some((g) => !g.winner)) return; // mein Spiel steht noch aus
    if (round.length === 1) {
      t.status = 'finished';
      t.finishedAt = now;
      for (const e of t.entrants) if (e.isBot) e.revealed = true;
      return;
    }
    const next = [];
    for (let i = 0; i < round.length; i += 2) next.push({ a: round[i].winner, b: round[i + 1].winner, winner: null, legs: null, averages: null, matchId: null });
    t.rounds.push(next);
  }
}

/** Platzierung zum Turnierende: 'Sieger', 'Finale', 'Halbfinale', 'Viertelfinale'. */
export function myPlacement(t) {
  const final = t.rounds[2]?.[0];
  if (final?.winner === 'me') return 'Turniersieg';
  for (let ri = t.rounds.length - 1; ri >= 0; ri--) {
    const g = t.rounds[ri].find((x) => x.a === 'me' || x.b === 'me');
    if (g && g.winner && g.winner !== 'me') return `Aus im ${ROUND_NAMES[ri]}`;
  }
  return null;
}
