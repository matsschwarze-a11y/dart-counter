// GENERIERT von tools/calibrate.js (6000 Legs je Stützstelle) – nicht von Hand ändern.
// Stützstellen [3-Dart-Average, σ in mm], Average absteigend.
export const CALIBRATION = [[132.69,3],[124.38,3.5],[117.78,4],[111.05,4.5],[105.91,5],[100.52,5.5],[96.47,6],[92.35,6.5],[88.43,7],[85.64,7.5],[81.47,8],[79.13,8.5],[75.96,9],[73.39,9.5],[70.93,10],[68.15,10.5],[65.89,11],[63.6,11.5],[61.31,12],[57.33,13],[53.76,14],[50.35,15],[47.33,16],[44.99,17],[42.78,18],[40.38,19],[38.9,20],[36.84,21],[35.59,22],[34.09,23],[32.99,24],[31.52,25],[30.53,26],[29.45,27],[28.4,28],[27.44,29],[26.61,30],[25.62,31],[24.87,32],[24.03,33],[23.47,34],[22.72,35],[21.91,36],[21.31,37],[20.65,38],[20.02,39],[19.48,40]];

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
