import type { PredictionResponse } from '../api/predict';

const GRID_SIZE = 28;
const PIXELS = GRID_SIZE * GRID_SIZE;
const TEMPLATE_MIN = 4;
const TEMPLATE_MAX = 23;
const TEMPLATE_SPAN = TEMPLATE_MAX - TEMPLATE_MIN;

type SegmentName =
  | 'top'
  | 'upperLeft'
  | 'upperRight'
  | 'mid'
  | 'lowerLeft'
  | 'lowerRight'
  | 'bottom';
type Segment = readonly [number, number, number, number];

const SEGMENTS: Record<SegmentName, Segment> = {
  top: [7, 5, 21, 5],
  upperLeft: [6, 6, 6, 14],
  upperRight: [22, 6, 22, 14],
  mid: [8, 14, 20, 14],
  lowerLeft: [6, 14, 6, 22],
  lowerRight: [22, 14, 22, 22],
  bottom: [7, 23, 21, 23],
};

const DIGIT_SEGMENTS: readonly (readonly SegmentName[])[] = [
  ['top', 'upperLeft', 'upperRight', 'lowerLeft', 'lowerRight', 'bottom'],
  ['upperRight', 'lowerRight'],
  ['top', 'upperRight', 'mid', 'lowerLeft', 'bottom'],
  ['top', 'upperRight', 'mid', 'lowerRight', 'bottom'],
  ['upperLeft', 'upperRight', 'mid', 'lowerRight'],
  ['top', 'upperLeft', 'mid', 'lowerRight', 'bottom'],
  ['top', 'upperLeft', 'mid', 'lowerLeft', 'lowerRight', 'bottom'],
  ['top', 'upperRight', 'lowerRight'],
  ['top', 'upperLeft', 'upperRight', 'mid', 'lowerLeft', 'lowerRight', 'bottom'],
  ['top', 'upperLeft', 'upperRight', 'mid', 'lowerRight', 'bottom'],
];

let templateCache: number[][] | null = null;

function pixelIndex(x: number, y: number): number {
  return y * GRID_SIZE + x;
}

function distanceToSegment(x: number, y: number, [x1, y1, x2, y2]: Segment): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(x - px, y - py);
}

function addSegment(buffer: number[], segment: Segment): void {
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const distance = distanceToSegment(x + 0.5, y + 0.5, segment);
      const intensity = Math.max(0, 1 - distance / 2.35);
      if (intensity > 0) {
        const index = pixelIndex(x, y);
        buffer[index] = Math.max(buffer[index], intensity);
      }
    }
  }
}

function normalizeVector(values: number[]): number[] {
  const mag = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (mag === 0) return values;
  return values.map((value) => value / mag);
}

function getTemplates(): number[][] {
  if (templateCache) return templateCache;
  templateCache = DIGIT_SEGMENTS.map((segments) => {
    const buffer = new Array<number>(PIXELS).fill(0);
    for (const segmentName of segments) addSegment(buffer, SEGMENTS[segmentName]);
    return normalizeVector(buffer);
  });
  return templateCache;
}

function normalizeInput(pixels: number[]): number[] {
  const bounded = pixels.slice(0, PIXELS).map((value) => Math.max(0, Math.min(1, value)));
  while (bounded.length < PIXELS) bounded.push(0);

  let minX = GRID_SIZE;
  let minY = GRID_SIZE;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const value = bounded[pixelIndex(x, y)];
      if (value <= 0.04) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return new Array<number>(PIXELS).fill(0);
  }

  const out = new Array<number>(PIXELS).fill(0);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const value = bounded[pixelIndex(x, y)];
      if (value <= 0.02) continue;
      const nx = Math.round(TEMPLATE_MIN + ((x - minX) / width) * TEMPLATE_SPAN);
      const ny = Math.round(TEMPLATE_MIN + ((y - minY) / height) * TEMPLATE_SPAN);
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const tx = nx + ox;
          const ty = ny + oy;
          if (tx < 0 || ty < 0 || tx >= GRID_SIZE || ty >= GRID_SIZE) continue;
          const falloff = ox === 0 && oy === 0 ? 1 : 0.45;
          const index = pixelIndex(tx, ty);
          out[index] = Math.max(out[index], value * falloff);
        }
      }
    }
  }

  return normalizeVector(out);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < PIXELS; i += 1) dot += a[i] * b[i];
  return dot;
}

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exp = scores.map((score) => Math.exp((score - max) * 12));
  const total = exp.reduce((sum, value) => sum + value, 0);
  return exp.map((value) => value / total);
}

function buildHiddenActivations(scores: number[], normalized: number[]): number[] {
  const rowBins = new Array<number>(10).fill(0);
  const colBins = new Array<number>(10).fill(0);

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const value = normalized[pixelIndex(x, y)];
      rowBins[Math.min(9, Math.floor((y / GRID_SIZE) * 10))] += value;
      colBins[Math.min(9, Math.floor((x / GRID_SIZE) * 10))] += value;
    }
  }

  const normalizeBins = (bins: number[]) => {
    const max = Math.max(...bins, 1e-6);
    return bins.map((value) => value / max);
  };

  return [
    ...scores.map((score) => Math.max(0, Math.min(1, score))),
    ...normalizeBins(rowBins),
    ...normalizeBins(colBins),
  ];
}

export function classifyWithJsFallback(pixels: number[]): PredictionResponse {
  const t0 = performance.now();
  const normalized = normalizeInput(pixels);
  const templates = getTemplates();
  const scores = templates.map((template) => cosineSimilarity(normalized, template));
  const confidence = softmax(scores);
  const prediction = confidence.reduce(
    (best, value, digit) => (value > confidence[best] ? digit : best),
    0,
  );
  const inputGrad = templates[prediction].map((target, index) => target - normalized[index]);
  const t1 = performance.now();

  return {
    prediction,
    confidence,
    baseline_time_ms: 0,
    optimized_time_ms: t1 - t0,
    hidden_activations: buildHiddenActivations(scores, normalized),
    input_grad: inputGrad,
    source: 'browser-js-demo',
  };
}
