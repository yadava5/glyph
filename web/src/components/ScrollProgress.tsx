import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export function ScrollProgress() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 28,
    mass: 0.65,
  });
  // The spring never quite lands on 0, which leaves a stuck bright nub
  // at the top-left after scrolling back up. Hide the bar entirely at
  // near-zero progress instead.
  const source = reduced ? scrollYProgress : progress;
  const opacity = useTransform(source, [0, 0.004, 0.012], [0, 0, 1]);

  return <motion.div className="scroll-progress" aria-hidden style={{ scaleX: source, opacity }} />;
}
