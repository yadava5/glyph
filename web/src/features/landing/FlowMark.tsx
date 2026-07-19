import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import styles from './FlowMark.module.css';

/*
 * The signature flow-mark — fast-mnist's own ending, not a borrowed wordmark.
 * A handwritten digit draws itself stroke-first, then RESOLVES INTO SIMD LANES:
 * the ink dissolves as eight vector lanes rise through it, the sky rung (wasm,
 * the one live on this page) glowing brightest. It is the whole thesis in one
 * gesture — a handwritten digit becoming the lanes that classify it.
 *
 * Click (or Enter/Space) to redraw the next digit — a small, on-brand easter
 * egg. Reduced-motion renders the resolved final state, static.
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

const LANES = 8;

export function FlowMark() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const [digit, setDigit] = useState(5);
  const [cycle, setCycle] = useState(0);
  const [played, setPlayed] = useState(false);

  // Play once when it scrolls into view (unless reduced-motion → always final).
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
          setPlayed(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [reduced]);

  const replay = () => {
    setDigit((d) => (d + 1) % 10);
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
      aria-label="fast_mnist signature: a handwritten digit resolving into SIMD lanes. Activate to redraw the next digit."
    >
      <svg viewBox="0 0 120 200" className={styles.svg} role="img" aria-hidden>
        {/* the lanes the digit resolves into */}
        <g className={styles.lanes} key={`lanes-${cycle}`} data-play={animate || undefined}>
          {Array.from({ length: LANES }, (_, i) => {
            const x = 22 + i * 9.6;
            // the middle pair is the "live" sky rung; edges cool to steel
            const hot = i === 3 || i === 4;
            return (
              <rect
                key={i}
                x={x}
                y={22}
                width={5.4}
                height={146}
                rx={2.6}
                className={styles.lane}
                data-hot={hot || undefined}
                style={{ '--d': `${0.9 + i * 0.06}s` } as React.CSSProperties}
              />
            );
          })}
        </g>

        {/* the handwritten digit, drawn then dissolved */}
        <path
          key={`digit-${cycle}-${digit}`}
          d={DIGITS[digit]}
          className={styles.stroke}
          pathLength={1}
          data-play={animate || undefined}
        />
      </svg>
      <span className={styles.caption}>
        <b>fast_mnist</b>
        <em>a handwritten digit → the lanes that classify it</em>
      </span>
    </button>
  );
}
