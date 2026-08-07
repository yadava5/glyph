import { useEffect, useRef } from 'react';

interface HiddenHeatmapProps {
  /** Hidden-layer post-activation values. Expected in [0, 1]. */
  hiddenActivations?: number[];
  /** Rendered pixel size (square canvas). Device-pixel-ratio aware. */
  size?: number;
}

/**
 * Panel 2: hidden-layer activations as a square heatmap.
 *
 * - Arranges N activations into a ceil(sqrt(N)) x ceil(N/cols) grid.
 * - Colormap: chroma-up on the violet accent -
 *     oklch(${0.3 + 0.5 * a} 0.22 280)
 *   so higher activation = brighter violet.
 * - Top-5% activations get a soft violet glow (rendered as a second
 *   pass with a larger, translucent fill under the cell).
 * - When `hiddenActivations` is absent, renders a uniform grid at 30%
 *   opacity as a neutral fallback.
 */
export function HiddenHeatmap({ hiddenActivations, size = 220 }: HiddenHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activations = hiddenActivations;
  const present = !!activations && activations.length > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const n = present ? activations.length : 100;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cell = Math.floor(Math.min(size / cols, size / rows));
    const offsetX = Math.floor((size - cell * cols) / 2);
    const offsetY = Math.floor((size - cell * rows) / 2);

    // Find 95th percentile threshold for glow highlights.
    let threshold = Infinity;
    if (present) {
      const sorted = [...activations].sort((a, b) => a - b);
      const idx = Math.max(0, Math.floor(sorted.length * 0.95) - 1);
      threshold = sorted[idx] ?? Infinity;
    }

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = offsetX + col * cell;
      const y = offsetY + row * cell;
      const a = present ? Math.max(0, Math.min(1, activations[i])) : 0;

      if (present && a >= threshold && a > 0) {
        // Soft glow for top-5% cells. Drawn before the cell so it sits
        // under it and fringes out by ~2px. Monochrome: white ink only.
        ctx.fillStyle = `oklch(${0.25 + 0.72 * a} 0 0 / 0.55)`;
        ctx.fillRect(x - 2, y - 2, cell + 4, cell + 4);
      }

      if (present) {
        // Value-only colormap: brighter = more activated.
        ctx.fillStyle = `oklch(${0.22 + 0.72 * a} 0 0)`;
      } else {
        ctx.fillStyle = 'rgb(255 255 255 / 0.05)';
      }
      ctx.fillRect(x, y, cell - 1, cell - 1);
    }
  }, [activations, present, size]);

  const count = present ? activations.length : 0;
  const label = present ? `Hidden (${count})` : 'Hidden';

  return (
    <div className="activation-panel">
      <span className="activation-panel-label">{label}</span>
      <canvas
        ref={canvasRef}
        className="activation-canvas"
        style={{ width: '100%', height: 'auto', aspectRatio: '1' }}
        aria-label="Hidden layer activation heatmap"
      />
    </div>
  );
}
