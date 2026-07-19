import { useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import styles from './LaneField.module.css';

/*
 * The living ground: fast-mnist's own domain rendered as a background. Faint
 * vertical VECTOR LANES with light "carriers" streaming down them — work
 * flowing through SIMD lanes / MNIST ink streaming past. The lanes near the
 * cursor brighten (the machine notices you). It is deliberately dim so text
 * stays crisp on top.
 *
 * Perf: everything animated is a CSS transform/opacity on a compositor layer,
 * so the main thread — and therefore the live wasm bench — is never touched.
 * The only JS is a rAF-throttled pointer read that writes two CSS variables.
 * Reduced-motion freezes the carriers to a static field; no autonomous motion.
 * Rendered OUTSIDE #hero and aria-hidden.
 */

interface Carrier {
  lane: number; // vw offset
  width: number;
  height: number;
  dur: number;
  delay: number;
  hue: 'sky' | 'amber' | 'steel';
  opacity: number;
}

function buildCarriers(): Carrier[] {
  // Deterministic pseudo-random so every visitor sees the same calm field.
  let seed = 0x9e3779b9;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 100000) / 100000;
  };
  const hues: Carrier['hue'][] = ['sky', 'sky', 'sky', 'steel', 'amber'];
  return Array.from({ length: 16 }, () => {
    const r = rand();
    return {
      lane: 3 + rand() * 94,
      width: r < 0.75 ? 1 : 2,
      height: 22 + rand() * 26,
      dur: 9 + rand() * 12,
      delay: -rand() * 20,
      hue: hues[Math.floor(rand() * hues.length)],
      opacity: 0.05 + rand() * 0.14,
    };
  });
}

export function LaneField() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const carriers = useMemo(() => buildCarriers(), []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        el.style.setProperty('--px', `${(e.clientX / window.innerWidth) * 100}%`);
        el.style.setProperty('--py', `${(e.clientY / window.innerHeight) * 100}%`);
        el.style.setProperty('--pon', '1');
      });
    };
    const onLeave = () => el.style.setProperty('--pon', '0');
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div ref={ref} className={styles.field} data-reduced={reduced || undefined} aria-hidden>
      <div className={styles.lanes} />
      <div className={styles.lanesLit} />
      <div className={styles.carriers}>
        {carriers.map((c, i) => (
          <i
            key={i}
            className={styles.carrier}
            data-hue={c.hue}
            style={
              {
                left: `${c.lane}vw`,
                width: `${c.width}px`,
                height: `${c.height}vh`,
                opacity: c.opacity,
                animationDuration: `${c.dur}s`,
                animationDelay: `${c.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className={styles.cursorGlow} />
    </div>
  );
}
