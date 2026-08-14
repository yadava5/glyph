import { useEffect, useRef } from 'react';
import styles from './InkImprint.module.css';

const GRID = 28;

/**
 * The page remembers your hand: whatever the network last saw — the exact
 * 784-value vector — echoed as a faint fixed imprint behind the acts, so the
 * visitor's own ink becomes the page's watermark. Repainted per
 * classification with a slow develop pulse; under reduced motion the pulse is
 * dropped and the imprint simply is (it is a static image either way).
 * aria-hidden, pointer-inert, and stacked below `.pageContent` (z-index 1) so
 * it can never contest a line of text.
 */
export function InkImprint({ pixels }: { pixels: number[] | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixels || pixels.length !== GRID * GRID) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(GRID, GRID);
    for (let i = 0; i < GRID * GRID; i += 1) {
      const v = Math.round(Math.min(1, Math.max(0, pixels[i])) * 255);
      img.data[i * 4] = 226;
      img.data[i * 4 + 1] = 232;
      img.data[i * 4 + 2] = 240;
      img.data[i * 4 + 3] = v;
    }
    ctx.putImageData(img, 0, 0);
    // Restart the develop pulse for the new ink. Clearing the inline value
    // hands the animation back to the stylesheet (and to its reduced-motion
    // override) after the reflow flush.
    canvas.style.animation = 'none';
    void canvas.offsetWidth;
    canvas.style.animation = '';
  }, [pixels]);

  return (
    <div className={styles.imprint} aria-hidden data-empty={!pixels || undefined}>
      <canvas ref={canvasRef} width={GRID} height={GRID} />
    </div>
  );
}
