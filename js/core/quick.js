// Schnellwahl-Chips: häufige Aufnahmen, die alle drei Darts auf einmal füllen.
import { parseDart } from './board.js';
import { applyDart } from './rules.js';

export const QUICK_CHIPS = Object.freeze([
  { score: 0, darts: '0 0 0' },
  { score: 26, darts: 'S20 S5 S1' },
  { score: 41, darts: 'S20 S20 S1' },
  { score: 45, darts: 'S20 S20 S5' },
  { score: 60, darts: 'S20 S20 S20' },
  { score: 81, darts: 'T20 S20 S1' },
  { score: 85, darts: 'T20 S20 S5' },
  { score: 100, darts: 'T20 S20 S20' },
  { score: 140, darts: 'T20 T20 S20' },
  { score: 180, darts: 'T20 T20 T20' },
].map((c) => ({ ...c, darts: c.darts.split(' ').map(parseDart) })));

/**
 * Sichtbare Chips: nur zu Beginn einer Aufnahme und nur, wenn kein Dart der
 * Kombination einen Bust oder ein vorzeitiges Leg-Ende erzeugt. „0" ist immer sichtbar.
 */
export function visibleChips(rest, opened, settings, dartsThrown = 0) {
  if (dartsThrown > 0) return [];
  return QUICK_CHIPS.filter((chip) => {
    if (chip.score === 0) return true;
    let st = { rest, opened };
    for (const d of chip.darts) {
      const r = applyDart(st, d, settings);
      if (r.bust || r.checkout) return false;
      st = { rest: r.rest, opened: r.opened };
    }
    return true;
  });
}
