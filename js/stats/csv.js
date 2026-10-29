// CSV-Export für Excel (deutsch): Trennzeichen ";", Dezimalkomma, UTF-8 mit BOM.
import { dartLabel } from '../core/board.js';
import { matchSummary } from './stats.js';

export const BOM = '﻿';
const OUT_LABEL = { double: 'Double-out', master: 'Master-out', straight: 'Straight-out' };

export function num(x, digits = 2) {
  if (x === null || x === undefined || Number.isNaN(x)) return '';
  return x.toFixed(digits).replace('.', ',');
}

function cell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(header, rows) {
  return BOM + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

function dateStr(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const yn = (b) => (b ? 'ja' : 'nein');

export function dartsCsv(matches) {
  const header = ['Match-ID', 'Datum', 'Spieler', 'Bot', 'Set', 'Leg', 'Aufnahme', 'Dart', 'Feld', 'Segment', 'Multiplikator', 'Punkte', 'Rest vorher', 'Doppelversuch', 'Bust', 'Checkout'];
  const rows = [];
  for (const m of matches) {
    for (const leg of m.legs) {
      leg.visits.forEach((v, vi) => {
        const pl = m.participants[v.p];
        v.darts.forEach((d, di) => {
          rows.push([m.id, dateStr(m.createdAt), pl.name, yn(pl.isBot), leg.set, leg.leg, vi + 1, di + 1, dartLabel(d), d.seg, d.mult, d.points, d.remBefore, yn(d.doubleAttempt), yn(d.bust), yn(d.checkout)]);
        });
      });
    }
  }
  return toCsv(header, rows);
}

export function matchesCsv(matches) {
  const header = ['Match-ID', 'Datum', 'Status', 'Startscore', 'Out', 'Double-in', 'Format', 'Teilnehmer', 'Sieger', 'Legs', 'Averages'];
  const rows = matches.map((m) => {
    const { legsWon, averages } = matchSummary(m);
    const f = m.settings.format;
    const format = `${f.type === 'bestOf' ? 'Best of' : 'First to'} ${f.sets ? f.sets + ' Sets à ' : ''}${f.legs} Legs`;
    return [
      m.id, dateStr(m.createdAt), m.status, m.settings.startScore, OUT_LABEL[m.settings.outMode], yn(m.settings.doubleIn), format,
      m.participants.map((p) => p.name).join(' / '),
      m.winnerIndex !== null && m.winnerIndex !== undefined ? m.participants[m.winnerIndex].name : '',
      legsWon.join(':'),
      averages.map((a) => num(a)).join(' / '),
    ];
  });
  return toCsv(header, rows);
}
