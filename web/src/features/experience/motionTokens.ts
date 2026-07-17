import type { Transition } from 'motion/react';

export const motionTokens = {
  pageSpring: {
    type: 'spring',
    stiffness: 130,
    damping: 30,
    mass: 0.9,
  } satisfies Transition,
  reveal: {
    duration: 0.34,
    ease: [0.22, 1, 0.36, 1],
  } satisfies Transition,
  snap: {
    type: 'spring',
    stiffness: 360,
    damping: 34,
    mass: 0.75,
  } satisfies Transition,
} as const;
