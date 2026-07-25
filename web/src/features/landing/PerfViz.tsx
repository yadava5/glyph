import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { crossoverSeries, gflopsSeries, laneScale } from '../performance/benchmarkData';
import type { MnistDemoController } from '../mnist/useMnistDemoController';
import { RollingNumber } from './interactions';
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

const ACCENT: Record<string, string> = {
  sky: 'var(--sky)',
  amber: 'var(--amber)',
  steel: 'var(--steel)',
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
  accent: string;
}

/**
 * The crossover, drawn to scale: single-thread ÷ openmp+native speedup versus
 * per-op size, on a log-size axis. The break-even line is 1.0×; everything in
 * the shaded band below it is where OpenMP LOSES — kept on the record, not
 * hidden. Hover or focus any point for its exact op + timings. Every value is
 * from the committed M2 run.
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
  const yMax = 3.7;

  const xOf = (size: number) => m.l + ((log2(size) - xMin) / (xMax - xMin)) * plotW;
  const yOf = (v: number) => m.t + (1 - clamp(v, 0, yMax) / yMax) * plotH;

  const yBreak = yOf(1);
  const xTicks = [32, 64, 128, 256, 512, 1024];
  const yTicks = [0, 1, 2, 3];

  return (
    <figure className={styles.chartCard} ref={ref} data-draw={inView && !reduced ? '' : undefined}>
      <figcaption className={styles.chartHead}>
        <div>
          <span className={styles.chartEyebrow}>the crossover · single-thread ÷ openmp+native</span>
          <h3 className={styles.chartTitle}>Where threads start to pay — and where they cost</h3>
        </div>
        <ul className={styles.legend} aria-hidden>
          {crossoverSeries.map((s) => (
            <li key={s.id}>
              <i style={{ background: ACCENT[s.accent] }} />
              {s.label}
            </li>
          ))}
        </ul>
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

          {/* series */}
          {crossoverSeries.map((s) => {
            const pts = [...s.points].sort((a, b) => a.size - b.size);
            const d = pts
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.size)} ${yOf(p.speedup)}`)
              .join(' ');
            return (
              <path
                key={s.id}
                d={d}
                className={styles.series}
                pathLength={1}
                style={{ stroke: ACCENT[s.accent] }}
              />
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
                  style={{ stroke: ACCENT[s.accent], color: ACCENT[s.accent] }}
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
                      accent: ACCENT[s.accent],
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
                      accent: ACCENT[s.accent],
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
  const H = 260;
  const m = { l: 38, r: 16, t: 20, b: 40 };
  const plotW = W - m.l - m.r;
  const plotH = H - m.t - m.b;
  const yMax = 26;
  const xOf = (size: number) => m.l + ((log2(size) - 5) / (8 - 5)) * plotW;
  const yOf = (v: number) => m.t + (1 - v / yMax) * plotH;

  const lineOf = (key: 'single' | 'omp') =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.size)} ${yOf(p[key])}`).join(' ');

  return (
    <figure className={styles.slopeCard} ref={ref} data-draw={inView && !reduced ? '' : undefined}>
      <figcaption className={styles.chartHead}>
        <div>
          <span className={styles.chartEyebrow}>matmul · GFLOP/s ({gflopsSeries.flops})</span>
          <h3 className={styles.chartTitle}>The payoff slope</h3>
        </div>
      </figcaption>
      <div className={styles.chartWrap}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.chartSvg}
          role="img"
          aria-label={`matmul GFLOP/s: single-thread stays near 7-10 while openmp+native climbs to ${gflopsSeries.peak}`}
        >
          {[0, 8, 16, 24].map((v) => (
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
            style={{ stroke: 'var(--sky)' }}
          />
          {(['single', 'omp'] as const).map((key) =>
            pts.map((p) => (
              <circle
                key={`${key}-${p.size}`}
                cx={xOf(p.size)}
                cy={yOf(p[key])}
                r={4.5}
                className={styles.dot}
                style={{
                  stroke: key === 'omp' ? 'var(--sky)' : 'var(--steel)',
                  color: key === 'omp' ? 'var(--sky)' : 'var(--steel)',
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
            x={xOf(256)}
            y={yOf(gflopsSeries.points[3].omp) - 12}
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
      <div className={styles.slopeLegend} aria-hidden>
        <span>
          <i style={{ background: 'var(--steel)' }} /> single thread
        </span>
        <span>
          <i style={{ background: 'var(--sky)' }} /> openmp + native
        </span>
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
          <h3 className={styles.chartTitle}>simd128 vs scalar, right now</h3>
        </div>
        <span className={styles.gaugePulse} data-live={live || undefined} aria-hidden />
      </figcaption>

      <div className={styles.gaugeWrap}>
        <svg
          viewBox="0 0 300 190"
          className={styles.gaugeSvg}
          role="img"
          aria-label={
            live
              ? `Live speedup ${speedup!.toFixed(1)} times`
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
          {/* value arc */}
          {live && (
            <path
              d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${valEnd.x} ${valEnd.y}`}
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
          {/* center readout */}
          <text x={cx} y={cy - 30} className={styles.gaugeBig} textAnchor="middle">
            {live ? `${speedup!.toFixed(1)}×` : '—'}
          </text>
        </svg>
      </div>

      <dl className={styles.gaugeReadout}>
        <div>
          <dt>median speedup</dt>
          <dd className="tabular">{live ? `${speedup!.toFixed(2)}×` : 'awaiting ink'}</dd>
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
            {imgPerSec ? `≈ ${imgPerSec.toLocaleString('en-US')} img/s` : 'draw above'}
          </dd>
        </div>
      </dl>
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
        <h3 className={styles.chartTitle}>One instruction, one to eight multiply-adds</h3>
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

/** The model's real held-out MNIST result — matches the hero's 97.01%. */
const HELD_OUT = { correct: 9701, missed: 299, pct: 97.01 };

/**
 * The held-out test result, as a single count-up on the model's real 97.01%
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
        <span className={styles.chartEyebrow}>test accuracy · 10,000 held-out digits</span>
        <div className={styles.waffleBig}>
          <RollingNumber
            key={`c${run}`}
            value={HELD_OUT.correct}
            className={styles.waffleCount}
            glow
          />
          <span className={styles.waffleSlash}>/ 10,000</span>
        </div>
        <p className={styles.wafflePct}>
          <RollingNumber key={`p${run}`} value={HELD_OUT.pct} decimals={2} suffix="%" glow />{' '}
          correct · <b>{HELD_OUT.missed.toLocaleString('en-US')}</b> missed
        </p>
      </div>
    </div>
  );
}
