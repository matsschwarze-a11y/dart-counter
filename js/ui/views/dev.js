// Versteckte Entwickler-Seite (?dev=1): Bot-Simulation für einen Ziel-Average.
import { h, clear, fmt, pct } from '../dom.js';
import { barChart } from '../chart.js';
import { simulateLeg } from '../../bot/simulate.js';
import { sigmaForAverage, MIN_AVERAGE, MAX_AVERAGE } from '../../bot/calibration-table.js';
import { mulberry32, randomSeed } from '../../core/rng.js';

const LEGS = 1000;

export async function renderDev(root, ctx) {
  ctx.setTitle('Bot-Simulation');
  if (!ctx.dev) {
    root.append(h('p', { class: 'page muted' }, 'Entwickler-Modus ist nicht aktiv (Seite mit ?dev=1 öffnen).'));
    return;
  }
  let target = 60;
  let cancelled = false;
  const out = h('div');
  const range = h('input', { type: 'range', min: MIN_AVERAGE, max: MAX_AVERAGE, step: 1, value: target, 'aria-label': 'Ziel-Average' });
  const label = h('output', { class: 'bot-avg' }, String(target));
  range.addEventListener('input', () => {
    target = Number(range.value);
    label.textContent = range.value;
  });
  const runBtn = h('button', { class: 'btn primary block', onClick: run }, `${LEGS} Legs simulieren`);
  root.append(h('div', { class: 'page' },
    h('section', { class: 'card' },
      h('h2', {}, 'Ziel-Average'),
      h('div', { class: 'bot-row' }, range, label),
      runBtn),
    out));

  async function run() {
    runBtn.disabled = true;
    const sigma = sigmaForAverage(target);
    const rand = mulberry32(randomSeed());
    const acc = { points: 0, darts: 0, f9p: 0, f9d: 0, att: 0, co: 0, v: 0, v60: 0, v100: 0, v140: 0, v180: 0, min: Infinity, max: 0, hist: new Array(19).fill(0) };
    for (let i = 0; i < LEGS && !cancelled; i++) {
      const leg = simulateLeg(sigma, {}, rand);
      let ld = 0;
      leg.visits.forEach((v, k) => {
        acc.points += v.score;
        acc.darts += v.darts.length;
        ld += v.darts.length;
        if (k < 3) {
          acc.f9p += v.score;
          acc.f9d += v.darts.length;
        }
        acc.att += v.darts.filter((d) => d.doubleAttempt).length;
        if (v.checkout) acc.co++;
        acc.v++;
        if (v.score >= 60) acc.v60++;
        if (v.score >= 100) acc.v100++;
        if (v.score >= 140) acc.v140++;
        if (v.score === 180) acc.v180++;
        acc.hist[Math.min(18, Math.floor(v.score / 10))]++;
      });
      acc.min = Math.min(acc.min, ld);
      acc.max = Math.max(acc.max, ld);
      if (i % 50 === 49) {
        runBtn.textContent = `Simuliere … ${i + 1}/${LEGS}`;
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    runBtn.disabled = false;
    runBtn.textContent = `${LEGS} Legs simulieren`;
    if (cancelled) return;
    const row = (k, v) => h('tr', {}, h('th', {}, k), h('td', {}, v));
    clear(out);
    out.append(h('section', { class: 'card' },
      h('h2', {}, `Ergebnis für Ziel ${target} (σ ${fmt(sigma, 1)} mm)`),
      h('table', { class: 'table' },
        row('Erreichter Average', fmt((acc.points / acc.darts) * 3)),
        row('Abweichung', fmt((acc.points / acc.darts) * 3 - target)),
        row('First-9-Average', fmt((acc.f9p / acc.f9d) * 3)),
        row('Checkout-Quote', `${pct(acc.co / acc.att)} (${acc.co}/${acc.att})`),
        row('Aufnahmen 60+', pct(acc.v60 / acc.v)),
        row('Aufnahmen 100+', pct(acc.v100 / acc.v)),
        row('Aufnahmen 140+', pct(acc.v140 / acc.v)),
        row('Aufnahmen 180', pct(acc.v180 / acc.v, 2)),
        row('Darts pro Leg', `Ø ${fmt(acc.darts / LEGS, 1)} · min ${acc.min} · max ${acc.max}`))),
      h('section', { class: 'card' },
        h('h2', {}, 'Verteilung der Aufnahmen'),
        barChart(acc.hist.map((n, i) => ({ label: i === 18 ? '180' : String(i * 10), value: n / acc.v })))));
  }

  return () => {
    cancelled = true;
  };
}
