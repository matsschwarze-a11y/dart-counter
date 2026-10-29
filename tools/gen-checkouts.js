// Erzeugt js/core/checkout-table.js (Double-out, 1–3 Darts) aus der Routensuche
// plus bekannte Profi-Wege als Overrides.  Aufruf: node tools/gen-checkouts.js
import { writeFileSync } from 'node:fs';
import { computeCheckout } from '../js/core/checkout.js';

// Gängige Profi-Wege (3 Darts), überschreiben die berechneten.
const OVERRIDES_3 = {
  170: 'T20 T20 BULL', 167: 'T20 T19 BULL', 164: 'T20 T18 BULL', 161: 'T20 T17 BULL',
  160: 'T20 T20 D20', 158: 'T20 T20 D19', 157: 'T20 T19 D20', 156: 'T20 T20 D18',
  155: 'T20 T19 D19', 154: 'T20 T18 D20', 153: 'T20 T19 D18', 152: 'T20 T20 D16',
  151: 'T20 T17 D20', 150: 'T20 T18 D18', 149: 'T20 T19 D16', 148: 'T20 T16 D20',
  147: 'T20 T17 D18', 146: 'T20 T18 D16', 145: 'T20 T15 D20', 144: 'T20 T20 D12',
  143: 'T20 T17 D16', 142: 'T20 T14 D20', 141: 'T20 T19 D12', 140: 'T20 T20 D10',
  139: 'T20 T13 D20', 138: 'T20 T18 D12', 137: 'T20 T19 D10', 136: 'T20 T20 D8',
  135: 'T20 T17 D12', 134: 'T20 T14 D16', 133: 'T20 T19 D8', 132: 'T20 T16 D12',
  131: 'T20 T13 D16', 130: 'T20 T18 D8', 129: 'T19 T16 D12', 128: 'T18 T14 D16',
  127: 'T20 T17 D8', 126: 'T19 T19 D6', 125: 'T18 T13 D16', 124: 'T20 T16 D8',
  123: 'T19 T16 D9', 122: 'T18 T20 D4', 121: 'T20 T11 D14', 120: 'T20 S20 D20',
  119: 'T19 T12 D13', 118: 'T20 S18 D20', 117: 'T20 S17 D20', 116: 'T20 S16 D20',
  115: 'T20 S15 D20', 114: 'T20 S14 D20', 113: 'T20 S13 D20', 112: 'T20 S12 D20',
  111: 'T20 S11 D20', 110: 'T20 BULL', 109: 'T20 S9 D20', 108: 'T20 S16 D16',
  107: 'T19 BULL', 106: 'T20 S10 D18', 105: 'T20 S13 D16', 104: 'T18 BULL',
  103: 'T19 S6 D20', 102: 'T20 S10 D16', 101: 'T17 BULL', 100: 'T20 D20',
};

// Gängige Zwei-Dart-Wege 61–99, gelten für 2 und 3 verbleibende Darts.
const OVERRIDES_2 = {
  61: 'T15 D8', 62: 'T10 D16', 63: 'T13 D12', 64: 'T16 D8', 65: '25 D20',
  66: 'T10 D18', 67: 'T17 D8', 68: 'T20 D4', 69: 'T19 D6', 70: 'T18 D8',
  71: 'T13 D16', 72: 'T16 D12', 73: 'T19 D8', 74: 'T14 D16', 75: 'T17 D12',
  76: 'T20 D8', 77: 'T19 D10', 78: 'T18 D12', 79: 'T19 D11', 80: 'T20 D10',
  81: 'T19 D12', 82: 'T14 D20', 83: 'T17 D16', 84: 'T20 D12', 85: 'T15 D20',
  86: 'T18 D16', 87: 'T17 D18', 88: 'T20 D14', 89: 'T19 D16', 90: 'T20 D15',
  91: 'T17 D20', 92: 'T20 D16', 93: 'T19 D18', 94: 'T18 D20', 95: 'T19 D19',
  96: 'T20 D18', 97: 'T19 D20', 98: 'T20 D19',
};
OVERRIDES_3[99] = 'T19 S10 D16';

const table = { 1: {}, 2: {}, 3: {} };
for (const darts of [1, 2, 3]) {
  for (let rest = 2; rest <= 170; rest++) {
    let route = computeCheckout(rest, darts, 'double');
    if (darts >= 2 && OVERRIDES_2[rest]) route = OVERRIDES_2[rest].split(' ');
    if (darts === 3 && OVERRIDES_3[rest]) route = OVERRIDES_3[rest].split(' ');
    if (route) table[darts][rest] = route;
  }
}

const lines = ['// GENERIERT von tools/gen-checkouts.js – nicht von Hand ändern.', '// Double-out-Checkout-Wege je Anzahl verbleibender Darts.', 'export const CHECKOUT_TABLE = {'];
for (const darts of [1, 2, 3]) {
  lines.push(`  ${darts}: {`);
  for (const [rest, route] of Object.entries(table[darts])) lines.push(`    ${rest}: ${JSON.stringify(route)},`);
  lines.push('  },');
}
lines.push('};', '');
const file = new URL('../js/core/checkout-table.js', import.meta.url);
writeFileSync(file, lines.join('\n'));
console.log('Checkout-Tabelle geschrieben:', Object.keys(table[3]).length, 'Wege (3 Darts)');
