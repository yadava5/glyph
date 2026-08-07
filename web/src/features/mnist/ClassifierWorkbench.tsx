import { Activity, Binary, Cpu, Gauge, PencilLine, Server, Target, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ActivationPanels } from '../../components/ActivationPanels';
import { DrawingCanvas } from '../../components/DrawingCanvas';
import { PredictionResult } from '../../components/PredictionResult';
import { getRuntimeLabel, type MnistDemoController } from './useMnistDemoController';
import styles from './ClassifierWorkbench.module.css';

interface ClassifierWorkbenchProps {
  controller: MnistDemoController;
}

const runtimeModes = [
  {
    id: 'server',
    label: 'Native server',
    detail: 'C++ forward pass, SIMD kernels, optional OpenMP build.',
    icon: Server,
  },
  {
    id: 'browser-wasm',
    label: 'WASM path',
    detail: 'Portable offline inference with 128-bit browser SIMD.',
    icon: Binary,
  },
  {
    id: 'browser-js-demo',
    label: 'JS demo fallback',
    detail: 'Usability fallback only, not the benchmark path.',
    icon: Zap,
  },
];

function RuntimeDiagnostics({ controller }: ClassifierWorkbenchProps) {
  const runtimeLabel = getRuntimeLabel(controller.predictionSource);

  return (
    <aside className={styles.diagnostics} aria-label="Runtime diagnostics">
      <div className={styles.statusLine} data-state={controller.serverStatus}>
        <span className={styles.statusDot} aria-hidden />
        <span>
          {controller.serverStatus === 'checking' && 'Checking native server'}
          {controller.serverStatus === 'online' && 'Native server online'}
          {controller.serverStatus === 'offline' && 'Native server offline'}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {runtimeLabel && (
          <motion.div
            key={runtimeLabel}
            className={styles.runtimeBadge}
            data-source={controller.predictionSource}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            aria-label={`Prediction source: ${runtimeLabel}`}
          >
            <Cpu size={15} strokeWidth={1.8} aria-hidden />
            {runtimeLabel}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.modeList}>
        {runtimeModes.map((mode) => {
          const Icon = mode.icon;
          const active =
            controller.predictionSource === mode.id ||
            (mode.id === 'server' &&
              controller.predictionSource === null &&
              controller.serverStatus === 'online');

          return (
            <div key={mode.id} className={styles.modeRow} data-active={active}>
              <Icon size={16} strokeWidth={1.8} aria-hidden />
              <span>
                <strong>{mode.label}</strong>
                <small>{mode.detail}</small>
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function ClassifierWorkbench({ controller }: ClassifierWorkbenchProps) {
  return (
    <section id="classifier" className={styles.section} aria-labelledby="classifier-title">
      <div className={styles.backgroundGrid} aria-hidden />
      <div className={styles.shell}>
        <div className={styles.copy}>
          <span className={styles.kicker}>
            <Activity size={15} strokeWidth={1.8} aria-hidden />
            Live inference cockpit
          </span>
          <h2 id="classifier-title">Draw a digit. Inspect the forward pass.</h2>
          <p>
            The workbench keeps the real drawing path in the foreground: 28x28 input pixels, live
            class-confidence scores, hidden-layer telemetry, and runtime source labels.
          </p>
        </div>

        <div className={styles.workbench}>
          <div className={styles.canvasColumn} id="draw">
            <div className={styles.panelHeader}>
              <h3>
                <PencilLine size={18} strokeWidth={1.8} aria-hidden />
                Draw Here
              </h3>
              <small>28x28 raster input</small>
            </div>
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
          </div>

          <div className={styles.resultsColumn} id="results">
            <div className={styles.panelHeader}>
              <h3>
                <Target size={18} strokeWidth={1.8} aria-hidden />
                Prediction
              </h3>
              <small>class confidence plus activations</small>
            </div>
            <PredictionResult
              prediction={controller.prediction}
              confidence={controller.confidence}
              baselineTime={controller.baselineTime}
              optimizedTime={controller.optimizedTime}
              isLoading={controller.isLoading}
            />
          </div>

          <div className={styles.activationsColumn}>
            <div className={styles.panelHeader}>
              <h3>
                <Gauge size={18} strokeWidth={1.8} aria-hidden />
                Activation Panels
              </h3>
              <small>saliency, hidden, confidence</small>
            </div>
            <ActivationPanels
              prediction={controller.prediction}
              confidence={controller.confidence}
              hiddenActivations={controller.hiddenActivations}
              inputGrad={controller.inputGrad}
            />
          </div>

          <RuntimeDiagnostics controller={controller} />
        </div>
      </div>
    </section>
  );
}
