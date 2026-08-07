import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/*
 * Shared hooks for the landing micro-interactions. Kept in their own module
 * (no component exports) so the component files stay fast-refresh friendly.
 */

/** Fine pointer (mouse/trackpad) AND motion allowed — the gate for cursor tricks. */
export function usePointerFine(): boolean {
  const reduced = useReducedMotion();
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: fine)');
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return fine && !reduced;
}

/**
 * `true` once the node first scrolls into view. When IntersectionObserver is
 * unavailable (SSR / very old browsers) it starts true, so content is never
 * gated behind an observer that will not fire. The only setState is inside the
 * observer callback — never synchronously in the effect body.
 */
export function useInView<T extends Element>(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            obs.unobserve(e.target);
          }
        });
      },
      { rootMargin, threshold: 0.2 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [rootMargin]);
  return { ref, inView };
}
