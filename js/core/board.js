// Steeldart-Scheibe: Geometrie (mm), Segmente, Notation.
// Koordinaten: Ursprung = Bull-Mitte, x nach rechts, y nach oben.

export const RADII = Object.freeze({
  innerBull: 6.35,
  outerBull: 15.9,
  tripleInner: 99,
  tripleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
});

// Im Uhrzeigersinn, beginnend oben.
export const SEGMENTS = Object.freeze([20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]);

// Zielradien (Mitte der jeweiligen Fläche).
export const AIM_RADIUS = Object.freeze({
  triple: (RADII.tripleInner + RADII.tripleOuter) / 2, // 103
  double: (RADII.doubleInner + RADII.doubleOuter) / 2, // 166
  bigSingle: (RADII.tripleOuter + RADII.doubleInner) / 2, // 134.5
  smallSingle: (RADII.outerBull + RADII.tripleInner) / 2, // 57.45
  outerBull: (RADII.innerBull + RADII.outerBull) / 2,
});

/** Punkte eines Darts. seg: 0 (Miss), 1–20, 25 (Bull); mult: 1–3 (Bull nur 1/2). */
export function dartPoints(d) {
  return d.seg === 0 ? 0 : d.seg * d.mult;
}

/** Notation: "T20", "D16", "S5", "25", "BULL", "0". */
export function dartLabel(d) {
  if (!d) return '–';
  if (d.seg === 0) return '0';
  if (d.seg === 25) return d.mult === 2 ? 'BULL' : '25';
  return (d.mult === 3 ? 'T' : d.mult === 2 ? 'D' : 'S') + d.seg;
}

/** Umkehrung von dartLabel. */
export function parseDart(label) {
  const s = String(label).trim().toUpperCase();
  if (s === '0' || s === 'M' || s === 'MISS') return { seg: 0, mult: 1 };
  if (s === 'BULL' || s === 'DB' || s === '50') return { seg: 25, mult: 2 };
  if (s === '25' || s === 'SB') return { seg: 25, mult: 1 };
  const m = /^([SDT])(\d{1,2})$/.exec(s);
  if (!m) throw new Error(`Unbekannter Dart: ${label}`);
  const n = Number(m[2]);
  if (n < 1 || n > 20) throw new Error(`Unbekannter Dart: ${label}`);
  return { seg: n, mult: { S: 1, D: 2, T: 3 }[m[1]] };
}

/** Index (0–19) eines Segments in der Reihenfolge. */
export function segmentIndex(n) {
  return SEGMENTS.indexOf(n);
}

/** Winkel (rad, im Uhrzeigersinn ab oben) der Segmentmitte. */
export function segmentAngle(n) {
  return (segmentIndex(n) * Math.PI) / 10;
}

/** Linke und rechte Nachbarzahl. */
export function neighbours(n) {
  const i = segmentIndex(n);
  return [SEGMENTS[(i + 19) % 20], SEGMENTS[(i + 1) % 20]];
}

/** Trefferpunkt (mm) → Dart. */
export function pointToDart(x, y) {
  const r = Math.hypot(x, y);
  if (r <= RADII.innerBull) return { seg: 25, mult: 2 };
  if (r <= RADII.outerBull) return { seg: 25, mult: 1 };
  if (r > RADII.doubleOuter) return { seg: 0, mult: 1 };
  let theta = Math.atan2(x, y); // 0 = oben, im Uhrzeigersinn positiv
  if (theta < 0) theta += 2 * Math.PI;
  const idx = Math.floor((theta + Math.PI / 20) / (Math.PI / 10)) % 20;
  const seg = SEGMENTS[idx];
  let mult = 1;
  if (r >= RADII.tripleInner && r <= RADII.tripleOuter) mult = 3;
  else if (r >= RADII.doubleInner) mult = 2;
  return { seg, mult };
}

/** Zielpunkt (mm) für einen Dart, jeweils Mitte der Fläche. */
export function aimPoint(d, { singleArea = 'big' } = {}) {
  if (d.seg === 25) {
    if (d.mult === 2) return { x: 0, y: 0 };
    return { x: 0, y: AIM_RADIUS.outerBull };
  }
  if (d.seg === 0) return { x: 0, y: 0 };
  const r = d.mult === 3 ? AIM_RADIUS.triple
    : d.mult === 2 ? AIM_RADIUS.double
    : singleArea === 'small' ? AIM_RADIUS.smallSingle : AIM_RADIUS.bigSingle;
  const a = segmentAngle(d.seg);
  return { x: r * Math.sin(a), y: r * Math.cos(a) };
}
