// Komplettes Match Bot gegen Bot im Hintergrund (für Turnierspiele ohne dich).
import { createMatch, addDart, playerTotals } from '../core/match.js';
import { nextBotDart } from './bot-player.js';

const MAX_DARTS = 3000;

/** a, b: Turnier-Teilnehmer mit botAverage. Liefert {winner: 'a'|'b', legs: [x, y], averages: [x, y]}. */
export function simulateBotMatch(a, b, legsToWin, settings, rand = Math.random) {
  const match = createMatch({
    settings: { ...settings, format: { type: 'firstTo', legs: legsToWin, sets: 0 }, startPlayer: rand() < 0.5 ? 0 : 1 },
    participants: [a, b].map((e) => ({ playerId: null, name: e.name, isBot: true, botAverage: e.botAverage })),
  });
  for (let i = 0; i < MAX_DARTS && match.status === 'running'; i++) addDart(match, nextBotDart(match, rand));
  const legs = [0, 1].map((p) => match.legs.filter((l) => l.winnerIndex === p).length);
  const averages = [0, 1].map((p) => playerTotals(match.legs, p).average);
  const winner = match.winnerIndex === 1 ? 'b' : 'a';
  return { winner, legs, averages };
}
