import { parseDart } from '../js/core/board.js';
import { createMatch, addDart } from '../js/core/match.js';

export const D = (s) => s.trim().split(/\s+/).map(parseDart);

export function makeMatch(settings = {}, names = ['A', 'B']) {
  return createMatch({
    settings,
    participants: names.map((name, i) => ({ playerId: 'p' + i, name, isBot: false })),
    id: 'm1',
    now: 1000,
  });
}

export function play(match, darts) {
  for (const d of D(darts)) addDart(match, d, 2000);
  return match;
}
