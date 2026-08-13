import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Redo2, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { m } from 'motion/react';
import { getStroke } from 'perfect-freehand';
import { useHotkeys } from 'react-hotkeys-hook';
import { springs } from '../lib/springs';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { initialStrokeState, strokeReducer, type Stroke, type StrokePoint } from './strokeReducer';

interface DrawingCanvasProps {
  onPredict: (imageData: number[]) => void;
  onStroke?: () => void;
  onClear?: () => void;
  onStrokeCountChange?: (count: number) => void;
  clearSignal?: number;
  sampleSignal?: number;
  sampleStrokes?: Stroke[] | null;
  disabled?: boolean;
  isLoading?: boolean;
}

const CANVAS_SIZE = 280;
const GRID_SIZE = 28;
const CELL = CANVAS_SIZE / GRID_SIZE; // 10
const LIVE_PREDICT_DEBOUNCE_MS = 120;

// perfect-freehand config tuned for MNIST-sized strokes.
// Slightly chunky to match the ~20px brush the C++ server was trained with.
const STROKE_OPTIONS = {
  size: 22,
  thinning: 0.55,
  smoothing: 0.55,
  streamline: 0.55,
  start: { taper: 20, cap: true },
  end: { taper: 20, cap: true },
  simulatePressure: true,
} as const;

/**
 * Turn perfect-freehand's outline polygon into an SVG `d` attribute.
 * Adapted from the reference snippet in perfect-freehand's README.
 */
function outlineToPath(outline: number[][]): string {
  if (outline.length === 0) return '';
  const d: string[] = [];
  const [x0, y0] = outline[0];
  d.push(`M ${x0.toFixed(2)} ${y0.toFixed(2)}`);
  for (let i = 1; i < outline.length; i++) {
    const [x1, y1] = outline[i];
    const [x2, y2] = outline[(i + 1) % outline.length];
    d.push(
      `Q ${x1.toFixed(2)} ${y1.toFixed(2)} ${((x1 + x2) / 2).toFixed(2)} ${((y1 + y2) / 2).toFixed(2)}`,
    );
  }
  d.push('Z');
  return d.join(' ');
}

function strokeToPath(stroke: Stroke, isLive: boolean): string {
  if (stroke.points.length === 0) return '';
  const inputs = stroke.points.map((p) => [p.x, p.y, p.pressure] as [number, number, number]);
  const outline = getStroke(inputs, {
    ...STROKE_OPTIONS,
    // When pen pressure is real, don't let velocity-simulated pressure
    // fight with the device signal.
    simulatePressure: stroke.pointerType !== 'pen',
    // `last: true` produces a closed, properly-tapered stroke once the
    // pointer lifts - live strokes keep `last: false` to avoid jitter.
    last: !isLive,
  });
  return outlineToPath(outline);
}

export function DrawingCanvas({
  onPredict,
  onStroke,
  onClear,
  onStrokeCountChange,
  clearSignal = 0,
  sampleSignal = 0,
  sampleStrokes = null,
  disabled = false,
  isLoading = false,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [state, dispatch] = useReducer(strokeReducer, initialStrokeState);
  const [isDrawing, setIsDrawing] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Keep a ref mirror of the latest strokes so debounced prediction
  // always rasterizes the freshest state (reducer updates are async).
  const presentRef = useRef<Stroke[]>(state.present);
  useEffect(() => {
    presentRef.current = state.present;
  }, [state.present]);

  // Debounce handle for live prediction during pointermove.
  const predictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProgrammaticPredictRef = useRef(false);
  const clearPredictTimer = useCallback(() => {
    if (predictTimerRef.current !== null) {
      clearTimeout(predictTimerRef.current);
      predictTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    onStrokeCountChange?.(state.present.length);
  }, [onStrokeCountChange, state.present.length]);

  // Rasterize the current strokes to a 28x28 offscreen canvas and
  // return 784 Float32 values in [0, 1], white-on-black - matching
  // the signature of the original Canvas 2D implementation so the
  // C++ server and App.tsx stay unchanged.
  const extractPixels = useCallback((): number[] => {
    const strokes = presentRef.current;
    const empty = () => new Array<number>(GRID_SIZE * GRID_SIZE).fill(0);
    if (strokes.length === 0) {
      return empty();
    }

    // 1. Draw the strokes white-on-black on a 280x280 backing canvas.
    const full = document.createElement('canvas');
    full.width = CANVAS_SIZE;
    full.height = CANVAS_SIZE;
    const fullCtx = full.getContext('2d');
    if (!fullCtx) return [];
    fullCtx.fillStyle = '#000000';
    fullCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    fullCtx.fillStyle = '#FFFFFF';
    for (const stroke of strokes) {
      const d = strokeToPath(stroke, false);
      if (!d) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PathCtor = (window as any).Path2D;
      if (PathCtor) fullCtx.fill(new PathCtor(d));
    }

    // 2. MNIST normalization. The training data is not raw pixels: each
    //    digit is cropped to its ink, scaled to fit a 20x20 box, and then
    //    centered by center of mass inside 28x28. Skipping this leaves a
    //    large or off-center drawing out-of-distribution and confidence
    //    collapses toward uniform. Reproduce that pipeline here so the
    //    browser input matches what the network was trained on.
    const fullData = fullCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
    const INK = 16; // red-channel threshold (~6%) to ignore AA fringing
    let minX = CANVAS_SIZE;
    let minY = CANVAS_SIZE;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < CANVAS_SIZE; y += 1) {
      for (let x = 0; x < CANVAS_SIZE; x += 1) {
        if (fullData[(y * CANVAS_SIZE + x) * 4] > INK) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return empty();

    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const TARGET = 20; // MNIST fits the glyph inside a 20x20 window
    const scale = TARGET / Math.max(boxW, boxH);
    const drawW = Math.max(1, Math.round(boxW * scale));
    const drawH = Math.max(1, Math.round(boxH * scale));

    // 2a. Crop to the ink and draw it scaled + bbox-centered into 28x28.
    const bbox = document.createElement('canvas');
    bbox.width = GRID_SIZE;
    bbox.height = GRID_SIZE;
    const bctx = bbox.getContext('2d');
    if (!bctx) return [];
    bctx.fillStyle = '#000000';
    bctx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
    bctx.drawImage(
      full,
      minX,
      minY,
      boxW,
      boxH,
      (GRID_SIZE - drawW) / 2,
      (GRID_SIZE - drawH) / 2,
      drawW,
      drawH,
    );

    // 2b. Shift so the center of mass lands on the 28x28 center (13.5, 13.5).
    const bboxData = bctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE).data;
    let mass = 0;
    let sumX = 0;
    let sumY = 0;
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const v = bboxData[(y * GRID_SIZE + x) * 4];
        if (v > 0) {
          mass += v;
          sumX += v * x;
          sumY += v * y;
        }
      }
    }
    const shiftX = mass > 0 ? Math.round((GRID_SIZE - 1) / 2 - sumX / mass) : 0;
    const shiftY = mass > 0 ? Math.round((GRID_SIZE - 1) / 2 - sumY / mass) : 0;

    const small = document.createElement('canvas');
    small.width = GRID_SIZE;
    small.height = GRID_SIZE;
    const smallCtx = small.getContext('2d');
    if (!smallCtx) return [];
    smallCtx.fillStyle = '#000000';
    smallCtx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
    smallCtx.drawImage(bbox, shiftX, shiftY);
    const { data } = smallCtx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);

    const pixels: number[] = new Array(GRID_SIZE * GRID_SIZE);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      // Red channel as grayscale intensity (strokes are white).
      pixels[j] = data[i] / 255;
    }
    return pixels;
  }, []);

  const schedulePrediction = useCallback(() => {
    clearPredictTimer();
    predictTimerRef.current = setTimeout(() => {
      const pixels = extractPixels();
      onPredict(pixels);
    }, LIVE_PREDICT_DEBOUNCE_MS);
  }, [clearPredictTimer, extractPixels, onPredict]);

  // Coordinate conversion: CSS pixel -> SVG viewBox (0..280).
  const toSvgCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const sx = CANVAS_SIZE / rect.width;
    const sy = CANVAS_SIZE / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    // Left mouse / primary touch / pen only.
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);

    const { x, y } = toSvgCoords(e.clientX, e.clientY);
    // Mouse/touch have no real pressure - fall back to 0.5 and let
    // perfect-freehand's simulatePressure take over.
    const pressure = e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5;
    const stroke: Stroke = {
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      pointerType: (e.pointerType as Stroke['pointerType']) || 'mouse',
      points: [{ x, y, pressure, t: e.timeStamp }],
    };
    dispatch({ type: 'BEGIN_STROKE', stroke });
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || disabled) return;

    // Coalesced events unlock up to ~240Hz capture on Chromium pen input.
    const events =
      typeof e.nativeEvent.getCoalescedEvents === 'function'
        ? e.nativeEvent.getCoalescedEvents()
        : [];
    const sources: Array<{
      clientX: number;
      clientY: number;
      pressure: number;
      timeStamp: number;
      pointerType: string;
    }> =
      events.length > 0
        ? events.map((c) => ({
            clientX: c.clientX,
            clientY: c.clientY,
            pressure: c.pressure,
            timeStamp: c.timeStamp,
            pointerType: c.pointerType,
          }))
        : [
            {
              clientX: e.clientX,
              clientY: e.clientY,
              pressure: e.pressure,
              timeStamp: e.timeStamp,
              pointerType: e.pointerType,
            },
          ];

    const points: StrokePoint[] = sources.map((s) => {
      const { x, y } = toSvgCoords(s.clientX, s.clientY);
      const pressure = s.pointerType === 'pen' ? s.pressure || 0.5 : 0.5;
      return { x, y, pressure, t: s.timeStamp };
    });

    dispatch({ type: 'EXTEND_STROKE', points });
    schedulePrediction();
  };

  const finishStroke = useCallback(
    (pointerId?: number) => {
      if (!isDrawing) return;
      if (pointerId !== undefined) {
        try {
          svgRef.current?.releasePointerCapture(pointerId);
        } catch {
          /* already released - ignore */
        }
      }
      setIsDrawing(false);
      dispatch({ type: 'END_STROKE' });
      onStroke?.();
      clearPredictTimer();
      // Fire prediction synchronously on lift so the user sees the
      // final answer even if they drew faster than the debounce.
      const pixels = extractPixels();
      onPredict(pixels);
    },
    [clearPredictTimer, isDrawing, extractPixels, onPredict, onStroke],
  );

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    finishStroke(e.pointerId);
  };

  const handlePointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    finishStroke(e.pointerId);
  };

  // Hotkeys - cmd/ctrl+z, cmd/ctrl+shift+z. enableOnFormTags:false keeps
  // these from firing while the user types in other inputs.
  useHotkeys(
    'mod+z',
    (evt) => {
      evt.preventDefault();
      dispatch({ type: 'UNDO' });
    },
    { enableOnFormTags: false, enabled: !disabled },
  );
  useHotkeys(
    'mod+shift+z',
    (evt) => {
      evt.preventDefault();
      dispatch({ type: 'REDO' });
    },
    { enableOnFormTags: false, enabled: !disabled },
  );

  // Re-predict whenever the committed stroke set changes from UNDO/REDO/CLEAR
  // (pointer-driven paths already call onPredict directly on pointerup).
  useEffect(() => {
    if (isDrawing) return;
    if (pendingProgrammaticPredictRef.current) return;
    // Only re-predict when there is something to predict.
    if (state.present.length === 0) return;
    schedulePrediction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.present, isDrawing]);

  // Clean up any outstanding debounce on unmount.
  useEffect(() => () => clearPredictTimer(), [clearPredictTimer]);

  const handleClear = () => {
    if (disabled && state.present.length === 0) return;
    clearPredictTimer();
    dispatch({ type: 'CLEAR' });
    onClear?.();
  };

  useEffect(() => {
    if (clearSignal === 0) return;
    clearPredictTimer();
    dispatch({ type: 'CLEAR' });
  }, [clearPredictTimer, clearSignal]);

  useEffect(() => {
    if (sampleSignal === 0 || !sampleStrokes || sampleStrokes.length === 0) return;
    clearPredictTimer();
    pendingProgrammaticPredictRef.current = true;
    dispatch({ type: 'LOAD_STROKES', strokes: sampleStrokes });
  }, [clearPredictTimer, sampleSignal, sampleStrokes]);

  useEffect(() => {
    if (!pendingProgrammaticPredictRef.current) return;
    pendingProgrammaticPredictRef.current = false;
    const pixels = extractPixels();
    onPredict(pixels);
  }, [state.present, extractPixels, onPredict]);

  // Pre-render path strings so we're not recomputing on every render
  // for strokes that haven't changed.
  const renderedPaths = useMemo(() => {
    const last = state.present.length - 1;
    return state.present.map((stroke, i) => ({
      id: stroke.id,
      d: strokeToPath(stroke, i === last && isDrawing),
    }));
  }, [state.present, isDrawing]);

  // Faint 28x28 grid. Hidden as soon as the user starts drawing.
  const gridLines = useMemo(() => {
    const lines: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 1; i < GRID_SIZE; i++) {
      const p = i * CELL;
      lines.push({ key: `v${i}`, x1: p, y1: 0, x2: p, y2: CANVAS_SIZE });
      lines.push({ key: `h${i}`, x1: 0, y1: p, x2: CANVAS_SIZE, y2: p });
    }
    return lines;
  }, []);

  const strokeCount = state.present.length;
  const gridOpacityTarget = prefersReducedMotion ? 0.25 : strokeCount === 0 ? 0.4 : 0;

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  return (
    <div className="drawing-canvas-container">
      {isLoading && (
        <div className="canvas-loading-overlay">
          <div className="mini-spinner"></div>
          <span>Analyzing...</span>
        </div>
      )}
      <svg
        ref={svgRef}
        className="drawing-canvas"
        viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        role="img"
        aria-label={`drawing surface, ${strokeCount} stroke${strokeCount === 1 ? '' : 's'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={(e) => {
          // Only treat "leave" as end-of-stroke if we don't have
          // pointer capture - with capture the pointer stays ours.
          if (isDrawing && !svgRef.current?.hasPointerCapture(e.pointerId)) {
            finishStroke(e.pointerId);
          }
        }}
        style={{
          background: '#0c0d0e',
          border: '1px solid var(--canvas-border, var(--line, #2a2a2c))',
          borderRadius: '10px',
          cursor: disabled ? 'not-allowed' : 'crosshair',
          touchAction: 'none',
          display: 'block',
          maxWidth: '100%',
          height: 'auto',
        }}
      >
        {/* Faint 28x28 grid overlay. */}
        <m.g
          aria-hidden
          initial={false}
          animate={{ opacity: gridOpacityTarget }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
          pointerEvents="none"
        >
          {gridLines.map((l) => (
            <line
              key={l.key}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="rgb(255 255 255 / 0.055)"
              strokeWidth={1}
            />
          ))}
        </m.g>

        {/* Strokes. White fill to match the 28x28 white-on-black extraction. */}
        <g>
          {renderedPaths.map((p) =>
            p.d ? <path key={p.id} d={p.d} fill="#FFFFFF" stroke="none" /> : null,
          )}
        </g>
      </svg>

      <div className="canvas-buttons">
        <m.button
          type="button"
          onClick={handleClear}
          disabled={disabled || strokeCount === 0}
          className="canvas-icon-button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={springs.quick}
          aria-label="Clear drawing"
          data-tooltip="Clear"
          title="Clear"
        >
          <Trash2 size={18} aria-hidden />
        </m.button>
        <m.button
          type="button"
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={disabled || !canUndo}
          className="canvas-icon-button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={springs.quick}
          aria-label="Undo last stroke (Cmd+Z)"
          title="Undo (⌘Z)"
          data-tooltip="Undo"
        >
          <Undo2 size={18} aria-hidden />
        </m.button>
        <m.button
          type="button"
          onClick={() => dispatch({ type: 'REDO' })}
          disabled={disabled || !canRedo}
          className="canvas-icon-button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={springs.quick}
          aria-label="Redo stroke (Cmd+Shift+Z)"
          title="Redo (⌘⇧Z)"
          data-tooltip="Redo"
        >
          <Redo2 size={18} aria-hidden />
        </m.button>
        <m.button
          type="button"
          onClick={() => {
            if (!sampleStrokes || sampleStrokes.length === 0) return;
            pendingProgrammaticPredictRef.current = true;
            dispatch({ type: 'LOAD_STROKES', strokes: sampleStrokes });
          }}
          disabled={disabled || !sampleStrokes || sampleStrokes.length === 0}
          className="canvas-icon-button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={springs.quick}
          aria-label="Reload sample digit"
          title="Reload sample"
          data-tooltip="Sample"
        >
          <RotateCcw size={18} aria-hidden />
        </m.button>
      </div>

      {/* Live-region so screen readers hear a summary of the drawing state. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {strokeCount === 0
          ? 'canvas empty'
          : `${strokeCount} stroke${strokeCount === 1 ? '' : 's'} drawn`}
      </div>
    </div>
  );
}
