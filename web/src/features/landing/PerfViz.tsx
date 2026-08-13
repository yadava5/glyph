import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import {
  accuracyWaffle,
  crossoverSeries,
  gflopsSeries,
  laneScale,
  simdCensus,
} from '../performance/benchmarkData';
import type { MnistDemoController } from '../mnist/useMnistDemoController';
import { Decode, RollingNumber } from './interactions';
import { useInView } from './interactionHooks';
import styles from './PerfViz.module.css';

/* ───────────────────────── helpers ───────────────────────── */

const log2 = (n: number) => Math.log(n) / Math.LN2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** ns → the smallest legible unit, matching the committed BENCHMARKS.md style. */
function fmtTime(ns: number): string {
  if (ns < 1000) return `${Math.round(ns)}ns`;
  if (ns < 1e6) return `${(ns / 1000).toFixed(ns < 10000 ? 1 : 0)}µs`;
  return `${(ns / 1e6).toFixed(2)}ms`;
}

/*
 * Colour is semantic everywhere on this page: steel = the single-thread
 * baseline, violet = the toolchain quantity (OpenMP + native codegen),
 * green = a win, amber = a loss, sky = the live wasm path. All three
 * crossover series plot the SAME violet quantity (omp ÷ single), so they
 * differ by tint and carry their names at the line ends — series identity
 * comes from direct labels, not from spending a semantic hue per family.
 */
const SERIES_INK: Record<string, string> = {
  matmul: 'rgb(167 139 250 / 0.95)',
  transpose: 'rgb(167 139 250 / 0.6)',
  axpy: 'rgb(167 139 250 / 0.34)',
};

/* ─────────────── 1 · crossover scatter / line ─────────────── */

interface Hovered {
  op: string;
  size: number;
  unit: string;
  singleNs: number;
  ompNs: number;
  speedup: number;
  cx: number;
  cy: number;
}

/**
 * The crossover, drawn to scale: single-thread ÷ openmp+native speedup versus
 * per-op size, on a log-size axis. The break-even line is 1.0×; everything in
 * the shaded band below it is where OpenMP LOSES — kept on the record, not
 * hidden. Hover or focus any point for its exact op + timings. Every value is
 * derived from the committed reference run.
 */
export function CrossoverChart() {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>('0px 0px -14% 0px');
  const [hover, setHover] = useState<Hovered | null>(null);

  const W = 720;
  const H = 400;
  const m = { l: 46, r: 18, t: 22, b: 52 };
  const plotW = W - m.l - m.r;
  const plotH = H - m.t - m.b;
  const xMin = 5; // log2(32)
  const xMax = 10; // log2(1024)
  /* Scaled to the data, not to a remembered maximum. A literal here (3.7) had
     already been outgrown by the reference run's transpose 1024 at 3.92×, so
     the best result in the suite would have been clamped onto the frame. */
  const peak = Math.max(...crossoverSeries.flatMap((s) => s.points.map((p) => p.speedup)));
  const yMax = Math.ceil((peak + 0.25) * 2) / 2;

  const xOf = (size: number) => m.l + ((log2(size) - xMin) / (xMax - xMin)) * plotW;
  const yOf = (v: number) => m.t + (1 - clamp(v, 0, yMax) / yMax) * plotH;

  const yBreak = yOf(1);
  const xTicks = [32, 64, 128, 256, 512, 1024];
  const yTicks = Array.from({ length: Math.floor(yMax) + 1 }, (_, i) => i);

  return (
    <figure className={styles.chartCard} ref={ref} data-draw={inView && !reduced ? '' : undefined}>
      <figcaption className={styles.chartHead}>
        <div>
          <span className={styles.chartEyebrow}>the crossover · single-thread ÷ openmp+native</span>
          <h4 className={styles.chartTitle}>Where threads start to pay — and where they cost</h4>
        </div>
        <span className={styles.chartKey} aria-hidden>
          <i data-tone="win" /> wins · <i data-tone="loss" /> losses
        </span>
      </figcaption>

      <div className={styles.chartWrap}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.chartSvg}
          role="img"
          aria-label="Crossover chart: OpenMP speedup versus operation size for matmul, transpose and axpy. Below 1.0x, OpenMP is slower than a single thread."
        >
          {/* loss band (speedup < 1.0) */}
          <rect
            x={m.l}
            y={yBreak}
            width={plotW}
            height={m.t + plotH - yBreak}
            className={styles.lossBand}
          />
          <text x={m.l + 8} y={m.t + plotH - 10} className={styles.lossLabel}>
            OpenMP loses here — thread startup &gt; the work
          </text>

          {/* y grid + ticks */}
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={m.l} y1={yOf(v)} x2={W - m.r} y2={yOf(v)} className={styles.grid} />
              <text x={m.l - 10} y={yOf(v) + 4} className={styles.axisText} textAnchor="end">
                {v}×
              </text>
            </g>
          ))}
          {/* break-even emphasis */}
          <line x1={m.l} y1={yBreak} x2={W - m.r} y2={yBreak} className={styles.breakEven} />
          <text x={W - m.r} y={yBreak - 7} className={styles.breakLabel} textAnchor="end">
            break-even 1.0×
          </text>

          {/* x ticks */}
          {xTicks.map((s) => (
            <text
              key={`x${s}`}
              x={xOf(s)}
              y={H - m.b + 22}
              className={styles.axisText}
              textAnchor="middle"
            >
              {s}
            </text>
          ))}
          <text x={m.l + plotW / 2} y={H - 8} className={styles.axisLabel} textAnchor="middle">
            per-op size (log scale)
          </text>

          {/* series — one violet quantity, three tints, named at the line end */}
          {crossoverSeries.map((s) => {
            const pts = [...s.points].sort((a, b) => a.size - b.size);
            const d = pts
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.size)} ${yOf(p.speedup)}`)
              .join(' ');
            const last = pts[pts.length - 1];
            /* A line ending near break-even would put its name on top of the
               amber "break-even 1.0×" caption — drop that label into the loss
               band instead, where its line actually lives. */
            const nearBreakEven = Math.abs(last.speedup - 1) < 0.3;
            return (
              <g key={s.id}>
                <path
                  d={d}
                  className={styles.series}
                  pathLength={1}
                  style={{ stroke: SERIES_INK[s.id] }}
                />
                <text
                  x={xOf(last.size) - 2}
                  y={yOf(last.speedup) + (nearBreakEven ? 24 : -11)}
                  className={styles.seriesLabel}
                  textAnchor="end"
                  style={{ fill: SERIES_INK[s.id] }}
                >
                  {s.id}
                </text>
              </g>
            );
          })}

          {/* points (hover / focus) */}
          {crossoverSeries.map((s) =>
            s.points.map((p) => {
              const cx = xOf(p.size);
              const cy = yOf(p.speedup);
              const loses = p.speedup < 1;
              return (
                <circle
                  key={`${s.id}-${p.size}`}
                  cx={cx}
                  cy={cy}
                  r={5.5}
                  className={styles.dot}
                  data-loses={loses || undefined}
                  style={{
                    stroke: loses ? 'var(--amber)' : 'var(--green)',
                    color: loses ? 'var(--amber)' : 'var(--green)',
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${s.label} ${p.size}: single thread ${fmtTime(
                    p.singleNs,
                  )}, openmp+native ${fmtTime(p.ompNs)}, ${p.speedup.toFixed(2)} times ${
                    loses ? 'slower' : 'faster'
                  }`}
                  onMouseEnter={() =>
                    setHover({
                      op: s.label,
                      size: p.size,
                      unit: s.unit,
                      singleNs: p.singleNs,
                      ompNs: p.ompNs,
                      speedup: p.speedup,
                      cx,
                      cy,
                    })
                  }
                  onMouseLeave={() => setHover(null)}
                  onFocus={() =>
                    setHover({
                      op: s.label,
                      size: p.size,
                      unit: s.unit,
                      singleNs: p.singleNs,
                      ompNs: p.ompNs,
                      speedup: p.speedup,
                      cx,
                      cy,
                    })
                  }
                  onBlur={() => setHover(null)}
                />
              );
            }),
          )}

          {/* tooltip */}
          {hover &&
            (() => {
              const boxW = 176;
              const boxH = 62;
              const bx = clamp(hover.cx - boxW / 2, m.l, W - m.r - boxW);
              const above = hover.cy - boxH - 14 > m.t;
              const by = above ? hover.cy - boxH - 14 : hover.cy + 14;
              return (
                <g className={styles.tip} pointerEvents="none">
                  <rect x={bx} y={by} width={boxW} height={boxH} rx={8} />
                  <text x={bx + 12} y={by + 20} className={styles.tipOp}>
                    {hover.op} · {hover.unit}={hover.size}
                  </text>
                  <text x={bx + 12} y={by + 38} className={styles.tipRow}>
                    {fmtTime(hover.singleNs)} → {fmtTime(hover.ompNs)}
                  </text>
                  <text
                    x={bx + boxW - 12}
                    y={by + 38}
                    className={styles.tipVal}
                    textAnchor="end"
                    style={{ fill: hover.speedup < 1 ? 'var(--amber)' : 'var(--green)' }}
                  >
                    {hover.speedup.toFixed(2)}× {hover.speedup < 1 ? 'slower' : 'faster'}
                  </text>
                  <text x={bx + 12} y={by + 54} className={styles.tipHint}>
                    {hover.speedup < 1
                      ? 'kept honest — OpenMP off below threshold'
                      : 'OpenMP earns its threads'}
                  </text>
                </g>
              );
            })()}
        </svg>
      </div>
      <p className={styles.chartFoot}>
        Each op crosses 1.0× at its own size — the tuned <code>if (…&gt;= 4096)</code> threshold
        lives in the code, not on a slide. Hover a point for the measured pair.
      </p>
    </figure>
  );
}

/* ─────────────── 2 · GFLOP/s slope ─────────────── */

/** matmul throughput: single-thread stays cache-bound while openmp+native climbs to 24.3 GFLOP/s. */
export function GflopsSlope() {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>('0px 0px -14% 0px');
  const [hover, setHover] = useState<{ x: number; y: number; label: string; val: number } | null>(
    null,
  );

  const pts = gflopsSeries.points;
  const W = 340;
  const H = 272;
  const m = { l: 38, r: 16, t: 20, b: 52 };
  const plotW = W - m.l - m.r;
  const plotH = H - m.t - m.b;
  /* Same rule as the crossover chart: the frame follows the data. */
  const yMax = Math.ceil((gflopsSeries.peakValue + 1.5) / 2) * 2;
  const xOf = (size: number) => m.l + ((log2(size) - 5) / (8 - 5)) * plotW;
  const yOf = (v: number) => m.t + (1 - v / yMax) * plotH;

  const lineOf = (key: 'single' | 'omp') =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.size)} ${yOf(p[key])}`).join(' ');

  return (
    <figure className={styles.slopeCard} ref={ref} data-draw={inView && !reduced ? '' : undefined}>
      <figcaption className={styles.chartHead}>
        <div>
          <span className={styles.chartEyebrow}>matmul · GFLOP/s ({gflopsSeries.flops})</span>
          <h4 className={styles.chartTitle}>The payoff slope</h4>
        </div>
      </figcaption>
      <div className={styles.chartWrap}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.chartSvg}
          role="img"
          aria-label={`matmul GFLOP/s: single-thread stays near 7-10 while openmp+native climbs to ${gflopsSeries.peak}`}
        >
          {Array.from({ length: Math.floor(yMax / 8) + 1 }, (_, i) => i * 8).map((v) => (
            <g key={v}>
              <line x1={m.l} y1={yOf(v)} x2={W - m.r} y2={yOf(v)} className={styles.grid} />
              <text x={m.l - 8} y={yOf(v) + 4} className={styles.axisText} textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {[32, 64, 128, 256].map((s) => (
            <text
              key={s}
              x={xOf(s)}
              y={H - m.b + 20}
              className={styles.axisText}
              textAnchor="middle"
            >
              {s}
            </text>
          ))}
          {/* The left chart titles its x-axis; so does this one. */}
          <text x={m.l + plotW / 2} y={H - 8} className={styles.axisLabel} textAnchor="middle">
            matrix size N (log scale)
          </text>
          <path
            d={lineOf('single')}
            className={styles.series}
            pathLength={1}
            style={{ stroke: 'var(--steel)' }}
          />
          <path
            d={lineOf('omp')}
            className={styles.series}
            pathLength={1}
            style={{ stroke: 'var(--violet-sig)' }}
          />
          {/* direct labels — same convention as the crossover chart */}
          <text
            x={xOf(pts[pts.length - 1].size) - 2}
            y={yOf(pts[pts.length - 1].single) + 18}
            className={styles.seriesLabel}
            textAnchor="end"
            style={{ fill: 'var(--steel)' }}
          >
            single thread
          </text>
          <text
            x={xOf(pts[pts.length - 1].size) - 2}
            y={yOf(pts[pts.length - 1].omp) + 26}
            className={styles.seriesLabel}
            textAnchor="end"
            style={{ fill: 'var(--violet-sig)' }}
          >
            openmp + native
          </text>
          {(['single', 'omp'] as const).map((key) =>
            pts.map((p) => (
              <circle
                key={`${key}-${p.size}`}
                cx={xOf(p.size)}
                cy={yOf(p[key])}
                r={4.5}
                className={styles.dot}
                style={{
                  stroke: key === 'omp' ? 'var(--violet-sig)' : 'var(--steel)',
                  color: key === 'omp' ? 'var(--violet-sig)' : 'var(--steel)',
                }}
                tabIndex={0}
                role="button"
                aria-label={`${key === 'omp' ? 'openmp+native' : 'single thread'} at N=${p.size}: ${p[key]} GFLOP/s`}
                onMouseEnter={() =>
                  setHover({
                    x: xOf(p.size),
                    y: yOf(p[key]),
                    label: `${key === 'omp' ? 'omp+native' : 'single'} · N=${p.size}`,
                    val: p[key],
                  })
                }
                onMouseLeave={() => setHover(null)}
                onFocus={() =>
                  setHover({
                    x: xOf(p.size),
                    y: yOf(p[key]),
                    label: `${key === 'omp' ? 'omp+native' : 'single'} · N=${p.size}`,
                    val: p[key],
                  })
                }
                onBlur={() => setHover(null)}
              />
            )),
          )}
          <text
            x={xOf(pts[pts.length - 1].size)}
            y={yOf(pts[pts.length - 1].omp) - 12}
            className={styles.peakLabel}
            textAnchor="end"
          >
            {gflopsSeries.peak}
          </text>
          {hover && (
            <g pointerEvents="none" className={styles.tip}>
              <rect
                x={clamp(hover.x - 60, m.l, W - m.r - 120)}
                y={clamp(hover.y - 34, m.t, H)}
                width={120}
                height={24}
                rx={6}
              />
              <text
                x={clamp(hover.x - 60, m.l, W - m.r - 120) + 10}
                y={clamp(hover.y - 34, m.t, H) + 16}
                className={styles.tipRow}
              >
                {hover.label}: <tspan className={styles.tipVal}>{hover.val} GF/s</tspan>
              </text>
            </g>
          )}
        </svg>
      </div>
    </figure>
  );
}

/* ─────────────── 3 · live throughput gauge ─────────────── */

function polar(cx: number, cy: number, r: number, frac: number) {
  // top semicircle: frac 0 → left (180°), frac 1 → right (0°)
  const theta = Math.PI * (1 - frac);
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
}

/**
 * A live dial: the scalar → simd128 speedup, measured in wasm on the visitor's
 * own machine (median over the session). The needle sweeps to the live value;
 * a secondary readout shows the single-image throughput. Idle until the bench
 * has run — the workbench above auto-runs a sample when it scrolls into view.
 */
export function ThroughputGauge({ controller }: { controller: MnistDemoController }) {
  const t = controller.timing;
  const speedup = t?.speedup ?? null;
  const live = speedup !== null && speedup > 0;
  const max = 6;
  const frac = live ? clamp(speedup / max, 0, 1) : 0;

  const cx = 150;
  const cy = 150;
  const r = 116;
  const start = polar(cx, cy, r, 0);
  const end = polar(cx, cy, r, 1);
  const valEnd = polar(cx, cy, r, frac);
  // needle rests pointing left (frac 0) and rotates clockwise to the value —
  // a CSS transform so the sweep transitions smoothly (reduced-motion: instant).
  const needleDeg = (live ? frac : 0.02) * 180;

  const imgPerSec = t && t.p50OptimizedMs > 0 ? Math.round(1000 / t.p50OptimizedMs) : null;

  return (
    <figure className={styles.gaugeCard}>
      <figcaption className={styles.chartHead}>
        <div>
          <span className={styles.chartEyebrow}>live · your machine</span>
          <h4 className={styles.chartTitle}>simd128 vs scalar, right now</h4>
        </div>
        <span className={styles.gaugePulse} data-live={live || undefined} aria-hidden />
      </figcaption>

      <div className={styles.gaugeWrap}>
        <svg
          viewBox="0 0 300 202"
          className={styles.gaugeSvg}
          role="img"
          aria-label={
            live
              ? `Live speedup ${speedup!.toFixed(2)} times`
              : 'Live gauge idle — draw a digit to measure'
          }
        >
          {/* track */}
          <path
            d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
            className={styles.gaugeTrack}
          />
          {/* ticks 0..6 */}
          {[0, 1, 2, 3, 4, 5, 6].map((v) => {
            const f = v / max;
            const a = polar(cx, cy, r + 2, f);
            const b = polar(cx, cy, r - 9, f);
            return (
              <g key={v}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={styles.gaugeTick}
                  data-break={v === 1 || undefined}
                />
                <text
                  {...polar(cx, cy, r - 22, f)}
                  className={styles.gaugeTickText}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {v}
                </text>
              </g>
            );
          })}
          {/* value arc — sweeps from frac 0 (left) to `frac`, so it always spans
              frac×180° ≤ 180°: the large-arc-flag is ALWAYS 0 (the minor arc over
              the top). A conditional flag draws the major arc the long way round
              the bottom, which the 300×190 viewBox then clips into fragments. */}
          {live && (
            <path
              d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${valEnd.x} ${valEnd.y}`}
              className={styles.gaugeValue}
            />
          )}
          {/* needle */}
          <line
            x1={cx}
            y1={cy}
            x2={cx - r * 0.82}
            y2={cy}
            className={styles.gaugeNeedle}
            data-live={live || undefined}
            style={
              {
                transform: `rotate(${needleDeg}deg)`,
                transformOrigin: `${cx}px ${cy}px`,
                transformBox: 'view-box',
              } as React.CSSProperties
            }
          />
          <circle cx={cx} cy={cy} r={6} className={styles.gaugeHub} />
          {/* The readout sits BELOW the hub, outside the needle's sweep — the
              old cy−30 position put it exactly where the needle points at ~3×,
              and its 1-decimal rounding disagreed with the 2-decimal stat
              underneath (2.7× over 2.68×). One position, one precision. */}
          <text x={cx} y={cy + 38} className={styles.gaugeBig} textAnchor="middle">
            {live ? `${speedup!.toFixed(2)}×` : '—'}
          </text>
        </svg>
      </div>

      {/* Idle figures are an em-dash, everywhere — the one hint line below
          names the action instead of three cells inventing three phrasings. */}
      <dl className={styles.gaugeReadout}>
        <div>
          <dt>median speedup</dt>
          <dd className="tabular">{live ? `${speedup!.toFixed(2)}×` : '—'}</dd>
        </div>
        <div>
          <dt>simd128 forward pass</dt>
          <dd className="tabular">
            {t
              ? `${t.p50OptimizedMs < 0.1 ? Math.round(t.p50OptimizedMs * 1000) + 'µs' : t.p50OptimizedMs.toFixed(2) + 'ms'} · n=${t.n}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>throughput</dt>
          <dd className="tabular">
            {imgPerSec ? `≈ ${imgPerSec.toLocaleString('en-US')} img/s` : '—'}
          </dd>
        </div>
      </dl>
      {!live && (
        <p className={styles.gaugeIdleHint}>idle — draw in the bench at the top to arm the dial</p>
      )}
    </figure>
  );
}

/* ─────────────── 4 · per-ISA lane scale ─────────────── */

/**
 * The same dot product, and how many f64 lanes each target lights per
 * instruction — scalar's lone lane against the four hand-written SIMD rungs.
 * On scroll-in the lanes fill left-to-right, like vectors streaming through;
 * the wasm rung (the one live on this page) keeps a soft idle shimmer.
 */
export function LaneScale() {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>('0px 0px -12% 0px');
  const lit = reduced || inView;

  return (
    <div className={styles.laneScale} ref={ref}>
      <div className={styles.laneScaleHead}>
        <span className={styles.chartEyebrow}>lanes per FMA · f64</span>
        <h4 className={styles.chartTitle}>One instruction, one to eight multiply-adds</h4>
      </div>
      <ul
        className={styles.laneRowsScale}
        data-lit={lit || undefined}
        data-reduced={reduced || undefined}
      >
        {laneScale.map((row, ri) => (
          <li key={row.id} className={styles.laneScaleRow} data-tone={row.tone}>
            <span className={styles.laneScaleName}>
              <b>{row.name}</b>
              <em>
                {row.width} · {row.where}
              </em>
            </span>
            <div
              className={styles.laneScaleCells}
              role="img"
              aria-label={`${row.name}: ${row.lanes} lane${row.lanes > 1 ? 's' : ''}`}
            >
              {Array.from({ length: 8 }, (_, i) => (
                <i
                  key={i}
                  data-on={i < row.lanes || undefined}
                  data-hot={row.tone === 'live' || undefined}
                  style={{ '--d': `${ri * 120 + i * 70}ms` } as React.CSSProperties}
                />
              ))}
            </div>
            <b className={styles.laneScaleMult}>×{row.lanes}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────── 5 · accuracy waffle ─────────────── */

/**
 * The model's real MNIST test-set result. This was a second hand-typed copy of
 * the figures in benchmarkData.ts — the same defect, three lines long, that the
 * whole benchRuns.generated.ts pipeline exists to stop. It reads the one record
 * now, and the percentage is derived from the counts rather than stated beside
 * them, so the three numbers cannot disagree.
 */
const TEST_SET_RESULT = {
  total: accuracyWaffle.total,
  correct: accuracyWaffle.correct,
  missed: accuracyWaffle.errors,
  pct: (accuracyWaffle.correct / accuracyWaffle.total) * 100,
};

/**
 * The MNIST test-set result, as a single count-up on the model's real 97.01%
 * figure (measured, not invented — and consistent with the hero). On every
 * scroll-in the count-up replays and a left-to-right glow sweeps across just the
 * digits. `useInView` fires only once, so a local observer tracks the rising
 * edge and bumps a `run` key to re-fire the count-up on each re-entry.
 * Reduced-motion settles on the value with no roll and no sweep.
 */
export function AccuracyWaffle() {
  const [run, setRun] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const inside = useRef(false);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !inside.current) {
            inside.current = true;
            setRun((r) => r + 1);
          } else if (!e.isIntersecting) {
            inside.current = false;
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.2 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <div className={styles.waffle} ref={cardRef}>
      <div className={styles.waffleMeta}>
        <span className={styles.chartEyebrow}>test accuracy · 10,000 MNIST test digits</span>
        <div className={styles.waffleBig}>
          <RollingNumber
            key={`c${run}`}
            value={TEST_SET_RESULT.correct}
            className={styles.waffleCount}
            glow
          />
          <span className={styles.waffleSlash}>/ 10,000</span>
        </div>
        <p className={styles.wafflePct}>
          <RollingNumber key={`p${run}`} value={TEST_SET_RESULT.pct} decimals={2} suffix="%" glow />{' '}
          correct ·{' '}
          <b>
            {/* Counts DOWN from the total so the pair is never self-contradictory
                mid-roll — see RollingNumber's `from`. */}
            <RollingNumber
              key={`m${run}`}
              value={TEST_SET_RESULT.missed}
              from={TEST_SET_RESULT.total}
            />
          </b>{' '}
          missed
        </p>
        {/* The caveat lived in README.md, the System Card and a source comment,
            but not on the page that shows the number to the most people. */}
        <p className={styles.waffleCaveat}>
          Read this as the <b>best epoch</b>, not a clean held-out estimate.{' '}
          <code>apps/train_model.cpp</code> scores the network on this same set after every epoch
          and keeps the checkpoint only when that score improves, and the repository ships no
          validation split — so the set reporting the figure also selected the weights.
        </p>
      </div>
    </div>
  );
}

/* ─────────────── 6 · the artifact census ─────────────── */

/*
 * The disassembly census of the exact wasm module this page executes:
 * function and vector-instruction counts, the opcode histogram, and the
 * unrolled dual-accumulator signature — all read out of the committed
 * binary by tools/gen_web_facts.py, never typed. `namesStripped` is why
 * nothing here claims a count for a *named* function: the module ships
 * no names, so counts are per-module, full stop.
 */
export function SimdCensusPanel() {
  const shownOps = simdCensus.opcodes.slice(0, 8);
  const restOps = simdCensus.opcodes.slice(8);
  const restCount = restOps.reduce((sum, o) => sum + o.count, 0);
  const maxOp = simdCensus.opcodes[0].count;

  return (
    <div className={styles.census}>
      <div className={styles.censusIntro}>
        <span className={styles.chartEyebrow}>glyph.wasm · disassembly census</span>
        <p className={styles.censusHeadline}>
          <Decode
            text={`The whole optimisation is ${simdCensus.vectorInstructions} instructions.`}
          />
        </p>
        <p className={styles.censusProse}>
          Disassemble the module and count. Of{' '}
          <b className="tabular">{simdCensus.totalFunctions}</b> functions,{' '}
          <b className="tabular">{simdCensus.vectorFunctions}</b> touch a vector instruction —{' '}
          <b className="tabular">{simdCensus.vectorInstructions}</b> in total. That is the entire
          hand-written speedup, in a module you already ran.
        </p>

        <div
          className={styles.censusStrip}
          role="img"
          aria-label={`${simdCensus.vectorFunctions} of ${simdCensus.totalFunctions} functions contain vector instructions`}
        >
          {Array.from({ length: simdCensus.totalFunctions }, (_, i) => (
            <i key={i} data-hot={i < simdCensus.vectorFunctions || undefined} />
          ))}
        </div>
        <span className={styles.censusStripNote}>
          {simdCensus.vectorFunctions} of {simdCensus.totalFunctions} functions — counts, not
          positions; the module ships no function names
        </span>

        <div className={styles.censusSig}>
          <span className={styles.chartEyebrow}>the inner loop, found in the binary</span>
          <div
            className={styles.censusChain}
            role="img"
            aria-label={`The sequence ${simdCensus.signature.join(', then ')} appears ${simdCensus.signatureHits} times`}
          >
            {simdCensus.signature.map((op, i) => (
              <span key={op} className={styles.censusChainStep}>
                {i > 0 && <i aria-hidden>→</i>}
                <code>{op}</code>
              </span>
            ))}
            <b className="tabular">×{simdCensus.signatureHits}</b>
          </div>
          <p>
            The dual-accumulator dot product, unrolled ×2 — the same shape as the AVX-512 kernel
            above, surviving compilation intact.
          </p>
        </div>
      </div>

      <div className={styles.censusSide}>
        <div className={styles.censusHisto}>
          <span className={styles.chartEyebrow}>
            vector opcodes · all {simdCensus.vectorInstructions}
          </span>
          <ul>
            {shownOps.map((o) => (
              <li key={o.op}>
                <code>{o.op}</code>
                <span className={styles.censusHistoTrack}>
                  <i style={{ width: `${(o.count / maxOp) * 100}%` }} />
                </span>
                <b className="tabular">{o.count}</b>
              </li>
            ))}
            {restCount > 0 && (
              <li data-rest>
                <code>{restOps.length} more opcodes</code>
                <span className={styles.censusHistoTrack}>
                  <i style={{ width: `${(restCount / maxOp) * 100}%` }} data-rest />
                </span>
                <b className="tabular">{restCount}</b>
              </li>
            )}
          </ul>
        </div>

        <div className={styles.censusCustody}>
          <span className={styles.chartEyebrow}>chain of custody</span>
          <p>
            <code>sha256 {simdCensus.moduleSha256.slice(0, 12)}…</code> — CI rebuilds this module
            from source at a pinned emsdk on linux/amd64 <em>and</em> macos/arm64, and fails unless
            the bytes match. Source → binary → browser, closed.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── 7 · the failure map ─────────────── */

interface FailureEntry {
  index: number;
  true: number;
  pred: number;
  predActivation: number;
  trueActivation: number;
}

/** One failing digit, drawn from the packed bytes. Real MNIST ink. */
function FailureDigit({
  pack,
  packIndex,
  entry,
}: {
  pack: Uint8Array;
  packIndex: number;
  entry: FailureEntry;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(28, 28);
    const base = packIndex * 784;
    for (let i = 0; i < 784; i += 1) {
      const v = pack[base + i];
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = v > 0 ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
  }, [pack, packIndex]);

  return (
    <canvas
      ref={canvasRef}
      width={28}
      height={28}
      className={styles.failureDigit}
      role="img"
      aria-label={`Test digit ${entry.index}: a ${entry.true} read as ${entry.pred}`}
      title={`test #${entry.index} — read as ${entry.pred} (${(entry.predActivation * 100).toFixed(0)}%), true ${entry.true} (${(entry.trueActivation * 100).toFixed(0)}%)`}
    />
  );
}

/*
 * All 299 misses, as a true→predicted map. Counts come from the committed
 * failure manifest (web/public/failures/misclassified.json, CI-pinned to
 * benchmarks/mnist_misclassified.csv); selecting a cell fetches the 234 kB
 * image pack once and shows the actual digits the model got wrong. Nothing
 * is bundled — a reader pays for the failures only by asking to see them.
 */
export function FailureMap() {
  const { ref, inView } = useInView<HTMLDivElement>('0px 0px -10% 0px');
  const [entries, setEntries] = useState<FailureEntry[] | null>(null);
  const [pack, setPack] = useState<Uint8Array | null>(null);
  const [sel, setSel] = useState<{ t: number; p: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const packRequested = useRef(false);

  useEffect(() => {
    if (!inView || entries !== null || failed) return;
    let alive = true;
    fetch('/failures/misclassified.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((j) => {
        if (alive) setEntries(j.entries as FailureEntry[]);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [inView, entries, failed]);

  const counts = useMemo(() => {
    const c = Array.from({ length: 10 }, () => new Array<number>(10).fill(0));
    entries?.forEach((e) => {
      c[e.true][e.pred] += 1;
    });
    return c;
  }, [entries]);

  const maxCount = Math.max(1, ...counts.flat());
  const worst = useMemo(() => {
    let best = { t: 0, p: 0, n: 0 };
    counts.forEach((row, t) =>
      row.forEach((n, p) => {
        if (t !== p && n > best.n) best = { t, p, n };
      }),
    );
    return best;
  }, [counts]);

  const selectCell = (t: number, p: number) => {
    setSel((cur) => (cur && cur.t === t && cur.p === p ? null : { t, p }));
    if (!packRequested.current) {
      packRequested.current = true;
      fetch('/failures/misclassified.bin')
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((b) => setPack(new Uint8Array(b)))
        .catch(() => setFailed(true));
    }
  };

  const selected = sel
    ? (entries ?? [])
        .map((e, packIndex) => ({ e, packIndex }))
        .filter(({ e }) => e.true === sel.t && e.pred === sel.p)
    : [];

  return (
    <div className={styles.failureMap} ref={ref}>
      <div className={styles.failureHead}>
        <span className={styles.chartEyebrow}>the 299 · true → predicted</span>
        <h4 className={styles.chartTitle}>Where the misses live</h4>
      </div>

      {failed ? (
        <p className={styles.failureFallback}>
          The failure pack could not be fetched. The full list — every miss with its true label,
          prediction and both activations — is committed as{' '}
          <code>benchmarks/mnist_misclassified.csv</code>.
        </p>
      ) : (
        <>
          <div
            className={styles.failureGrid}
            role="grid"
            aria-label="Confusion map of the 299 misclassified test digits"
          >
            <span className={styles.failureCorner} aria-hidden>
              t\p
            </span>
            {Array.from({ length: 10 }, (_, p) => (
              <span key={`h${p}`} className={styles.failureAxis} aria-hidden>
                {p}
              </span>
            ))}
            {counts.map((row, t) => (
              <Fragment key={`r${t}`}>
                <span className={styles.failureAxis} aria-hidden>
                  {t}
                </span>
                {row.map((n, p) =>
                  t === p ? (
                    <span key={`${t}-${p}`} className={styles.failureDiag} aria-hidden>
                      ·
                    </span>
                  ) : n === 0 ? (
                    <span key={`${t}-${p}`} className={styles.failureZero} aria-hidden />
                  ) : (
                    <button
                      key={`${t}-${p}`}
                      type="button"
                      className={styles.failureCell}
                      style={{ '--heat': (n / maxCount).toFixed(2) } as React.CSSProperties}
                      data-active={(sel && sel.t === t && sel.p === p) || undefined}
                      aria-label={`True ${t} predicted ${p}: ${n} ${n === 1 ? 'miss' : 'misses'}. Show the digits.`}
                      onClick={() => selectCell(t, p)}
                    >
                      <span className="tabular">{n}</span>
                    </button>
                  ),
                )}
              </Fragment>
            ))}
          </div>

          <p className={styles.failureNote}>
            {entries === null ? (
              'reading the committed failure manifest…'
            ) : sel ? (
              <>
                <b className="tabular">
                  {sel.t} → {sel.p}
                </b>{' '}
                · {counts[sel.t][sel.p]} of the 299 — hover a digit for its activations
              </>
            ) : (
              <>
                worst cell:{' '}
                <b className="tabular">
                  {worst.t} → {worst.p}
                </b>{' '}
                ({worst.n} times). Select any lit cell to see the actual digits.
              </>
            )}
          </p>

          {sel && (
            <div className={styles.failureStripRow} aria-live="polite">
              {pack === null ? (
                <span className={styles.failureFetching}>fetching the failure pack (234 kB)…</span>
              ) : (
                selected.map(({ e, packIndex }) => (
                  <FailureDigit key={e.index} pack={pack} packIndex={packIndex} entry={e} />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
