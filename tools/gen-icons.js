// Erzeugt die App-Icons (stilisierte Dartscheibe) als PNG – ohne Abhängigkeiten.
// Aufruf: node tools/gen-icons.js
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { pointToDart, RADII, segmentIndex } from '../js/core/board.js';

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const BG = [15, 18, 22, 255];
const DARK = [28, 28, 30, 255];
const CREAM = [236, 226, 200, 255];
const RED = [214, 52, 58, 255];
const GREEN = [36, 160, 96, 255];
const WIRE = [150, 150, 150, 255];
const OUTER = [10, 10, 10, 255];

/** Farbe eines Punktes auf der Scheibe (mm). */
function boardColor(x, y) {
  const r = Math.hypot(x, y);
  if (r > 200) return null;
  if (r > RADII.doubleOuter) return OUTER;
  const d = pointToDart(x, y);
  if (d.seg === 25) return d.mult === 2 ? RED : GREEN;
  const even = segmentIndex(d.seg) % 2 === 0;
  if (d.mult > 1) return even ? RED : GREEN;
  return even ? DARK : CREAM;
}

function render(size, boardFraction, rounded) {
  const SS = 3; // Supersampling
  const scale = (200 * 2) / (size * boardFraction);
  return png(size, (px, py) => {
    let acc = [0, 0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const fx = px + (sx + 0.5) / SS;
      const fy = py + (sy + 0.5) / SS;
      // abgerundetes Quadrat für "any"-Icons, voll für maskable
      let col = BG;
      if (rounded) {
        const rr = size * 0.2;
        const cx = Math.min(Math.max(fx, rr), size - rr);
        const cy = Math.min(Math.max(fy, rr), size - rr);
        if (Math.hypot(fx - cx, fy - cy) > rr) col = [0, 0, 0, 0];
      }
      if (col[3]) {
        const x = (fx - size / 2) * scale;
        const y = -(fy - size / 2) * scale;
        const c = boardColor(x, y);
        // Drahtringe
        const r = Math.hypot(x, y);
        const wire = [RADII.tripleInner, RADII.tripleOuter, RADII.doubleInner, RADII.doubleOuter].some((w) => Math.abs(r - w) < scale * 0.6);
        if (c) col = wire && r <= RADII.doubleOuter + 1 ? WIRE : c;
      }
      acc = acc.map((v, i) => v + col[i]);
    }
    return acc.map((v) => Math.round(v / (SS * SS)));
  });
}

const out = (name, buf) => writeFileSync(new URL(`../icons/${name}`, import.meta.url), buf);
out('icon-192.png', render(192, 0.86, true));
out('icon-512.png', render(512, 0.86, true));
out('maskable-512.png', render(512, 0.62, false));
out('apple-touch-icon.png', render(180, 0.8, false));
console.log('Icons geschrieben.');
