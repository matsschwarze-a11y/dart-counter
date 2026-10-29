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
