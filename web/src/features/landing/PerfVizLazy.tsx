import { lazy, Suspense, type ReactNode } from 'react';
import type { MnistDemoController } from '../mnist/useMnistDemoController';
import styles from './PerfViz.module.css';

/*
 * The five performance visualizations all live below the fold, so they are
 * split into their own chunk and loaded on demand. This keeps the entry
 * bundle lean (faster hero paint) without changing anything the visitor sees —
 * by the time act 03/04 scrolls in, the chunk has arrived. Each boundary
 * reserves height so nothing jumps when it swaps in.
 */

const mod = () => import('./PerfViz');
const CrossoverChartLazy = lazy(() => mod().then((m) => ({ default: m.CrossoverChart })));
const GflopsSlopeLazy = lazy(() => mod().then((m) => ({ default: m.GflopsSlope })));
const ThroughputGaugeLazy = lazy(() => mod().then((m) => ({ default: m.ThroughputGauge })));
const AccuracyWaffleLazy = lazy(() => mod().then((m) => ({ default: m.AccuracyWaffle })));
const LaneScaleLazy = lazy(() => mod().then((m) => ({ default: m.LaneScale })));
const SimdCensusPanelLazy = lazy(() => mod().then((m) => ({ default: m.SimdCensusPanel })));
const FailureMapLazy = lazy(() => mod().then((m) => ({ default: m.FailureMap })));

function Boundary({ children, minH }: { children: ReactNode; minH: number }) {
  return (
    <Suspense
      fallback={<div className={styles.vizFallback} style={{ minHeight: minH }} aria-hidden />}
    >
      {children}
    </Suspense>
  );
}

export const CrossoverChart = () => (
  <Boundary minH={440}>
    <CrossoverChartLazy />
  </Boundary>
);

export const GflopsSlope = () => (
  <Boundary minH={320}>
    <GflopsSlopeLazy />
  </Boundary>
);

export const AccuracyWaffle = () => (
  <Boundary minH={220}>
    <AccuracyWaffleLazy />
  </Boundary>
);

export const LaneScale = () => (
  <Boundary minH={280}>
    <LaneScaleLazy />
  </Boundary>
);

export const ThroughputGauge = ({ controller }: { controller: MnistDemoController }) => (
  <Boundary minH={360}>
    <ThroughputGaugeLazy controller={controller} />
  </Boundary>
);

export const SimdCensusPanel = () => (
  <Boundary minH={420}>
    <SimdCensusPanelLazy />
  </Boundary>
);

export const FailureMap = () => (
  <Boundary minH={420}>
    <FailureMapLazy />
  </Boundary>
);
