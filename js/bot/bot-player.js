// Bot im laufenden Match: wählt den nächsten Dart anhand des Match-Zustands.
import { currentState } from '../core/match.js';
import { mulberry32 } from '../core/rng.js';
import { sigmaForAverage } from './calibration-table.js';
import { legForm } from './throw-model.js';
import { newVisit } from './strategy.js';
import { botDart } from './simulate.js';

const visitStates = new Map();

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Streuung des Bots in diesem Leg (Form-Schwankung deterministisch je Match/Leg/Spieler). */
export function botSigma(match, legIndex, p) {
  const part = match.participants[p];
  const formRand = mulberry32((hashString(match.id) + legIndex * 7919 + p * 104729) >>> 0);
  return sigmaForAverage(part.botAverage) * legForm(formRand);
}

/** Ist gerade ein Bot am Zug? */
export function isBotTurn(match) {
  if (match.status !== 'running') return false;
  const st = currentState(match);
  return !!match.participants[st.player]?.isBot;
}

/** Nächster Bot-Dart ({seg, mult}) für den aktuellen Zustand. */
export function nextBotDart(match, rand = Math.random) {
  const st = currentState(match);
  const p = st.player;
  const e = st.engine;
  const leg = e.legs[e.legs.length - 1];
  const visitIndex = leg.visits.length - (e.visit ? 1 : 0);
  const sigma = botSigma(match, st.legIndex, p);
  const key = `${match.id}:${st.legIndex}:${visitIndex}`;
  let visit = visitStates.get(key);
  if (!visit) {
    visit = newVisit(sigma, rand);
    if (visitStates.size > 200) visitStates.clear();
    visitStates.set(key, visit);
  }
  const visitStart = e.visit ? e.visit.startRest : st.rests[p];
  const { result } = botDart({
    rest: st.rests[p],
    dartsLeft: st.dartsLeft,
    visitStart,
    opened: st.opened[p],
    settings: match.settings,
    sigma,
    visit,
    rand,
  });
  return result;
}
