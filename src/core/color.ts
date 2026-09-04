// @ts-nocheck
import { MARD_PALETTE } from './palette';

export const palette = MARD_PALETTE;
export const paletteByCode = new Map(palette.map((color) => [color.code, color]));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

function srgbToLinear(value) {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function rgbToLab([red, green, blue]) {
  const r = srgbToLinear(red);
  const g = srgbToLinear(green);
  const b = srgbToLinear(blue);

  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  let z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function deltaE00(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const avgL = (L1 + L2) / 2;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const avgC = (C1 + C2) / 2;
  const avgC7 = Math.pow(avgC, 7);
  const G = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + Math.pow(25, 7))));
  const A1 = (1 + G) * a1;
  const A2 = (1 + G) * a2;
  const CP1 = Math.hypot(A1, b1);
  const CP2 = Math.hypot(A2, b2);
  const avgCP = (CP1 + CP2) / 2;

  const hue = (a, b) => {
    if (!a && !b) return 0;
    const h = toDeg(Math.atan2(b, a));
    return h < 0 ? h + 360 : h;
  };

  const h1 = hue(A1, b1);
  const h2 = hue(A2, b2);
  const dL = L2 - L1;
  const dC = CP2 - CP1;
  let dh = CP1 * CP2 === 0 ? 0 : h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(CP1 * CP2) * Math.sin(toRad(dh / 2));

  let avgH;
  if (CP1 * CP2 === 0) avgH = h1 + h2;
  else if (Math.abs(h1 - h2) <= 180) avgH = (h1 + h2) / 2;
  else avgH = (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2;

  const T =
    1 -
    0.17 * Math.cos(toRad(avgH - 30)) +
    0.24 * Math.cos(toRad(2 * avgH)) +
    0.32 * Math.cos(toRad(3 * avgH + 6)) -
    0.2 * Math.cos(toRad(4 * avgH - 63));
  const dTheta = 30 * Math.exp(-Math.pow((avgH - 275) / 25, 2));
  const avgCP7 = Math.pow(avgCP, 7);
  const Rc = 2 * Math.sqrt(avgCP7 / (avgCP7 + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const Sc = 1 + 0.045 * avgCP;
  const Sh = 1 + 0.015 * avgCP * T;
  const Rt = -Math.sin(toRad(2 * dTheta)) * Rc;

  return Math.sqrt(
    Math.pow(dL / Sl, 2) +
      Math.pow(dC / Sc, 2) +
      Math.pow(dH / Sh, 2) +
      Rt * (dC / Sc) * (dH / Sh),
  );
}

palette.forEach((color) => {
  color.lab = rgbToLab(color.rgb);
});

export function nearestColor(rgb, candidates = palette) {
  const lab = rgbToLab(rgb);
  let best = candidates[0];
  let bestDelta = Infinity;
  for (const color of candidates) {
    const delta = deltaE00(lab, color.lab);
    if (delta < bestDelta) {
      best = color;
      bestDelta = delta;
    }
  }
  return { color: best, deltaE: bestDelta };
}

export function summarizeUsage(cells = []) {
  const counts = new Map();
  for (const code of cells) {
    if (code) counts.set(code, (counts.get(code) || 0) + 1);
  }
  return [...counts]
    .map(([code, count]) => ({ code, count, color: paletteByCode.get(code) }))
    .sort((a, b) => b.count - a.count);
}
