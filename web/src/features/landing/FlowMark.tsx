import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import styles from './FlowMark.module.css';

/*
 * The signature flow-mark — Glyph's own ending, a full-bleed band at the very
 * bottom of the page. A row of handwritten digits draws itself edge-to-edge,
 * and a sky glow then sweeps left → right across just the digits. Every time it
 * scrolls into view (or you click it) it rolls a fresh random row. No lanes, no
 * sheen — the numbers are the whole mark.
 *
 * Reduced-motion renders the static drawn row with no draw and no glow.
 */

// Single-stroke "handwritten" digit paths in a 120×160 box. Imperfect on
// purpose — these are MNIST-flavoured pen strokes, not a typeface.
const DIGITS: string[] = [
  'M60 26 C32 26 26 62 26 92 C26 128 38 150 60 150 C82 150 94 120 94 90 C94 58 86 26 60 26 Z', // 0
  'M38 48 L64 28 L64 150', // 1
  'M32 50 C30 22 94 18 90 56 C87 84 40 98 28 140 L98 140', // 2
  'M34 42 C42 20 92 22 86 54 C82 74 58 78 58 78 C58 78 94 76 94 110 C94 150 40 150 30 120', // 3
  'M82 28 L28 108 L100 108 M82 64 L82 150', // 4
  'M88 28 L46 28 L42 76 C72 64 96 76 96 108 C96 144 58 152 32 134', // 5
  'M86 32 C62 20 34 44 32 92 C30 134 54 152 62 150 C92 146 96 100 66 96 C44 94 32 112 34 120', // 6
  'M30 30 L98 30 L56 150', // 7
  'M60 84 C32 80 34 30 60 30 C86 30 88 80 60 84 C26 88 24 150 60 150 C96 150 94 88 60 84 Z', // 8
  'M88 74 C86 40 54 26 40 50 C26 74 44 100 66 96 C80 94 88 82 88 74 C88 118 78 146 44 150', // 9
];

/** Initial row (spells π) before the first scroll-in roll. */
const SEED: number[] = [3, 1, 4, 1, 5, 9, 2, 6];

function rollDigits(): number[] {
  return SEED.map(() => Math.floor(Math.random() * 10));
}

export function FlowMark() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const [digits, setDigits] = useState<number[]>(SEED);
  const [cycle, setCycle] = useState(0);
  const [played, setPlayed] = useState(false);

  // Roll a fresh random row and play the draw whenever it scrolls into view
  // (unless reduced-motion → always the static drawn row).
  useEffect(() => {
    if (reduced) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setPlayed(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setDigits(rollDigits());
          setCycle((c) => c + 1);
          setPlayed(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [reduced]);

  const replay = () => {
    setDigits(rollDigits());
    setCycle((c) => c + 1);
    setPlayed(true);
  };

  const animate = played && !reduced;

  return (
    <button
      ref={ref}
      type="button"
      className={styles.mark}
      onClick={replay}
      aria-label="Glyph signature: a row of handwritten digits that redraws with new random numbers. Activate to redraw."
    >
      {/* the handwritten row — the only mark: each digit draws itself, then a
          sky glow sweeps left → right across the row. */}
      <div className={styles.digits} key={`digits-${cycle}`} aria-hidden>
        {digits.map((d, i) => (
          <svg
            key={`${cycle}-${i}`}
            viewBox="0 0 120 160"
            className={styles.digit}
            data-play={animate || undefined}
            style={{ '--dd': `${i * 0.12}s` } as React.CSSProperties}
          >
            <path d={DIGITS[d]} className={styles.stroke} pathLength={1} />
          </svg>
        ))}
      </div>

      <span className={styles.caption}>
        <b>glyph</b>
        <em>handwritten digits · click to redraw</em>
      </span>
    </button>
  );
}
