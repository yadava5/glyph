import type { Stroke, StrokePoint } from './strokeReducer';

/*
 * The fold's sample ink. These strokes run through the same
 * perfect-freehand pipeline as live pointer input, with simulatePressure
 * on — the renderer derives thick/thin from point SPACING, exactly as it
 * does for a real hand. The old sample was three sparse, evenly spaced
 * polylines, which that model renders as a uniform calligraphic ribbon:
 * a typeset glyph, on a page whose subject is handwriting. This one is
 * built the way a hand actually moves — dense samples through curves,
 * a quicker straight, a seeded wobble — so the ink reads as drawn.
 */

type Vec = readonly [number, number];

/**
 * Deterministic PRNG (mulberry32). The same ink every load keeps the
 * fold's verdict stable and gives visual tests a fixed subject; the
 * jitter only has to not repeat a machine line, not be random.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Catmull-Rom interpolation across one segment (p1 → p2) at t. */
function crPoint(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - 3 * c + d - a) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

/**
 * Turn a sparse guide polyline into hand-motion input: spline it, then
 * walk the arc with a variable step — shorter through curves (a hand
 * slows down, which simulatePressure renders as heavier ink), longer on
 * straights — and jitter every sample a little off the ideal path.
 */
function inkStroke(id: string, guide: readonly Vec[], random: () => number): Stroke {
  // Dense spline polyline first, so steps can be measured in arc length.
  const dense: [number, number][] = [];
  const SUBDIV = 24;
  for (let i = 0; i < guide.length - 1; i++) {
    const p0 = guide[Math.max(i - 1, 0)];
    const p3 = guide[Math.min(i + 2, guide.length - 1)];
    for (let s = 0; s < SUBDIV; s++) {
      dense.push(crPoint(p0, guide[i], guide[i + 1], p3, s / SUBDIV));
    }
  }
  dense.push([...guide[guide.length - 1]] as [number, number]);

  const points: StrokePoint[] = [];
  const JITTER = 1.25;
  let acc = 0;
  let target = 0;
  let t = 0;
  for (let i = 0; i < dense.length; i++) {
    if (i > 0) acc += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
    if (acc < target && i !== dense.length - 1) continue;

    points.push({
      x: dense[i][0] + (random() - 0.5) * 2 * JITTER,
      y: dense[i][1] + (random() - 0.5) * 2 * JITTER,
      pressure: 0.42 + random() * 0.25,
      t,
    });

    // Local turn angle over a ±4-sample window drives the step: tight
    // curve → short step (slow, heavy ink), straight → long step.
    const a = dense[Math.max(i - 4, 0)];
    const b = dense[i];
    const c = dense[Math.min(i + 4, dense.length - 1)];
    const turn = Math.abs(
      Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]),
    );
    const pace = Math.min(1.3, Math.max(0.5, 1.3 - 2.2 * Math.min(turn, Math.PI * 2 - turn)));
    target = acc + 7 * pace * (0.8 + 0.4 * random());
    t += 12 + random() * 14;
  }

  return { id, pointerType: 'mouse', points };
}

/* Two strokes, written the way a hand writes a five: the stem carried
 * into the open bowl in one motion, then the cap bar — which starts just
 * shy of the stem's origin, the registration miss of a real hand. */
const STEM_AND_BOWL: readonly Vec[] = [
  [119, 63],
  [113, 92],
  [108, 122],
  [112, 135],
  [136, 131],
  [162, 136],
  [188, 152],
  [199, 181],
  [192, 212],
  [163, 230],
  [126, 231],
  [99, 216],
  [90, 200],
];

const CAP_BAR: readonly Vec[] = [
  [117, 60],
  [143, 55],
  [171, 53],
  [197, 56],
];

export function createSampleDigitFive(): Stroke[] {
  const stamp = Date.now().toString(36);
  const random = rng(0x5eed5);

  return [
    inkStroke(`sample-five-stem-bowl-${stamp}`, STEM_AND_BOWL, random),
    inkStroke(`sample-five-cap-${stamp}`, CAP_BAR, random),
  ];
}
