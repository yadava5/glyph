import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useReducedMotion } from 'motion/react';
import {
  accuracyWaffle,
  crossoverSeries,
  gflopsSeries,
  laneScale,
  recordLedger,
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
          {/* "median" is only earned once there is more than one input to
              take a median over. Before that the dial is showing a single
              measurement — a real one, but not a median of anything. */}
          <dt>{t && t.n > 1 ? 'median speedup' : 'speedup'}</dt>
          <dd className="tabular">{live ? `${speedup!.toFixed(2)}×` : '—'}</dd>
        </div>
        <div>
          <dt>simd128 forward pass</dt>
          {/* n counts classifications; each is itself a mean over the C++
              harness's adaptive iteration count, so the honest scale of the
              evidence is the summed run count, not n. */}
          <dd className="tabular">
            {t
              ? `${t.p50OptimizedMs < 0.1 ? Math.round(t.p50OptimizedMs * 1000) + 'µs' : t.p50OptimizedMs.toFixed(2) + 'ms'} · ${t.kernelRuns.toLocaleString('en-US')} runs`
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

/* ─────────────── 3b · the read race ─────────────── */

const RASTER = 28;
const EDGE_SCALAR = 'rgb(148 163 184)'; // steel — the lanes-off baseline
const EDGE_SIMD = 'rgb(56 189 248)'; // sky — the live wasm kernel

/** Sub-0.1ms medians render as µs — the same rule the gauge readout uses. */
const fmtPaneMs = (ms: number) => (ms < 0.1 ? `${Math.round(ms * 1000)}µs` : `${ms.toFixed(2)}ms`);

/** The visitor's 784-value input, painted once as full ink on an offscreen. */
function paintInk(off: HTMLCanvasElement, pixels: number[]) {
  const ctx = off.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(RASTER, RASTER);
  for (let i = 0; i < RASTER * RASTER; i += 1) {
    const v = Math.round(clamp(pixels[i] ?? 0, 0, 1) * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = v > 0 ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
}

/** One frame of a pane: dim ink ahead of the read-head, full ink behind it. */
function paintPane(canvas: HTMLCanvasElement, off: HTMLCanvasElement, frac: number, edge: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, RASTER, RASTER);
  ctx.globalAlpha = 0.15;
  ctx.drawImage(off, 0, 0);
  const cols = Math.round(frac * RASTER);
  if (cols > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cols, RASTER);
    ctx.clip();
    ctx.globalAlpha = 1;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }
  if (frac > 0 && frac < 1) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = edge;
    ctx.fillRect(cols, 0, 1, RASTER);
  }
  ctx.globalAlpha = 1;
}

/**
 * The dial's number, made visible as an event: the visitor's own raster read
 * twice, by a read-head sweeping at the two measured medians. Absolute pace is
 * stretched to watchable speed — the RATIO between the sweeps is the live
 * measurement, never a typed figure. Two sweeps per arming, then the panes
 * rest at full ink; reduced-motion renders the rested state with the figures.
 */
export function ReadRace({ controller }: { controller: MnistDemoController }) {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLElement>('0px 0px -14% 0px');
  const scalarRef = useRef<HTMLCanvasElement>(null);
  const simdRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const [replay, setReplay] = useState(0);

  const t = controller.timing;
  const pixels = controller.inputPixels;
  const speedup = t !== null && t.speedup !== null && t.speedup > 0 ? t.speedup : null;
  const live = speedup !== null && pixels !== null;

  useEffect(() => {
    if (pixels === null) return;
    if (!offRef.current) {
      const off = document.createElement('canvas');
      off.width = RASTER;
      off.height = RASTER;
      offRef.current = off;
    }
    paintInk(offRef.current, pixels);
  }, [pixels]);

  useEffect(() => {
    const scalar = scalarRef.current;
    const simd = simdRef.current;
    const off = offRef.current;
    if (!scalar || !simd || !off || !inView || pixels === null) return;
    if (!live || reduced) {
      paintPane(scalar, off, 1, EDGE_SCALAR);
      paintPane(simd, off, 1, EDGE_SIMD);
      return;
    }
    const scalarDur = 2600;
    const simdDur = scalarDur / speedup!;
    const hold = 1100;
    const cycles = 2;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const elapsed = now - t0;
      if (elapsed >= cycles * (scalarDur + hold)) {
        paintPane(scalar, off, 1, EDGE_SCALAR);
        paintPane(simd, off, 1, EDGE_SIMD);
        return;
      }
      const tt = elapsed % (scalarDur + hold);
      paintPane(scalar, off, Math.min(1, tt / scalarDur), EDGE_SCALAR);
      paintPane(simd, off, Math.min(1, tt / simdDur), EDGE_SIMD);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, live, reduced, speedup, pixels, replay]);

  return (
    <figure className={styles.raceCard} ref={ref}>
      <figcaption className={styles.chartHead}>
        <div>
          <span className={styles.chartEyebrow}>live · the same measurement, as ink</span>
          <h4 className={styles.chartTitle}>Two kernels read your digit</h4>
        </div>
        <span className={styles.gaugePulse} data-live={live || undefined} aria-hidden />
      </figcaption>

      <div
        className={styles.raceLanes}
        role="img"
        aria-label={
          live
            ? `Your digit read twice: scalar median ${fmtPaneMs(t!.p50BaselineMs!)}, simd128 median ${fmtPaneMs(t!.p50OptimizedMs)} — ${speedup!.toFixed(2)} times faster.`
            : 'Read race idle — draw a digit to measure'
        }
      >
        <div className={styles.racePane} data-tone="scalar" data-empty={!live || undefined}>
          <span>scalar · lanes off</span>
          <canvas ref={scalarRef} width={RASTER} height={RASTER} />
          <b className="tabular">{live ? fmtPaneMs(t!.p50BaselineMs!) : '—'}</b>
        </div>
        <div className={styles.racePane} data-tone="simd" data-empty={!live || undefined}>
          <span>simd128 · f64x2</span>
          <canvas ref={simdRef} width={RASTER} height={RASTER} />
          <b className="tabular">{live ? fmtPaneMs(t!.p50OptimizedMs) : '—'}</b>
        </div>
      </div>

      <p className={styles.raceFoot}>
        {!live ? (
          <>idle — draw in the bench at the top and the race replays your ink</>
        ) : reduced ? (
          <>
            Your measured medians, <b className="tabular">{speedup!.toFixed(2)}×</b> apart.
          </>
        ) : (
          <>
            Sweeps stretched to watchable speed; the ratio is yours — simd128 finishes{' '}
            <b className="tabular">{speedup!.toFixed(2)}×</b> sooner.{' '}
            <button
              type="button"
              className={styles.raceReplay}
              onClick={() => setReplay((r) => r + 1)}
            >
              replay
            </button>
          </>
        )}
      </p>
    </figure>
  );
}

/* ─────────────── 3c · the record ledger ─────────────── */

/**
 * Proof 4.5's visual anchor: all twelve sized cases, win or lose, as a
 * diverging log-scale ledger around the break-even axis. The row that changed
 * sign between the two committed machines carries its December figure inline —
 * the chapter's whole argument in one flagged line.
 */
export function RecordLedger() {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>('0px 0px -12% 0px');
  const lit = reduced || inView;
  const maxAbs = Math.max(...recordLedger.rows.map((r) => Math.abs(log2(r.ratio))));

  return (
    <figure className={styles.ledgerCard} ref={ref} data-lit={lit || undefined}>
      <figcaption className={styles.chartHead}>
        <div>
          <span className={styles.chartEyebrow}>
            every sized case · single-thread ÷ openmp+native
          </span>
          <h4 className={styles.chartTitle}>
            The full ledger: {recordLedger.wins} wins, {recordLedger.losses} losses
          </h4>
        </div>
        <span className={styles.chartKey} aria-hidden>
          <i data-tone="win" /> wins · <i data-tone="loss" /> losses
        </span>
      </figcaption>

      <ul className={styles.ledgerRows}>
        {recordLedger.rows.map((r, i) => {
          const half = (Math.abs(log2(r.ratio)) / maxAbs) * 50;
          return (
            <li
              key={r.label}
              data-loss={!r.wins || undefined}
              data-flip={r.flipNote !== null || undefined}
              style={{ '--d': `${i * 40}ms` } as React.CSSProperties}
            >
              <span className={styles.ledgerOp}>{r.label}</span>
              <span
                className={styles.ledgerTrack}
                role="img"
                aria-label={`${r.label}: ${r.single} single thread to ${r.omp} with OpenMP — ${r.display}`}
              >
                <i
                  className={styles.ledgerBar}
                  style={
                    r.wins
                      ? { left: '50%', width: `${half}%` }
                      : { right: '50%', width: `${half}%` }
                  }
                />
              </span>
              <b className="tabular">{r.display}</b>
              {r.flipNote !== null && <em className={styles.ledgerFlip}>{r.flipNote}</em>}
            </li>
          );
        })}
      </ul>

      <p className={styles.chartFoot}>
        Bars are log-scaled from the committed medians; left of the axis, OpenMP loses (
        {recordLedger.losses} of {recordLedger.rows.length}). The flagged row is the one that
        changed sign between the two committed machines.
      </p>
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

/* Wall geometry, CSS pixels. 34px keeps the 28×28 ink readable as ink while
   all 299 specimens still land in roughly twelve rows at a 1024 viewport. */
const WALL_CELL = 34;
const WALL_GAP = 5;
const WALL_PITCH = WALL_CELL + WALL_GAP;

interface WallSpecimen {
  e: FailureEntry;
  packIndex: number;
}

/**
 * THE WALL — every one of the 299 misses at once, drawn as actual MNIST ink
 * from the committed pack. One canvas, one sprite atlas: sprites are unpacked
 * once into a 28×(28·299) strip, then every redraw is 299 drawImage calls, so
 * dimming for a selection or ringing a hovered specimen costs a frame, not a
 * re-decode. Specimens sort by true digit then prediction — the wall reads as
 * ten uneven lines of handwriting, each line one digit's failures.
 *
 * The canvas is a single role="img": per-specimen data stays keyboard-reachable
 * through the confusion grid above, which lists the same record by cell.
 */
function FailureWall({
  entries,
  pack,
  sel,
  onHoverEntry,
  onPick,
}: {
  entries: FailureEntry[];
  pack: Uint8Array;
  sel: { t: number; p: number } | null;
  onHoverEntry: (e: FailureEntry | null) => void;
  onPick: (t: number, p: number) => void;
}) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const atlasRef = useRef<HTMLCanvasElement | null>(null);
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>('0px 0px -8% 0px');
  const [cols, setCols] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const order = useMemo<WallSpecimen[]>(
    () =>
      entries
        .map((e, packIndex) => ({ e, packIndex }))
        .sort((a, b) => a.e.true - b.e.true || a.e.pred - b.e.pred || a.e.index - b.e.index),
    [entries],
  );

  // Unpack the committed bytes once. Ink is alpha-mapped near-white, so the
  // page ground shows through exactly where MNIST recorded no pressure.
  useEffect(() => {
    const atlas = document.createElement('canvas');
    atlas.width = RASTER;
    atlas.height = RASTER * entries.length;
    const ctx = atlas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(RASTER, RASTER * entries.length);
    const n = Math.min(entries.length * RASTER * RASTER, pack.length);
    for (let i = 0; i < n; i += 1) {
      img.data[i * 4] = 235;
      img.data[i * 4 + 1] = 238;
      img.data[i * 4 + 2] = 245;
      img.data[i * 4 + 3] = pack[i];
    }
    ctx.putImageData(img, 0, 0);
    atlasRef.current = atlas;
  }, [pack, entries.length]);

  // Columns are seeded synchronously from the laid-out width — the observer
  // only handles RESIZES. Seeding through the observer alone left the wall
  // blank anywhere ResizeObserver never fired.
  /* The floor was 8, which promised a minimum canvas of 8×39−5 = 307px that a
     narrow wrap cannot honour: at a 375px viewport the wrap is 277px, the
     canvas asked for 307px, and the global `canvas { max-width: 100% }` in
     base.css clamped and RESAMPLED it — precisely the blur the exact-CSS-size
     code in draw() exists to prevent. 4 keeps the wall from degenerating into
     a tower (299 rows at 1 column is a ~12,000px canvas) while staying inside
     any wrap above 151px, which is narrower than any real viewport reaches. */
  const colsFor = (w: number) => Math.max(4, Math.floor((w + WALL_GAP) / WALL_PITCH));

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (wrap) setCols(colsFor(wrap.clientWidth));
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(([entry]) => {
      if (entry) setCols(colsFor(entry.contentRect.width));
    });
    obs.observe(wrap);
    return () => obs.disconnect();
  }, []);

  const draw = useCallback(
    (elapsedMs: number) => {
      const canvas = canvasRef.current;
      const atlas = atlasRef.current;
      if (!canvas || !atlas || cols === 0) return;
      const rows = Math.ceil(order.length / cols);
      const cssW = cols * WALL_PITCH - WALL_GAP;
      const cssH = rows * WALL_PITCH - WALL_GAP;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        // Exact CSS size, set here rather than `width: 100%`: stretching the
        // raster by a fractional remainder would blur every specimen.
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.imageSmoothingEnabled = false;
      order.forEach(({ e, packIndex }, i) => {
        const x = (i % cols) * WALL_PITCH;
        const y = Math.floor(i / cols) * WALL_PITCH;
        const isSel = sel !== null && e.true === sel.t && e.pred === sel.p;
        const dimmed = sel !== null && !isSel;
        const developed = clamp((elapsedMs - i * 2.2) / 240, 0, 1);
        ctx.globalAlpha = developed * (dimmed ? 0.13 : 1);
        ctx.drawImage(atlas, 0, packIndex * RASTER, RASTER, RASTER, x, y, WALL_CELL, WALL_CELL);
        if (developed === 1 && (isSel || i === hovered)) {
          ctx.globalAlpha = 1;
          ctx.lineWidth = 1.25;
          ctx.strokeStyle = i === hovered ? 'rgb(56 189 248 / 0.9)' : 'rgb(245 158 11 / 0.55)';
          ctx.strokeRect(x - 1.5, y - 1.5, WALL_CELL + 3, WALL_CELL + 3);
        }
      });
      ctx.globalAlpha = 1;
    },
    [cols, order, sel, hovered],
  );

  // Redraws after the develop pass (selection, hover, resize) are instant.
  // `draw` rides in a ref so the develop loop below reads the freshest closure
  // without restarting when a hover mid-develop changes its identity.
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
    if (revealed || reduced) draw(Number.POSITIVE_INFINITY);
  }, [draw, revealed, reduced]);

  // The develop pass itself — once, on first sight, like prints in a tray.
  useEffect(() => {
    if (!inView || cols === 0 || reduced || revealed) return;
    let raf = 0;
    const t0 = performance.now();
    const total = order.length * 2.2 + 260;
    const tick = (now: number) => {
      const elapsed = now - t0;
      drawRef.current(elapsed);
      if (elapsed < total) raf = requestAnimationFrame(tick);
      else setRevealed(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, cols, reduced, revealed, order.length]);

  const cellAt = (ev: React.PointerEvent | React.MouseEvent): number | null => {
    const canvas = canvasRef.current;
    if (!canvas || cols === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    if (x < 0 || y < 0 || x % WALL_PITCH > WALL_CELL || y % WALL_PITCH > WALL_CELL) return null;
    const cx = Math.floor(x / WALL_PITCH);
    if (cx >= cols) return null;
    const i = Math.floor(y / WALL_PITCH) * cols + cx;
    return i >= 0 && i < order.length ? i : null;
  };

  const hover = (i: number | null) => {
    setHovered(i);
    onHoverEntry(i === null ? null : order[i].e);
  };

  return (
    <div
      ref={(node) => {
        wrapRef.current = node;
        inViewRef.current = node;
      }}
      className={styles.wallCanvasWrap}
    >
      <canvas
        ref={canvasRef}
        className={styles.wallCanvas}
        data-testid="failure-wall"
        role="img"
        aria-label={`All ${entries.length} misclassified test digits, drawn from the committed failure pack and grouped by true digit. The confusion grid lists the same record by cell.`}
        onPointerMove={(ev) => hover(cellAt(ev))}
        onPointerLeave={() => hover(null)}
        onClick={(ev) => {
          const i = cellAt(ev);
          if (i !== null) onPick(order[i].e.true, order[i].e.pred);
        }}
      />
    </div>
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
  const [hoveredEntry, setHoveredEntry] = useState<FailureEntry | null>(null);
  const [failed, setFailed] = useState(false);

  // Both halves of the committed failure record, fetched when the chapter
  // scrolls in: the manifest feeds the confusion grid, the image pack feeds
  // the wall. The pack used to wait for a cell click; now the wall IS the
  // exhibit, so reaching this chapter is the request. A pack failure loses
  // only the wall — the grid stands on the manifest alone.
  // The guard here is UNMOUNT, and that distinction is the entire bug this
  // replaced. `entries` was a dependency and ONE `alive` flag covered both
  // fetches, so the manifest resolving re-ran the effect, fired its cleanup,
  // and set alive = false while the pack — five times larger (234,416 B
  // against 40,902) and therefore almost always the slower of the two — was
  // still in flight. Its setPack was silenced forever and the wall never
  // mounted. It failed SILENTLY: `failed` stays false and the grid still
  // renders off the manifest, so there was no error state to notice; the
  // exhibit was simply gone. Forcing json-first reproduced it 3/3, bin-first
  // 0/3. A ref makes the request once; mountedRef only stops writes after
  // the component is actually gone, and is re-armed in the effect body
  // because StrictMode mounts, unmounts and remounts in development.
  const requestedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!inView || requestedRef.current || failed) return;
    requestedRef.current = true;
    fetch('/failures/misclassified.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((j) => {
        if (mountedRef.current) setEntries(j.entries as FailureEntry[]);
      })
      .catch(() => {
        if (mountedRef.current) setFailed(true);
      });
    fetch('/failures/misclassified.bin')
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
      .then((b) => {
        if (mountedRef.current) setPack(new Uint8Array(b));
      })
      .catch(() => {
        /* wall-only loss; the grid keeps working */
      });
  }, [inView, failed]);

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
  };

  return (
    <>
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
                  · {counts[sel.t][sel.p]} of the {accuracyWaffle.errors} — isolated on the wall
                  below
                </>
              ) : (
                <>
                  worst cell:{' '}
                  <b className="tabular">
                    {worst.t} → {worst.p}
                  </b>{' '}
                  ({worst.n} times). Select any lit cell to isolate those digits on the wall.
                </>
              )}
            </p>
          </>
        )}
      </div>

      {entries !== null && pack !== null && (
        <div className={styles.wallBlock}>
          <div className={styles.wallHead}>
            <span className={styles.chartEyebrow}>
              the exhibit · all {entries.length} misses, actual ink
            </span>
            <h4 className={styles.chartTitle}>The mistakes, in the machine&apos;s own material</h4>
          </div>
          <FailureWall
            entries={entries}
            pack={pack}
            sel={sel}
            onHoverEntry={setHoveredEntry}
            onPick={selectCell}
          />
          <p className={styles.wallNote} aria-live="polite">
            {hoveredEntry ? (
              <>
                test <b className="tabular">#{hoveredEntry.index}</b> — a{' '}
                <b className="tabular">{hoveredEntry.true}</b> read as{' '}
                <b className="tabular">{hoveredEntry.pred}</b> ·{' '}
                <span className="tabular">
                  {hoveredEntry.pred} at {(hoveredEntry.predActivation * 100).toFixed(0)}%,{' '}
                  {hoveredEntry.true} at {(hoveredEntry.trueActivation * 100).toFixed(0)}%
                </span>
              </>
            ) : sel ? (
              <>
                <b className="tabular">
                  {sel.t} → {sel.p}
                </b>{' '}
                isolated · click the lit cell again to release
              </>
            ) : (
              <>grouped by true digit, 0 through 9 — hover a specimen for its verdict</>
            )}
          </p>
        </div>
      )}
    </>
  );
}
