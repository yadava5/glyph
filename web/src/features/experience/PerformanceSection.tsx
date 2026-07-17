import { BarChart3, Cpu, Gauge, TrendingDown, Zap } from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  architectureMetrics,
  classifyThroughput,
  kernelBenchmarks,
} from '../performance/benchmarkData';
import styles from './PerformanceSection.module.css';

const throughputRows = [
  { label: 'baseline', value: classifyThroughput.baseline, ratio: 100, winner: true },
  { label: 'native', value: classifyThroughput.native, ratio: 99, winner: false },
  { label: 'openmp+native', value: classifyThroughput.openmpNative, ratio: 86, winner: false },
];

export function PerformanceSection() {
  return (
    <section id="performance" className={styles.section} aria-labelledby="performance-title">
      <div className={styles.shell}>
        <div className={styles.copy}>
          <span className={styles.kicker}>
            <Gauge size={15} strokeWidth={1.8} aria-hidden />
            Benchmark-backed HPC story
          </span>
          <h2 id="performance-title">SIMD is the live-inference hero.</h2>
          <p>
            The committed numbers separate kernel speedups from end-to-end classify throughput.
            OpenMP helps after matrix-size crossover; it is not a universal win.
          </p>
        </div>

        <div className={styles.archRail}>
          <div>
            <span>Architecture</span>
            <strong>{architectureMetrics.topology}</strong>
          </div>
          <div>
            <span>Accuracy</span>
            <strong>{architectureMetrics.accuracy}</strong>
          </div>
          <div>
            <span>Claim boundary</span>
            <strong>Release M2 run</strong>
          </div>
        </div>

        <div className={styles.kernelGrid}>
          {kernelBenchmarks.map((benchmark) => (
            <article key={benchmark.id} className={styles.kernelPanel}>
              <div className={styles.panelTopline}>
                <span>
                  <Zap size={15} strokeWidth={1.8} aria-hidden />
                  {benchmark.operation}
                </span>
                <strong>{benchmark.speedup}</strong>
              </div>
              <div className={styles.compare}>
                <span>
                  <small>baseline</small>
                  <b>{benchmark.baseline}</b>
                </span>
                <i aria-hidden />
                <span>
                  <small>openmp+native</small>
                  <b>{benchmark.optimized}</b>
                </span>
              </div>
              <p>{benchmark.note}</p>
            </article>
          ))}
        </div>

        <div className={styles.crossover}>
          <div className={styles.crossoverCopy}>
            <span className={styles.kicker}>
              <Cpu size={15} strokeWidth={1.8} aria-hidden />
              OpenMP crossover
            </span>
            <h3>Classify is small enough that OpenMP hurts.</h3>
            <p>
              The {'784 -> 100 -> 10'} network is intentionally compact. Thread startup and
              fork-join overhead cost more than they save on the live inference path.
            </p>
          </div>
          <div className={styles.throughputChart} aria-label="Classify throughput comparison">
            {throughputRows.map((row) => (
              <div key={row.label} className={styles.throughputRow} data-winner={row.winner}>
                <span>{row.label}</span>
                <div>
                  <i style={{ width: `${row.ratio}%` }} />
                </div>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          <div className={styles.warning}>
            <TrendingDown size={18} strokeWidth={1.8} aria-hidden />
            <span>{classifyThroughput.conclusion}</span>
          </div>
        </div>

        <div className={styles.vectorStrip} aria-hidden>
          {Array.from({ length: 18 }, (_, index) => (
            <span key={index} style={{ '--lane': index } as CSSProperties} />
          ))}
        </div>
      </div>
      <BarChart3 className={styles.watermark} size={420} strokeWidth={0.7} aria-hidden />
    </section>
  );
}
