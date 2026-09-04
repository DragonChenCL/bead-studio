// @ts-nocheck
import { deltaE00, nearestColor, paletteByCode, rgbToLab } from './color';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function solveLinearSystem(matrix, values) {
  const n = values.length;
  const work = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(work[row][column]) > Math.abs(work[pivot][column])) pivot = row;
    }
    if (Math.abs(work[pivot][column]) < 1e-12) throw new Error('singular homography');
    [work[column], work[pivot]] = [work[pivot], work[column]];
    const divisor = work[column][column];
    for (let j = column; j <= n; j += 1) work[column][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = work[row][column];
      for (let j = column; j <= n; j += 1) work[row][j] -= factor * work[column][j];
    }
  }
  return work.map((row) => row[n]);
}

export function homographyFromRectToQuad(width, height, quad) {
  const source = [[0, 0], [width, 0], [width, height], [0, height]];
  const matrix = [];
  const values = [];
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = source[i];
    const u = quad[i].x;
    const v = quad[i].y;
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  const h = solveLinearSystem(matrix, values);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function mapPoint(H, x, y) {
  const denominator = H[6] * x + H[7] * y + 1;
  return [
    (H[0] * x + H[1] * y + H[2]) / denominator,
    (H[3] * x + H[4] * y + H[5]) / denominator,
  ];
}

function samplePixel(image, x, y) {
  const px = clamp(Math.round(x), 0, image.width - 1);
  const py = clamp(Math.round(y), 0, image.height - 1);
  const index = (py * image.width + px) * 4;
  return [image.data[index], image.data[index + 1], image.data[index + 2]];
}

export function rectifyImageData(image, quad, width, height) {
  const H = homographyFromRectToQuad(width - 1, height - 1, quad);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [sourceX, sourceY] = mapPoint(H, x, y);
      const rgb = samplePixel(image, sourceX, sourceY);
      const index = (y * width + x) * 4;
      data[index] = rgb[0];
      data[index + 1] = rgb[1];
      data[index + 2] = rgb[2];
      data[index + 3] = 255;
    }
  }
  return { data, width, height };
}

function sampleRing(image, cx, cy, radius, count = 24) {
  const sum = [0, 0, 0];
  for (let i = 0; i < count; i += 1) {
    const angle = (i * 2 * Math.PI) / count;
    const rgb = samplePixel(image, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    sum[0] += rgb[0];
    sum[1] += rgb[1];
    sum[2] += rgb[2];
  }
  return sum.map((value) => value / count);
}

function sampleCenter(image, cx, cy, radius) {
  const sum = [0, 0, 0];
  let count = 0;
  for (let y = -3; y <= 3; y += 1) {
    for (let x = -3; x <= 3; x += 1) {
      if (x * x + y * y > 9) continue;
      const rgb = samplePixel(image, cx + (x * radius) / 3, cy + (y * radius) / 3);
      sum[0] += rgb[0];
      sum[1] += rgb[1];
      sum[2] += rgb[2];
      count += 1;
    }
  }
  return sum.map((value) => value / count);
}

function applyGain(rgb, gain) {
  return rgb.map((value, index) => clamp(value * gain[index], 0, 255));
}

function estimateLightingGain(samples) {
  if (!samples.length) return [1, 1, 1];
  const ratios = [[], [], []];
  for (const sample of samples) {
    const target = paletteByCode.get(sample.target)?.rgb;
    if (!target) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      if (sample.rgb[channel] > 20 && target[channel] > 12) {
        ratios[channel].push(target[channel] / sample.rgb[channel]);
      }
    }
  }
  return ratios.map((values) => {
    if (!values.length) return 1;
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    return clamp(median, 0.72, 1.38);
  });
}

export function inspectPatternPhoto(pattern, image, options = {}) {
  const cellWidth = image.width / pattern.width;
  const cellHeight = image.height / pattern.height;
  const threshold = Number(options.deltaEThreshold) || 13;
  const occupancyThreshold = Number(options.occupancyDeltaEThreshold) || 4.2;
  const rawSamples = [];

  for (let y = 0; y < pattern.height; y += 1) {
    for (let x = 0; x < pattern.width; x += 1) {
      const index = y * pattern.width + x;
      const target = pattern.cells[index];
      if (!target) continue;
      const size = Math.min(cellWidth, cellHeight);
      const cx = (x + 0.5) * cellWidth;
      const cy = (y + 0.5) * cellHeight;
      const ring = sampleRing(image, cx, cy, size * 0.28, 24);
      const center = sampleCenter(image, cx, cy, size * 0.085);
      const occupancyDeltaE = deltaE00(rgbToLab(ring), rgbToLab(center));
      rawSamples.push({ x, y, index, target, ring, occupancyDeltaE });
    }
  }

  const likelyPresent = rawSamples.filter((row) => row.occupancyDeltaE >= occupancyThreshold);
  const firstPassCorrect = likelyPresent
    .map((row) => {
      const targetColor = paletteByCode.get(row.target);
      return {
        ...row,
        deltaE: deltaE00(rgbToLab(row.ring), targetColor.lab),
      };
    })
    .filter((row) => row.deltaE <= threshold * 1.15)
    .sort((a, b) => a.deltaE - b.deltaE);
  const calibrationSamples = firstPassCorrect.slice(0, Math.max(8, Math.floor(firstPassCorrect.length * 0.7)));
  const gain = estimateLightingGain(calibrationSamples.map((row) => ({ target: row.target, rgb: row.ring })));

  const results = [];
  let correct = 0;
  let wrong = 0;
  let uncertain = 0;
  let missing = 0;

  for (const row of rawSamples) {
    const corrected = applyGain(row.ring, gain);
    const targetColor = paletteByCode.get(row.target);
    const deltaE = deltaE00(rgbToLab(corrected), targetColor.lab);
    const predicted = nearestColor(corrected).color.code;
    let status = 'ok';

    if (row.occupancyDeltaE < occupancyThreshold) {
      status = 'missing';
      missing += 1;
    } else if (deltaE > threshold * 1.6) {
      status = 'wrong';
      wrong += 1;
    } else if (deltaE > threshold) {
      status = 'uncertain';
      uncertain += 1;
    } else {
      correct += 1;
    }

    results.push({
      x: row.x,
      y: row.y,
      index: row.index,
      target: row.target,
      predicted,
      deltaE,
      status,
      occupancyDeltaE: row.occupancyDeltaE,
    });
  }

  return {
    results,
    correct,
    wrong,
    uncertain,
    missing,
    total: correct + wrong + uncertain + missing,
    calibration: { gain },
  };
}

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function inspectIroningBacklight(pattern, image, options = {}) {
  const cellWidth = image.width / pattern.width;
  const cellHeight = image.height / pattern.height;
  const underRatio = Number(options.underRatio) || 0.58;
  const overRatio = Number(options.overRatio) || 0.12;
  const results = [];
  let under = 0;
  let over = 0;
  let normal = 0;

  for (let y = 0; y < pattern.height; y += 1) {
    for (let x = 0; x < pattern.width; x += 1) {
      const index = y * pattern.width + x;
      if (!pattern.cells[index]) continue;
      const size = Math.min(cellWidth, cellHeight);
      const cx = (x + 0.5) * cellWidth;
      const cy = (y + 0.5) * cellHeight;
      const ring = sampleRing(image, cx, cy, size * 0.34);
      const ringLum = luminance(...ring);
      let bright = 0;
      let total = 0;

      for (let yy = -3; yy <= 3; yy += 1) {
        for (let xx = -3; xx <= 3; xx += 1) {
          if (xx * xx + yy * yy > 9) continue;
          const pixel = samplePixel(image, cx + xx * size * 0.06, cy + yy * size * 0.06);
          if (luminance(...pixel) > ringLum + 22) bright += 1;
          total += 1;
        }
      }

      const ratio = bright / total;
      let status = 'normal';
      if (ratio > underRatio) {
        status = 'under';
        under += 1;
      } else if (ratio < overRatio) {
        status = 'over';
        over += 1;
      } else {
        normal += 1;
      }
      results.push({ x, y, index, ratio, status });
    }
  }

  const total = under + over + normal;
  return {
    results,
    under,
    over,
    normal,
    total,
    score: total ? Math.max(0, 100 - Math.round(((under + over) * 100) / total)) : 0,
  };
}

export function buildPatternFromImageElement(image, width, options = {}) {
  const height = Math.max(
    1,
    Math.min(Number(options.maxHeight) || 160, Math.round((width * image.naturalHeight) / image.naturalWidth)),
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.drawImage(image, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const cells = [];
  for (let index = 0; index < width * height; index += 1) {
    const alpha = data[index * 4 + 3];
    cells.push(
      alpha < 24
        ? null
        : nearestColor([data[index * 4], data[index * 4 + 1], data[index * 4 + 2]]).color.code,
    );
  }
  return { width, height, cells, name: options.name || '新作品' };
}
