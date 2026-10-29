// Dartscheibe als SVG mit eingefärbten Feldern (Wurfbild / Heatmap).
import { RADII, SEGMENTS } from '../core/board.js';

const NS = 'http://www.w3.org/2000/svg';
const NUM_R = 186;

function el(tag, attrs = {}, ...children) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) if (c) e.append(c);
  return e;
}

// Winkel im Uhrzeigersinn ab oben → SVG-Koordinaten (y nach unten).
const pt = (r, a) => `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;

function sector(r1, r2, a1, a2) {
  return `M ${pt(r1, a1)} L ${pt(r2, a1)} A ${r2} ${r2} 0 0 1 ${pt(r2, a2)} L ${pt(r1, a2)} A ${r1} ${r1} 0 0 0 ${pt(r1, a1)} Z`;
}

/**
 * counts: {"20|3": n, …} (Single innen und außen teilen sich "n|1"), total: Anzahl Darts.
 * Felder werden nach Anteil am Maximum eingefärbt; title-Tooltips zeigen Anzahl und Anteil.
 */
export function boardHeatmap(counts, total) {
  const max = Math.max(1, ...Object.values(counts));
  const fill = (key) => {
    const c = counts[key] || 0;
    if (!c) return { fill: 'var(--board-empty)', 'fill-opacity': '1' };
    return { fill: 'var(--heat)', 'fill-opacity': (0.18 + 0.82 * Math.pow(c / max, 0.6)).toFixed(3) };
  };
  const tip = (label, key) => {
    const c = counts[key] || 0;
    return el('title', {}, document.createTextNode(`${label}: ${c}× (${total ? ((c / total) * 100).toFixed(1).replace('.', ',') : 0} %)`));
  };
  const svg = el('svg', { viewBox: '-200 -200 400 400', class: 'board-svg', role: 'img', 'aria-label': 'Wurfbild auf der Dartscheibe' });
  const step = Math.PI / 10;
  SEGMENTS.forEach((n, i) => {
    const a1 = i * step - step / 2;
    const a2 = a1 + step;
    const rings = [
      [RADII.outerBull, RADII.tripleInner, `${n}|1`, `S${n}`],
      [RADII.tripleInner, RADII.tripleOuter, `${n}|3`, `T${n}`],
      [RADII.tripleOuter, RADII.doubleInner, `${n}|1`, `S${n}`],
      [RADII.doubleInner, RADII.doubleOuter, `${n}|2`, `D${n}`],
    ];
    for (const [r1, r2, key, label] of rings) {
      svg.append(el('path', { d: sector(r1, r2, a1, a2), class: 'board-field', ...fill(key) }, tip(label, key)));
    }
    svg.append(el('text', { x: (NUM_R * Math.sin(i * step)).toFixed(1), y: (-NUM_R * Math.cos(i * step) + 6).toFixed(1), class: 'board-num' }, document.createTextNode(String(n))));
  });
  svg.append(el('circle', { r: RADII.outerBull, class: 'board-field', ...fill('25|1') }, tip('25', '25|1')));
  svg.append(el('circle', { r: RADII.innerBull, class: 'board-field', ...fill('25|2') }, tip('BULL', '25|2')));
  return svg;
}
