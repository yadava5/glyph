import { useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { DrawingCanvas } from '../../components/DrawingCanvas';
import { HiddenHeatmap } from '../../components/HiddenHeatmap';
import { SaliencyPanel } from '../../components/SaliencyPanel';
import { SoftmaxBars } from '../../components/SoftmaxBars';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { MnistDemoController } from '../mnist/useMnistDemoController';
import { InputRaster } from './InputRaster';
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
 * The live proof line: scalar (vectorization disabled) vs the
 * hand-written wasm simd128 kernel, medians over the session, both
 * measured in C++ on the visitor's own machine. This is the page's
 * thesis rendered as an instrument, not a claim.
 */
function TimingReadout({ controller }: WorkbenchProps) {
  const t = controller.timing;
  if (!t) return null;
  if (t.p50BaselineMs === null || t.speedup === null) {
    return (
      <span className={styles.timingReadout} aria-label="Forward pass timing">
        <b className="tabular">{fmtMs(t.p50OptimizedMs)}</b>
        <small className="tabular">p50 · n={t.n}</small>
      </span>
    );
  }
  return (
    <span
      className={styles.timingReadout}
      aria-label={`Live kernel comparison: scalar ${fmtMs(t.p50BaselineMs)} versus simd ${fmtMs(
        t.p50OptimizedMs,
      )}, ${t.speedup.toFixed(1)} times faster`}
    >
      <span className="tabular">scalar {fmtMs(t.p50BaselineMs)}</span>
      <i aria-hidden>→</i>
      <span className="tabular" data-lit>
        simd {fmtMs(t.p50OptimizedMs)}
      </span>
      <b className="tabular">{t.speedup.toFixed(1)}×</b>
      <small className="tabular">p50 · n={t.n}</small>
    </span>
  );
}

/**
 * The product frame: the real classifier, above the fold, in a single
 * window. Left — ink. Middle — what the network sees, and its verdict.
 * Right — the evidence signals. The titlebar is a live benchmark.
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

  // Let the machine perform before anyone is asked to believe it: when
  // the workbench first enters the viewport with a blank canvas, run
  // the sample digit once. Skipped under prefers-reduced-motion (the
  // labeled button below covers that path) and never after user ink.
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
            fast_mnist <em>/</em> live_bench
          </span>
          <div className={styles.titlebarRight}>
            <TimingReadout controller={controller} />
            <span
              className={styles.titlebarStatus}
              data-tone={badge.tone}
              aria-label={`Prediction source: ${badge.label}`}
            >
              <i aria-hidden />
              <span className={styles.statusLong}>{badge.label}</span>
              <span className={styles.statusShort}>{badge.short}</span>
            </span>
          </div>
        </header>

        <div className={styles.grid}>
          <div className={styles.colDraw}>
            <span className={styles.colLabel}>
              <b>01</b> draw
            </span>
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
              Draw a digit 0–9. Each stroke races the hand-written simd128 kernel against the same
              math with vector lanes off — on your silicon.
            </p>
            <button
              type="button"
              className={styles.sampleButton}
              onClick={controller.handleLoadSampleDigit}
            >
              <RotateCcw size={13} strokeWidth={2} aria-hidden />
              load a sample digit
            </button>
          </div>

          <div className={styles.colSeen}>
            <span className={styles.colLabel}>
              <b>02</b> what the network sees
            </span>
            <InputRaster pixels={controller.inputPixels} />
            <span className={styles.colLabel}>
              <b>03</b> verdict
            </span>
            <div className={styles.verdict} data-empty={controller.prediction === null}>
              {controller.prediction !== null ? (
                <>
                  <motion.span
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
                  </motion.span>
                  {confidence !== null && (
                    <motion.span
                      key={`meta-${controller.prediction}-${confidence.toFixed(3)}`}
                      className={styles.verdictMeta}
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.28 }}
                    >
                      <b className="tabular">{(confidence * 100).toFixed(1)}%</b> confident
                    </motion.span>
                  )}
                </>
              ) : (
                <span className={styles.verdictEmpty}>?</span>
              )}
            </div>
          </div>

          <div className={styles.colSignals} id="results">
            <span className={styles.colLabel}>
              <b>04</b> signals
            </span>
            <div className={styles.signalsStack}>
              <div className={styles.confidencePanel}>
                <span className={styles.signalLabel}>per-class confidence</span>
                <SoftmaxBars
                  prediction={controller.prediction}
                  confidence={controller.confidence}
                />
              </div>
              <div className={styles.signalsRow}>
                <SaliencyPanel inputGrad={controller.inputGrad} />
                <HiddenHeatmap hiddenActivations={controller.hiddenActivations} />
              </div>
              <span className={styles.saliencyLegend} aria-hidden>
                <i data-kind="for" /> supports the verdict · <i data-kind="against" /> opposes it
              </span>
            </div>
          </div>
        </div>

        <footer className={styles.statusline}>
          <span>784 → 100 → 10</span>
          <span>79,510 parameters</span>
          <span>318KB weights</span>
          <span>dual-accumulator f64x2 kernel</span>
          <span>timed in C++, saliency excluded</span>
        </footer>
      </div>
    </section>
  );
}
