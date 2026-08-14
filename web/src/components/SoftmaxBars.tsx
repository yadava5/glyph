import { m } from 'motion/react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { springs } from '../lib/springs';

interface SoftmaxBarsProps {
  prediction: number | null;
  confidence: number[];
}

const DIGITS = 10;

/**
 * Panel 3: the softmax read as a ten-column histogram — digits along the
 * base, probability as bar height. A confident verdict is the panel's
 * normal state, and it reads as one lit column over a quiet baseline;
 * the previous ten-row list spent ~170px of the fold printing "0%" nine
 * times whenever the model was sure.
 *
 * Monochrome discipline: the winner speaks in full ink via
 * [data-active], the rest in low-alpha gray — both from the stylesheet.
 * Exact percentages ride the hover title and the accessible label; the
 * verdict card beside this panel already prints the headline figure.
 */
export function SoftmaxBars({ prediction, confidence }: SoftmaxBarsProps) {
  const reduced = useReducedMotion();
  const bars = Array.from({ length: DIGITS }, (_, i) => confidence[i] ?? 0);
  const label =
    prediction === null
      ? 'Per-class confidence: awaiting ink'
      : `Per-class confidence: ${bars.map((c, d) => `${d} ${(c * 100).toFixed(1)}%`).join(', ')}`;

  return (
    <div className="softmax-bars" role="img" aria-label={label}>
      {bars.map((conf, digit) => {
        const isWinner = digit === prediction;
        const pct = Math.max(0, Math.min(1, conf)) * 100;
        return (
          <div
            key={digit}
            className="softmax-col"
            data-active={isWinner || undefined}
            title={`${digit} — ${(conf * 100).toFixed(1)}%`}
          >
            <div className="softmax-track">
              <m.div
                className="softmax-fill"
                initial={reduced ? false : { height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={reduced ? { duration: 0 } : springs.quick}
              />
            </div>
            <span className="softmax-digit tabular" aria-hidden>
              {digit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
