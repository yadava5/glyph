import { useCallback, useEffect, useRef, useState } from 'react';
import {
  hasConfiguredBackend,
  healthCheck,
  predict,
  type PredictionSource,
} from '../../api/predict';
import { createSampleDigitFive } from '../../components/sampleDigits';
import type { Stroke } from '../../components/strokeReducer';
import { useDebouncedCallback } from '../../hooks/useDebounce';

export type ServerStatus = 'checking' | 'online' | 'offline';

/**
 * Rolling per-session statistics over the C++-measured forward-pass
 * timings. Single-shot micro-timings are noisy; the badge shows the
 * median so the number a visitor reads is defensible.
 */
export interface InferenceTiming {
  n: number;
  lastOptimizedMs: number;
  lastBaselineMs: number | null;
  p50OptimizedMs: number;
  minOptimizedMs: number;
  p50BaselineMs: number | null;
  /** p50 baseline / p50 optimized, when a real baseline was measured. */
  speedup: number | null;
  /**
   * Total forward passes actually executed behind the figures above,
   * summed over the window — not the last sample's count repeated `n`
   * times. Each entry in the window is itself a mean over its own
   * adaptive iteration count, so quoting one call's count as though it
   * held for all of them would state a uniformity that isn't there.
   *
   * A sample with no reported count (the HTTP server, which times a
   * single pass per variant) contributes exactly 1, which is what it
   * measured.
   */
  kernelRuns: number;
}

export interface MnistDemoController {
  prediction: number | null;
  confidence: number[];
  baselineTime: number | null;
  optimizedTime: number | null;
  hiddenActivations?: number[];
  inputGrad?: number[];
  /** The exact 784-value vector last submitted to the network. */
  inputPixels: number[] | null;
  /** Rolling forward-pass timing stats for the current session. */
  timing: InferenceTiming | null;
  /** Compile-time vector ISA of the active module (e.g. "simd128"). */
  build: string | null;
  isLoading: boolean;
  serverStatus: ServerStatus;
  predictionSource: PredictionSource | null;
  strokeCount: number;
  clearSignal: number;
  sampleSignal: number;
  sampleStrokes: Stroke[] | null;
  canClear: boolean;
  handlePredict: (pixels: number[]) => void;
  resetPrediction: () => void;
  handleClearCanvas: () => void;
  handleLoadSampleDigit: () => void;
  setStrokeCount: (count: number) => void;
}

export function getRuntimeLabel(source: PredictionSource | null): string | null {
  if (source === 'server') return 'server';
  if (source === 'browser-wasm') return 'browser-wasm';
  if (source === 'browser-js-demo') return 'browser-js-demo';
  return null;
}

export function useMnistDemoController(): MnistDemoController {
  const [prediction, setPrediction] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number[]>([]);
  const [baselineTime, setBaselineTime] = useState<number | null>(null);
  const [optimizedTime, setOptimizedTime] = useState<number | null>(null);
  const [hiddenActivations, setHiddenActivations] = useState<number[] | undefined>();
  const [inputGrad, setInputGrad] = useState<number[] | undefined>();
  const [inputPixels, setInputPixels] = useState<number[] | null>(null);
  const [timing, setTiming] = useState<InferenceTiming | null>(null);
  const [build, setBuild] = useState<string | null>(null);
  const timingsRef = useRef<{ baseline: number | null; optimized: number; runs: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const backendConfigured = hasConfiguredBackend();
  const [serverStatus, setServerStatus] = useState<ServerStatus>(
    backendConfigured ? 'checking' : 'offline',
  );
  const [predictionSource, setPredictionSource] = useState<PredictionSource | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [clearSignal, setClearSignal] = useState(0);
  const [sampleSignal, setSampleSignal] = useState(0);
  const [sampleStrokes, setSampleStrokes] = useState<Stroke[] | null>(() =>
    createSampleDigitFive(),
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!backendConfigured) {
      return;
    }

    let alive = true;

    const checkServer = async () => {
      try {
        await healthCheck();
        if (alive) setServerStatus('online');
      } catch {
        if (alive) setServerStatus('offline');
      }
    };

    checkServer();
    const interval = window.setInterval(checkServer, 5000);

    return () => {
      alive = false;
      window.clearInterval(interval);
      abortControllerRef.current?.abort();
    };
  }, [backendConfigured]);

  const performPrediction = useCallback(async (pixels: number[]) => {
    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setInputPixels(pixels);
    setIsLoading(true);

    try {
      const result = await predict(pixels, controller.signal);
      setPrediction(result.prediction);
      setConfidence(result.confidence);
      setBaselineTime(result.baseline_time_ms > 0 ? result.baseline_time_ms : null);
      setOptimizedTime(result.optimized_time_ms);
      setHiddenActivations(result.hidden_activations);
      setInputGrad(result.input_grad);
      setPredictionSource(result.source ?? null);
      setBuild(result.build ?? null);

      // Rolling stats over the session (capped window). Only real
      // measured paths feed the instrument — the JS demo fallback's
      // timing is not a kernel measurement and must never appear in it.
      const measuredSource = result.source === 'browser-wasm' || result.source === 'server';
      if (measuredSource && result.optimized_time_ms > 0) {
        const window = timingsRef.current;
        window.push({
          baseline: result.baseline_time_ms > 0 ? result.baseline_time_ms : null,
          optimized: result.optimized_time_ms,
          // Absent means one timed pass, not zero — see PredictionResponse.
          runs: (result.timing_iters_simd || 1) + (result.timing_iters_scalar || 1),
        });
        if (window.length > 60) window.shift();

        const p50 = (values: number[]) => {
          const sorted = [...values].sort((a, b) => a - b);
          return sorted[Math.floor((sorted.length - 1) / 2)];
        };
        const optimizedAll = window.map((t) => t.optimized);
        const baselineAll = window.map((t) => t.baseline).filter((v): v is number => v !== null);
        const p50Optimized = p50(optimizedAll);
        const p50Baseline = baselineAll.length > 0 ? p50(baselineAll) : null;
        setTiming({
          n: window.length,
          lastOptimizedMs: result.optimized_time_ms,
          lastBaselineMs: result.baseline_time_ms > 0 ? result.baseline_time_ms : null,
          p50OptimizedMs: p50Optimized,
          minOptimizedMs: Math.min(...optimizedAll),
          p50BaselineMs: p50Baseline,
          speedup: p50Baseline !== null && p50Optimized > 0 ? p50Baseline / p50Optimized : null,
          kernelRuns: window.reduce((sum, t) => sum + t.runs, 0),
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Prediction failed:', error);
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, []);

  const { debouncedFn: handlePredict, cancel: cancelPredictionDebounce } = useDebouncedCallback(
    performPrediction,
    300,
  );

  const resetPrediction = useCallback(() => {
    cancelPredictionDebounce();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    setPrediction(null);
    setConfidence([]);
    setBaselineTime(null);
    setOptimizedTime(null);
    setHiddenActivations(undefined);
    setInputGrad(undefined);
    setInputPixels(null);
    setPredictionSource(null);
    setIsLoading(false);
    // Keep timing/build across canvas clears: the rolling stats describe
    // the session's instrument, not the current drawing.
  }, [cancelPredictionDebounce]);

  const canClear = strokeCount > 0 || prediction !== null || confidence.length > 0 || isLoading;

  const handleClearCanvas = useCallback(() => {
    resetPrediction();
    setClearSignal((signal) => signal + 1);
  }, [resetPrediction]);

  const handleLoadSampleDigit = useCallback(() => {
    resetPrediction();
    setSampleStrokes(createSampleDigitFive());
    setSampleSignal((signal) => signal + 1);
  }, [resetPrediction]);

  return {
    prediction,
    confidence,
    baselineTime,
    optimizedTime,
    hiddenActivations,
    inputGrad,
    inputPixels,
    timing,
    build,
    isLoading,
    serverStatus,
    predictionSource,
    strokeCount,
    clearSignal,
    sampleSignal,
    sampleStrokes,
    canClear,
    handlePredict,
    resetPrediction,
    handleClearCanvas,
    handleLoadSampleDigit,
    setStrokeCount,
  };
}
