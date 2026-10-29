// Statistiken – immer aus den Rohdaten (Matches mit Legs/Aufnahmen/Darts) berechnet.

export const PERIODS = { '7': 7, '30': 30, '365': 365, all: null };
const DAY = 86400000;

/** Teilnehmer-Index eines Profils im Match (oder -1). */
export function participantIndex(match, playerId) {
  return match.participants.findIndex((p) => p.playerId === playerId);
}

/** Passt ein Gegner zum Filter? opponent: 'all' | '<playerId>' | 'bot:<band>' (z. B. bot:60 = Bots 60–69) */
function opponentMatches(match, p, opponent) {
  if (!opponent || opponent === 'all') return true;
  const others = match.participants.filter((_, i) => i !== p);
  if (opponent.startsWith('bot:')) {
    const band = Number(opponent.slice(4));
    return others.some((o) => o.isBot && o.botAverage >= band && o.botAverage < band + 10);
  }
  return others.some((o) => o.playerId === opponent);
}

/** Abgeschlossene Matches eines Spielers, gefiltert. */
export function filterMatches(matches, playerId, { period = 'all', opponent = 'all', startScore = 'all', now = Date.now() } = {}) {
  const days = PERIODS[period] ?? null;
  return matches.filter((m) => {
    if (m.status !== 'finished') return false;
    const p = participantIndex(m, playerId);
    if (p < 0) return false;
    if (days && m.createdAt < now - days * DAY) return false;
    if (startScore !== 'all' && m.settings.startScore !== Number(startScore)) return false;
    return opponentMatches(m, p, opponent);
  });
}

/** Ziel-Doppel eines Doppelversuchs (Label) aus dem Rest. */
export function doubleTarget(rest) {
  if (rest === 50) return 'BULL';
  if (rest >= 2 && rest <= 40 && rest % 2 === 0) return 'D' + rest / 2;
  return null;
}

function emptyTotals() {
  return {
    points: 0, darts: 0, f9Points: 0, f9Darts: 0,
    attempts: 0, checkouts: 0, bestFinish: 0,
    c60: 0, c100: 0, c140: 0, c180: 0, visits: 0,
    bestLeg: null, legsPlayed: 0, legsWon: 0, matches: 0, matchesWon: 0,
    doubles: {},
  };
}

/** Kennzahlen eines Teilnehmers p in einem Match zu `t` addieren. */
function addMatch(t, m, p) {
  t.matches++;
  if (m.winnerIndex === p) t.matchesWon++;
  for (const leg of m.legs) {
    if (!leg.visits.length) continue;
    t.legsPlayed++;
    let legDarts = 0;
    let k = 0;
    for (const v of leg.visits) {
      if (v.p !== p) continue;
      t.points += v.score;
      t.darts += v.darts.length;
      legDarts += v.darts.length;
      if (k < 3) {
        t.f9Points += v.score;
        t.f9Darts += v.darts.length;
      }
      k++;
      t.visits++;
      if (v.score >= 60) t.c60++;
      if (v.score >= 100) t.c100++;
      if (v.score >= 140) t.c140++;
      if (v.score === 180) t.c180++;
      if (v.checkout) {
        t.checkouts++;
        t.bestFinish = Math.max(t.bestFinish, v.score);
      }
      for (const d of v.darts) {
        if (!d.doubleAttempt) continue;
        t.attempts++;
        const target = doubleTarget(d.remBefore) || 'andere';
        const e = (t.doubles[target] ||= { attempts: 0, hits: 0 });
        e.attempts++;
        if (d.checkout) e.hits++;
      }
    }
    if (leg.winnerIndex === p) {
      t.legsWon++;
      if (t.bestLeg === null || legDarts < t.bestLeg) t.bestLeg = legDarts;
    }
  }
}

function finalize(t) {
  return {
    ...t,
    average: t.darts ? (t.points / t.darts) * 3 : null,
    first9: t.f9Darts ? (t.f9Points / t.f9Darts) * 3 : null,
    checkoutRate: t.attempts ? t.checkouts / t.attempts : null,
    matchWinRate: t.matches ? t.matchesWon / t.matches : null,
    legWinRate: t.legsPlayed ? t.legsWon / t.legsPlayed : null,
  };
}

/** Gesamtstatistik eines Spielers über die gefilterten Matches. */
export function playerStats(matches, playerId, filter = {}) {
  const ms = filterMatches(matches, playerId, filter);
  const t = emptyTotals();
  for (const m of ms) addMatch(t, m, participantIndex(m, playerId));
  return finalize(t);
}

/** Kennzahlen eines Teilnehmers in einem einzelnen Match. */
export function matchPlayerStats(match, p) {
  const t = emptyTotals();
  addMatch(t, match, p);
  return finalize(t);
}

/** Verlauf: Average je Match, chronologisch. */
export function averageHistory(matches, playerId, filter = {}) {
  return filterMatches(matches, playerId, filter)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((m) => ({ date: m.createdAt, average: matchPlayerStats(m, participantIndex(m, playerId)).average, matchId: m.id }))
    .filter((x) => x.average !== null);
}

/** Doppelquote je Doppelfeld, sortiert nach Versuchen. */
export function doubleTable(stats) {
  return Object.entries(stats.doubles)
    .map(([field, { attempts, hits }]) => ({ field, attempts, hits, rate: attempts ? hits / attempts : 0 }))
    .sort((a, b) => b.attempts - a.attempts);
}

/** Head-to-Head zweier Profile (nur Matches, in denen beide spielten). */
export function headToHead(matches, idA, idB, filter = {}) {
  const ms = filterMatches(matches, idA, { ...filter, opponent: 'all' }).filter((m) => participantIndex(m, idB) >= 0);
  const a = emptyTotals();
  const b = emptyTotals();
  for (const m of ms) {
    addMatch(a, m, participantIndex(m, idA));
    addMatch(b, m, participantIndex(m, idB));
  }
  return { matches: ms.length, a: finalize(a), b: finalize(b) };
}

/** Kurzübersicht für die Historie: Legs je Teilnehmer, Averages. */
export function matchSummary(match) {
  const n = match.participants.length;
  const legsWon = Array(n).fill(0);
  for (const leg of match.legs) if (leg.winnerIndex !== null && leg.winnerIndex !== undefined) legsWon[leg.winnerIndex]++;
  const averages = match.participants.map((_, p) => matchPlayerStats(match, p).average);
  return { legsWon, averages };
}

// ---------- Wurfbild ----------

/** Alle Darts eines Spielers mit Position in der Aufnahme (0–2), gefiltert. */
function playerDarts(matches, playerId, filter) {
  const out = [];
  for (const m of filterMatches(matches, playerId, filter)) {
    const p = participantIndex(m, playerId);
    for (const leg of m.legs) {
      for (const v of leg.visits) {
        if (v.p !== p) continue;
        v.darts.forEach((d, k) => out.push({ d, k }));
      }
    }
  }
  return out;
}

/** Feldschlüssel für das Wurfbild: "20|3", "25|2", "0|1". */
export const fieldKey = (d) => `${d.seg}|${d.seg === 0 ? 1 : d.mult}`;

/**
 * Trefferverteilung auf der Scheibe. dartNo: 'all' | 1 | 2 | 3 (Position in der Aufnahme).
 * Liefert {total, counts: {fieldKey: n}}.
 */
export function throwPattern(matches, playerId, filter = {}, dartNo = 'all') {
  const counts = {};
  let total = 0;
  for (const { d, k } of playerDarts(matches, playerId, filter)) {
    if (dartNo !== 'all' && k !== dartNo - 1) continue;
    const key = fieldKey(d);
    counts[key] = (counts[key] || 0) + 1;
    total++;
  }
  return { total, counts };
}

// Zielbereiche fürs Punkten: Zahl in der Mitte, Nachbarn links/rechts (Blick auf die Scheibe).
export const SCORING_GROUPS = Object.freeze({ 20: { left: 5, right: 1 }, 19: { left: 7, right: 3 } });
const SCORING_MIN_REST = 100; // darunter wird meist gestellt oder ausgecheckt

/**
 * Streutendenz beim Punkten: Darts mit Rest ≥ 100, die im 20er- bzw. 19er-Bereich landen.
 * Horizontal: links/Mitte/rechts; vertikal: Triple (auf der Linie), Single, Double (zu weit außen).
 * Zusätzlich je Dart-Position (1–3) die Triple-Quote im jeweiligen Bereich.
 */
export function scatterTendency(matches, playerId, filter = {}) {
  const groups = {};
  for (const n of Object.keys(SCORING_GROUPS)) {
    groups[n] = { n: 0, left: 0, center: 0, right: 0, triple: 0, single: 0, double: 0, byDart: [0, 1, 2].map(() => ({ n: 0, triple: 0 })) };
  }
  let scoring = 0;
  let outside = 0;
  for (const { d, k } of playerDarts(matches, playerId, filter)) {
    if (!(d.remBefore >= SCORING_MIN_REST)) continue;
    scoring++;
    const entry = Object.entries(SCORING_GROUPS).find(([n, g]) => d.seg === Number(n) || d.seg === g.left || d.seg === g.right);
    if (!entry) {
      outside++;
      continue;
    }
    const [n, g] = entry;
    const t = groups[n];
    t.n++;
    if (d.seg === g.left) t.left++;
    else if (d.seg === g.right) t.right++;
    else t.center++;
    if (d.mult === 3) t.triple++;
    else if (d.mult === 2) t.double++;
    else t.single++;
    t.byDart[k].n++;
    if (d.seg === Number(n) && d.mult === 3) t.byDart[k].triple++;
  }
  return { scoring, outside, groups };
}
