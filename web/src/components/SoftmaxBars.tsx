import { m } from 'motion/react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { springs } from '../lib/springs';

interface SoftmaxBarsProps {
  prediction: number | null;
  confidence: number[];
}

const DIGITS = 10;
// Monochrome discipline: the winner speaks in full ink, the rest in
// low-alpha gray. Meaning is carried by value, not hue.
const WINNER_COLOR = '#f7f8f8';
const OTHER_COLOR = 'rgb(255 255 255 / 0.30)';

/**
 * Panel 3: horizontal softmax bars for digits 0-9.
 *
 * Uses SVG + Motion so the bar widths get proper spring physics on
 * prediction updates. The winning bar pulses briefly when it changes.
 * Falls back to instant widths when the user prefers reduced motion.
 */
export function SoftmaxBars({ prediction, confidence }: SoftmaxBarsProps) {
  const reduced = useReducedMotion();
  const bars = Array.from({ length: DIGITS }, (_, i) => confidence[i] ?? 0);

  return (
    <div className="softmax-bars" role="group" aria-label="Per-class confidence">
      {bars.map((conf, digit) => {
        const isWinner = digit === prediction;
        const pct = Math.max(0, Math.min(1, conf)) * 100;
        return (
          <div key={digit} className="softmax-row">
            <span className="softmax-digit tabular" aria-hidden>
              {digit}
            </span>
            <div className="softmax-track">
              <m.div
                key={`${digit}-${isWinner ? 'win' : 'lose'}`}
                className="softmax-fill"
                style={{ background: isWinner ? WINNER_COLOR : OTHER_COLOR }}
                initial={reduced ? false : { width: 0, scaleY: 1 }}
                animate={
                  reduced
                    ? { width: `${pct}%` }
                    : isWinner
                      ? { width: `${pct}%`, scaleY: [1, 1.03, 1] }
                      : { width: `${pct}%` }
                }
                transition={
                  reduced
                    ? { duration: 0 }
                    : isWinner
                      ? { width: springs.quick, scaleY: { duration: 0.2 } }
                      : springs.quick
                }
              />
            </div>
            <span className="softmax-pct tabular">{(conf * 100).toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}
