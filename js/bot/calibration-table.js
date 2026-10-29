// GENERIERT von tools/calibrate.js (6000 Legs je Stützstelle) – nicht von Hand ändern.
// Stützstellen [3-Dart-Average, σ in mm], Average absteigend.
export const CALIBRATION = [[133,3],[124.79,3.5],[118.19,4],[111.03,4.5],[105.9,5],[100.69,5.5],[96.45,6],[92.35,6.5],[88.79,7],[85.23,7.5],[82.08,8],[79.36,8.5],[76.25,9],[73.29,9.5],[70.88,10],[68.66,10.5],[66.23,11],[63.84,11.5],[61.63,12],[57.39,13],[53.58,14],[50.48,15],[47.52,16],[44.83,17],[42.7,18],[40.93,19],[38.57,20],[36.98,21],[35.54,22],[34,23],[32.56,24],[31.47,25],[30.58,26],[29.27,27],[28.24,28],[27.33,29],[26.62,30],[25.68,31],[24.61,32],[24.36,33],[23.52,34],[22.56,35],[21.92,36],[21.4,37],[20.86,38],[20.14,39],[19.73,40]];

export const MIN_AVERAGE = 25;
export const MAX_AVERAGE = 100;

/** σ (mm) für einen Ziel-Average, linear zwischen den Stützstellen interpoliert. */
export function sigmaForAverage(avg) {
  const t = CALIBRATION;
  if (avg >= t[0][0]) return t[0][1];
  if (avg <= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 0; i < t.length - 1; i++) {
    const [a1, s1] = t[i];
    const [a2, s2] = t[i + 1];
    if (avg <= a1 && avg >= a2) {
      if (a1 === a2) return (s1 + s2) / 2;
      return s1 + ((a1 - avg) / (a1 - a2)) * (s2 - s1);
    }
  }
  return t[t.length - 1][1];
}
