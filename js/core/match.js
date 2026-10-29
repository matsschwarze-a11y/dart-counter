// Match-Engine. Quelle der Wahrheit ist `match.inputs` (Liste {seg, mult});
// Legs, Aufnahmen und abgeleitete Dart-Daten werden per Replay erzeugt.
import { applyDart } from './rules.js';

export const DEFAULT_SETTINGS = Object.freeze({
  startScore: 501,
  outMode: 'double',
  doubleIn: false,
  format: { type: 'firstTo', legs: 3, sets: 0 },
  startPlayer: 0,
});

/** Benötigte Siege für "first to n" bzw. "best of n". */
export function winsNeeded(type, n) {
  return type === 'bestOf' ? Math.floor(n / 2) + 1 : n;
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * @param {object} o
 * @param {object} o.settings
 * @param {Array<{playerId:string|null,name:string,isBot:boolean,botAverage:number|null}>} o.participants
 */
export function createMatch({ settings, participants, id = newId(), now = Date.now() }) {
  const s = { ...DEFAULT_SETTINGS, ...settings, format: { ...DEFAULT_SETTINGS.format, ...(settings?.format || {}) } };
  if (!participants?.length || participants.length > 4) throw new Error('1–4 Teilnehmer erforderlich');
  const match = {
    id,
    createdAt: now,
    finishedAt: null,
    status: 'running',
    settings: s,
    participants: participants.map((p) => ({
      playerId: p.playerId ?? null,
      name: p.name,
      isBot: !!p.isBot,
      botAverage: p.isBot ? p.botAverage : null,
    })),
    winnerIndex: null,
    inputs: [],
    legs: [],
  };
  return refresh(match, now);
}

/** Schrittweiser Replay-Motor. */
export class Engine {
  constructor(settings, playerCount) {
    this.s = settings;
    this.n = playerCount;
    const f = settings.format;
    this.legTarget = winsNeeded(f.type, f.legs);
    this.setTarget = f.sets ? winsNeeded(f.type, f.sets) : 0;
    this.legs = [];
    this.setsWon = Array(this.n).fill(0);
    this.legsInSet = Array(this.n).fill(0);
    this.legsWonTotal = Array(this.n).fill(0);
    this.setNo = 1;
    this.legNo = 1;
    this.globalLeg = 0;
    this.finished = false;
    this.winner = null;
    this.count = 0; // Anzahl verarbeiteter Inputs
    this.startLeg();
  }

  startLeg() {
    // Ohne Sets wechselt der Anwurf jedes Leg; mit Sets wechselt der Set-Anwurf
    // und innerhalb des Sets wieder jedes Leg.
    const starter = this.setTarget
      ? (this.s.startPlayer + (this.setNo - 1) + (this.legNo - 1)) % this.n
      : (this.s.startPlayer + this.globalLeg) % this.n;
    this.leg = { set: this.setNo, leg: this.legNo, starter, winnerIndex: null, visits: [] };
    this.legs.push(this.leg);
    this.rests = Array(this.n).fill(this.s.startScore);
    this.opened = Array(this.n).fill(!this.s.doubleIn);
    this.p = starter;
    this.visit = null;
  }

  /** Verarbeitet einen Dart. Gibt das abgeleitete Dart-Objekt zurück (oder null, wenn das Match vorbei ist). */
  push(input) {
    if (this.finished) return null;
    const p = this.p;
    if (!this.visit) {
      this.visit = { p, startRest: this.rests[p], endRest: this.rests[p], score: 0, bust: false, checkout: false, darts: [] };
      this.visitOpened = this.opened[p];
      this.leg.visits.push(this.visit);
    }
    const v = this.visit;
    const res = applyDart({ rest: this.rests[p], opened: this.opened[p] }, input, this.s);
    const dart = {
      seg: input.seg,
      mult: input.mult,
      points: res.points,
      remBefore: this.rests[p],
      doubleAttempt: res.doubleAttempt,
      bust: res.bust,
      checkout: res.checkout,
      i: this.count++,
    };
    v.darts.push(dart);
    if (res.bust) {
      v.bust = true;
      v.score = 0;
      this.rests[p] = v.startRest;
      this.opened[p] = this.visitOpened;
      v.endRest = v.startRest;
      this.endVisit();
      return dart;
    }
    this.rests[p] = res.rest;
    this.opened[p] = res.opened;
    v.score += res.points;
    v.endRest = res.rest;
    if (res.checkout) {
      v.checkout = true;
      this.winLeg(p);
    } else if (v.darts.length === 3) {
      this.endVisit();
    }
    return dart;
  }

  endVisit() {
    this.visit = null;
    this.p = (this.p + 1) % this.n;
  }

  winLeg(p) {
    this.leg.winnerIndex = p;
    this.visit = null;
    this.legsWonTotal[p]++;
    this.legsInSet[p]++;
    if (this.setTarget) {
      if (this.legsInSet[p] >= this.legTarget) {
        this.setsWon[p]++;
        this.legsInSet = Array(this.n).fill(0);
        if (this.setsWon[p] >= this.setTarget) return this.finish(p);
        this.setNo++;
        this.legNo = 1;
      } else this.legNo++;
    } else {
      if (this.legsWonTotal[p] >= this.legTarget) return this.finish(p);
      this.legNo++;
    }
    this.globalLeg++;
    this.startLeg();
  }

  finish(p) {
    this.finished = true;
    this.winner = p;
  }

  get legIndex() {
    return this.legs.length - 1;
  }
}

/** Kompletter Replay eines Matches → Engine im Endzustand. */
export function replay(match) {
  const e = new Engine(match.settings, match.participants.length);
  for (const d of match.inputs) if (!e.push(d)) break;
  return e;
}

/** Leitet legs/status/winnerIndex neu ab (mutiert match) und gibt es zurück. */
export function refresh(match, now = Date.now()) {
  const e = replay(match);
  if (e.count < match.inputs.length) match.inputs = match.inputs.slice(0, e.count);
  match.legs = e.legs;
  if (e.finished) {
    match.status = 'finished';
    match.winnerIndex = e.winner;
    match.finishedAt = match.finishedAt ?? now;
  } else {
    if (match.status === 'finished') match.status = 'running';
    match.winnerIndex = null;
    match.finishedAt = null;
  }
  return match;
}

/** Aktueller Spielzustand für die Anzeige. */
export function currentState(match) {
  const e = replay(match);
  return {
    finished: e.finished,
    winner: e.winner,
    player: e.p,
    legIndex: e.legIndex,
    set: e.setNo,
    leg: e.legNo,
    rests: e.rests.slice(),
    visitDarts: e.visit ? e.visit.darts.slice() : [],
    dartsLeft: e.visit ? 3 - e.visit.darts.length : 3,
    setsWon: e.setsWon.slice(),
    legsInSet: e.legsInSet.slice(),
    legsWonTotal: e.legsWonTotal.slice(),
    opened: e.opened.slice(),
    engine: e,
  };
}

export function addDart(match, dart, now) {
  if (match.status !== 'running') throw new Error('Match ist nicht aktiv');
  match.inputs.push({ seg: dart.seg, mult: dart.mult });
  return refresh(match, now);
}

export function undo(match, now) {
  if (!match.inputs.length) return match;
  match.inputs.pop();
  if (match.status === 'finished') match.status = 'running';
  return refresh(match, now);
}

/**
 * Ersetzt die Darts einer abgeschlossenen Aufnahme im letzten Leg und spielt die
 * folgenden Aufnahmen dieses Legs (gruppiert wie zuvor) neu ab.
 * Endet das Leg durch die Änderung früher, werden die überzähligen Aufnahmen verworfen.
 * Wird eine Folgeaufnahme durch die Änderung nicht mehr beendet (z. B. kein Bust mehr),
 * wird sie mit Fehlwürfen (0) aufgefüllt.
 * @returns {{match, dropped:number, padded:number}}
 */
export function editVisit(match, legIdx, visitIdx, newDarts, now) {
  const legs = match.legs;
  if (!isLegEditable(match, legIdx)) throw new Error('Nur Aufnahmen im aktuellen oder gerade beendeten Leg sind bearbeitbar');
  const leg = legs[legIdx];
  const visit = leg.visits[visitIdx];
  if (!visit || !visit.darts.length) throw new Error('Aufnahme nicht gefunden');
  const lastV = leg.visits[leg.visits.length - 1];
  const lastOpen = !lastV.bust && !lastV.checkout && lastV.darts.length < 3 && match.status === 'running';
  if (visit === lastV && lastOpen) throw new Error('Laufende Aufnahme bitte mit Rückgängig korrigieren');
  const startI = visit.darts[0].i;
  const chunks = [newDarts.map(({ seg, mult }) => ({ seg, mult }))];
  for (const v of leg.visits.slice(visitIdx + 1)) chunks.push(v.darts.map(({ seg, mult }) => ({ seg, mult })));

  const e = new Engine(match.settings, match.participants.length);
  const inputs = match.inputs.slice(0, startI);
  for (const d of inputs) e.push(d);

  let dropped = 0;
  let padded = 0;
  const legCount = () => e.legs.length;
  const startLegs = legCount();
  for (let c = 0; c < chunks.length; c++) {
    if (e.finished || legCount() !== startLegs) {
      dropped += chunks.length - c;
      break;
    }
    const chunk = chunks[c];
    let pushed = 0;
    for (const d of chunk) {
      if (pushed > 0 && !e.visit) break; // Aufnahme ist vorzeitig beendet
      e.push(d);
      inputs.push(d);
      pushed++;
    }
    // Abgeschlossene Aufnahmen müssen abgeschlossen bleiben → ggf. mit Fehlwürfen auffüllen.
    // Nur die ursprünglich laufende (letzte, offene) Aufnahme darf offen bleiben.
    const mayStayOpen = c > 0 && c === chunks.length - 1 && lastOpen;
    while (!mayStayOpen && e.visit && !e.finished && legCount() === startLegs) {
      const miss = { seg: 0, mult: 1 };
      e.push(miss);
      inputs.push(miss);
      padded++;
    }
  }
  match.inputs = inputs;
  if (match.status === 'finished' && !e.finished) match.status = 'running';
  match.finishedAt = e.finished ? match.finishedAt : null;
  refresh(match, now);
  return { match, dropped, padded };
}

/** Bearbeitbar: letztes Leg, oder das vorletzte, solange das neue Leg noch keinen Dart hat. */
export function isLegEditable(match, legIdx) {
  const last = match.legs.length - 1;
  return legIdx === last || (legIdx === last - 1 && match.legs[last].visits.length === 0);
}

/** Punkte, Darts und 3-Dart-Average eines Teilnehmers über Legs. */
export function playerTotals(legs, p) {
  let points = 0;
  let darts = 0;
  for (const leg of legs) for (const v of leg.visits) if (v.p === p) {
    points += v.score;
    darts += v.darts.length;
  }
  return { points, darts, average: darts ? (points / darts) * 3 : 0 };
}
