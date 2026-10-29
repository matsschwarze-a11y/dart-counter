// Selbst gezeichnetes SVG-Liniendiagramm (Average-Verlauf).
import { dateShort, fmt } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
};

/**
 * @param {Array<{date:number, average:number}>} points chronologisch
 */
export function lineChart(points, { width = 340, height = 180, label = 'Average' } = {}) {
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': `${label} im Verlauf` });
  if (points.length === 0) {
    svg.append(s('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', class: 'chart-empty' }, 'Noch keine Daten'));
    return svg;
  }
  const pad = { l: 34, r: 10, t: 12, b: 24 };
  const vals = points.map((p) => p.average);
  let lo = Math.floor(Math.min(...vals) / 10) * 10;
  let hi = Math.ceil(Math.max(...vals) / 10) * 10;
  if (hi - lo < 20) {
    lo = Math.max(0, lo - 10);
    hi = hi + 10;
  }
  hi = lo + Math.ceil((hi - lo) / 20) * 20; // 4 Gitterlinien auf runden Werten
  const w = width - pad.l - pad.r;
  const hgt = height - pad.t - pad.b;
  const x = (i) => pad.l + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v) => pad.t + hgt - ((v - lo) / (hi - lo)) * hgt;

  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = lo + ((hi - lo) * i) / ticks;
    svg.append(s('line', { x1: pad.l, x2: width - pad.r, y1: y(v), y2: y(v), class: 'chart-grid' }));
    svg.append(s('text', { x: pad.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'chart-label' }, String(Math.round(v))));
  }
  // gleitender Durchschnitt (5 Matches) als zweite Linie
  const ma = points.map((_, i) => {
    const sl = vals.slice(Math.max(0, i - 4), i + 1);
    return sl.reduce((a, b) => a + b, 0) / sl.length;
  });
  if (points.length > 1) {
    svg.append(s('polyline', { points: vals.map((v, i) => `${x(i)},${y(v)}`).join(' '), class: 'chart-line' }));
    svg.append(s('polyline', { points: ma.map((v, i) => `${x(i)},${y(v)}`).join(' '), class: 'chart-line-ma' }));
  }
  points.forEach((p, i) => {
    const c = s('circle', { cx: x(i), cy: y(p.average), r: points.length > 40 ? 1.8 : 3, class: 'chart-dot' });
    c.append(s('title', {}, `${dateShort(p.date)}: ${fmt(p.average)}`));
    svg.append(c);
  });
  svg.append(s('text', { x: pad.l, y: height - 6, class: 'chart-label' }, dateShort(points[0].date)));
  svg.append(s('text', { x: width - pad.r, y: height - 6, 'text-anchor': 'end', class: 'chart-label' }, dateShort(points[points.length - 1].date)));
  return svg;
}

/** Einfaches Balkendiagramm (Histogramm). values: [{label, value}] mit value 0..1 */
export function barChart(values, { width = 340, height = 140 } = {}) {
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': 'Verteilung' });
  const pad = { l: 6, r: 6, t: 8, b: 22 };
  const max = Math.max(...values.map((v) => v.value), 0.0001);
  const bw = (width - pad.l - pad.r) / values.length;
  values.forEach((v, i) => {
    const bh = ((height - pad.t - pad.b) * v.value) / max;
    const r = s('rect', { x: pad.l + i * bw + 1, y: height - pad.b - bh, width: Math.max(1, bw - 2), height: bh, class: 'chart-bar', rx: 2 });
    r.append(s('title', {}, `${v.label}: ${fmt(v.value * 100, 1)} %`));
    svg.append(r);
    if (i % 3 === 0) svg.append(s('text', { x: pad.l + i * bw + bw / 2, y: height - 6, 'text-anchor': 'middle', class: 'chart-label' }, v.label));
  });
  return svg;
}
