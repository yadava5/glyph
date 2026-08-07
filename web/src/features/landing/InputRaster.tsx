import { useEffect, useRef } from 'react';
import styles from './Workbench.module.css';

const GRID = 28;

interface InputRasterProps {
  pixels: number[] | null;
}

/**
 * "What the network sees" — the exact 784-value vector submitted to the
 * classifier, rendered as a crisp magnified 28x28 raster. This is not an
 * illustration: it is the model input, after bounding-box crop, 20x20
 * fit, and center-of-mass centering.
 */
export function InputRaster({ pixels }: InputRasterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, GRID, GRID);
    if (!pixels || pixels.length !== GRID * GRID) return;

    const image = ctx.createImageData(GRID, GRID);
    for (let i = 0; i < GRID * GRID; i += 1) {
      const v = Math.round(Math.min(1, Math.max(0, pixels[i])) * 255);
      image.data[i * 4] = v;
      image.data[i * 4 + 1] = v;
      image.data[i * 4 + 2] = v;
      image.data[i * 4 + 3] = v > 0 ? 255 : 0;
    }
    ctx.putImageData(image, 0, 0);
  }, [pixels]);

  return (
    <div className={styles.rasterBox} data-empty={!pixels}>
      <canvas
        ref={canvasRef}
        width={GRID}
        height={GRID}
        className={styles.rasterCanvas}
        aria-label="The 28 by 28 pixel input as the network receives it"
        role="img"
      />
      {!pixels && <span className={styles.rasterEmpty}>awaiting ink</span>}
    </div>
  );
}
