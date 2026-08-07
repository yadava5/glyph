import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import type { VisualState } from '../features/experience/scrollScenes';

const Scene = lazy(() => import('./NeuralNetHero.Scene'));

interface Props {
  className?: string;
  visualState?: VisualState | 'hero';
}

export function NeuralNetHero({ className, visualState = 'hero' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={ref} className={cn('relative aspect-square w-full max-w-lg', className)}>
      {!shouldLoad && (
        <img
          src="/hero-poster.svg"
          alt=""
          aria-hidden
          className="hero-poster absolute inset-0 h-full w-full object-contain"
        />
      )}
      {shouldLoad && (
        <Suspense fallback={null}>
          <Scene visualState={visualState} />
        </Suspense>
      )}
    </div>
  );
}
