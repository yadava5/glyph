import { useEffect, useRef } from 'react';
import { m } from 'motion/react';
import { DrawingCanvas } from '../../components/DrawingCanvas';
import { SoftmaxBars } from '../../components/SoftmaxBars';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { MnistDemoController } from '../mnist/useMnistDemoController';
import styles from './Workbench.module.css';

interface WorkbenchProps {
  controller: MnistDemoController;
}

function runtimeBadge(controller: MnistDemoController): {
  label: string;
  short: string;
  tone: 'live' | 'warn' | 'idle';
} {
  if (controller.predictionSource === 'server')
    return { label: 'native server', short: 'native', tone: 'live' };
  if (controller.predictionSource === 'browser-wasm') {
    const isa = controller.build ?? 'wasm';
    return { label: `wasm ${isa}`, short: isa, tone: 'live' };
  }
  if (controller.predictionSource === 'browser-js-demo')
    return { label: 'js demo fallback', short: 'js demo', tone: 'warn' };
  if (controller.serverStatus === 'online')
    return { label: 'native ready', short: 'native', tone: 'live' };
  return { label: 'wasm ready', short: 'wasm', tone: 'idle' };
}

/** Sub-0.1ms readings render as microseconds; the scale earns it. */
function fmtMs(ms: number): string {
  if (ms < 0.1) return `${Math.round(ms * 1000)}µs`;
  if (ms < 10) return `${ms.toFixed(2)}ms`;
  return `${ms.toFixed(1)}ms`;
}

/*
 * The proof line — the instrument's whole reason to be on the fold.
 * Scalar (vectorization disabled) vs the hand-written wasm simd128 kernel,
 * medians over the session, both measured in C++ on the visitor's own
 * machine. Idle figures render as an em-dash, never as fake zeros.
 */
function ProofLine({ controller }: WorkbenchProps) {
  const t = controller.timing;
  if (!t || t.p50BaselineMs === null || t.speedup === null) {
    return (
      <div className={styles.proofLine} data-idle aria-label="Live kernel comparison, idle">
        <span className={styles.proofPair}>
          <em>scalar</em> <b className="tabular">—</b>
          <i aria-hidden>→</i>
          <em>simd128</em> <b className="tabular">{t ? fmtMs(t.p50OptimizedMs) : '—'}</b>
        </span>
        <span className={styles.proofRatio} data-idle>
          <b className="tabular">—</b>
        </span>
        <small>{t ? `p50 · n=${t.n} · arming scalar baseline` : 'awaiting ink'}</small>
      </div>
    );
  }
  return (
    <div
      className={styles.proofLine}
      aria-label={`Live kernel comparison: scalar ${fmtMs(t.p50BaselineMs)} versus simd ${fmtMs(
        t.p50OptimizedMs,
      )}, ${t.speedup.toFixed(1)} times faster`}
    >
      <span className={styles.proofPair}>
        <em>scalar</em> <b className="tabular">{fmtMs(t.p50BaselineMs)}</b>
        <i aria-hidden>→</i>
        <em>simd128</em>{' '}
        <b className="tabular" data-lit>
          {fmtMs(t.p50OptimizedMs)}
        </b>
      </span>
      <span className={styles.proofRatio}>
        <b className="tabular">{t.speedup.toFixed(1)}×</b>
      </span>
      <small className="tabular">p50 · n={t.n} · timed in C++ on your silicon</small>
    </div>
  );
}

/**
 * The fold instrument, compact: ink in on the left, verdict and per-class
 * confidence on the right, the scalar-vs-simd measurement across the base.
 * The deep signals (input raster, hidden heatmap, saliency) live with the
 * proof act's anatomy panel — this window is the demo, that one is the audit.
 */
export function Workbench({ controller }: WorkbenchProps) {
  const badge = runtimeBadge(controller);
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const autoRanRef = useRef(false);
  const confidence =
    controller.prediction !== null && controller.confidence.length === 10
      ? controller.confidence[controller.prediction]
      : null;

  // Let the machine perform before anyone is asked to believe it: on the
  // fold, first sight of a blank canvas runs the sample digit once. Skipped
  // under prefers-reduced-motion (the canvas toolbar's sample button covers
  // that path) and never after user ink.
  const { strokeCount, prediction, handleLoadSampleDigit } = controller;
  useEffect(() => {
    if (reduced || autoRanRef.current) return;
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (!autoRanRef.current && strokeCount === 0 && prediction === null) {
          autoRanRef.current = true;
          handleLoadSampleDigit();
        }
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced, strokeCount, prediction, handleLoadSampleDigit]);

  return (
    <section
      id="classifier"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="workbench-title"
    >
      <div className={styles.frame}>
        <header className={styles.titlebar}>
          <span className={styles.titlebarName} id="workbench-title">
            glyph <em>/</em> live_bench
          </span>
          <span
            className={styles.titlebarStatus}
            data-tone={badge.tone}
            aria-label={`Prediction source: ${badge.label}`}
          >
            <i aria-hidden />
            <span className={styles.statusLong}>{badge.label}</span>
            <span className={styles.statusShort}>{badge.short}</span>
          </span>
        </header>

        <div className={styles.grid}>
          <div className={styles.colDraw}>
            <span className={styles.colLabel}>ink</span>
            <DrawingCanvas
              onPredict={controller.handlePredict}
              onClear={controller.resetPrediction}
              onStrokeCountChange={controller.setStrokeCount}
              clearSignal={controller.clearSignal}
              sampleSignal={controller.sampleSignal}
              sampleStrokes={controller.sampleStrokes}
              disabled={controller.serverStatus === 'checking'}
              isLoading={controller.isLoading}
            />
            <p className={styles.colHint}>
              Draw a digit 0–9 — every stroke races the simd128 kernel against the same math with
              vector lanes off.
            </p>
          </div>

          <div className={styles.colVerdict}>
            <span className={styles.colLabel}>verdict</span>
            <div className={styles.verdict} data-empty={controller.prediction === null}>
              {controller.prediction !== null ? (
                <>
                  <m.span
                    key={`digit-${controller.prediction}`}
                    className={styles.verdictDigit}
                    data-testid="verdict-digit"
                    initial={reduced ? false : { opacity: 0, scale: 0.92, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    transition={{
                      duration: 0.26,
                      delay: 0.12,
                      ease: [0.19, 1, 0.22, 1],
                    }}
                  >
                    {controller.prediction}
                  </m.span>
                  {confidence !== null && (
                    <m.span
                      key={`meta-${controller.prediction}-${confidence.toFixed(3)}`}
                      className={styles.verdictMeta}
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.28 }}
                    >
                      <b className="tabular">{(confidence * 100).toFixed(1)}%</b> confident
                    </m.span>
                  )}
                </>
              ) : (
                <span className={styles.verdictEmpty}>?</span>
              )}
            </div>
            <span className={styles.colLabel}>per-class confidence</span>
            <SoftmaxBars prediction={controller.prediction} confidence={controller.confidence} />
          </div>
        </div>

        <ProofLine controller={controller} />

        <footer className={styles.statusline}>
          <span className="tabular">784 → 100 → 10</span>
          <span className="tabular">79,510 params</span>
          <span className="tabular">318 kB weights</span>
          <span>f64x2 dual-accumulator</span>
        </footer>
      </div>
    </section>
  );
}
