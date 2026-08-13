import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';
import { useReducedMotion } from 'motion/react';
import { useInView, usePointerFine } from './interactionHooks';
import styles from './interactions.module.css';

/*
 * Shared micro-interaction primitives for the landing. Every one of these is
 * a PROGRESSIVE ENHANCEMENT: it degrades to a plain, fully-legible static
 * element under prefers-reduced-motion or a coarse pointer (touch), and it
 * never blocks the main thread while the live wasm bench is measuring.
 *
 * Restraint is the point — 150–260ms, ease-out, a few pixels of travel.
 * Cool-steel palette only (sky / amber / steel), no rainbow.
 */

interface SpotlightProps {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  /** rgb triplet for the glow, e.g. "56 189 248" (sky). */
  glow?: string;
  style?: CSSProperties;
  id?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
}

/**
 * A soft radial glow that tracks the cursor inside the element — the
 * Linear/Stripe "the surface knows where you are" cue, tuned to a single
 * cool accent. Pure CSS var updates (--mx/--my), no React re-render per move.
 */
export function Spotlight({
  as,
  className,
  children,
  glow = '56 189 248',
  style,
  ...rest
}: SpotlightProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Tag: any = as ?? 'div';
  const ref = useRef<HTMLElement>(null);
  const fine = usePointerFine();
  const raf = useRef(0);

  const onMove = (e: React.PointerEvent) => {
    if (!fine) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.setProperty('--mx', `${x}%`);
      el.style.setProperty('--my', `${y}%`);
    });
  };
  const onEnter = () => fine && ref.current?.style.setProperty('--spot', '1');
  const onLeave = () => ref.current?.style.setProperty('--spot', '0');

  return (
    <Tag
      ref={ref}
      className={`${styles.spotlight} ${className ?? ''}`}
      style={{ '--glow': glow, ...style } as CSSProperties}
      onPointerMove={onMove}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      {...rest}
    >
      {children}
    </Tag>
  );
}

interface TiltProps {
  className?: string;
  children: ReactNode;
  max?: number;
  style?: CSSProperties;
}

/**
 * Small perspective tilt following the cursor — a plain rAF that writes one
 * transform per frame, smoothed by a CSS transition (no animation runtime,
 * no continuous main-thread work while the bench is measuring).
 */
export function Tilt({ className, children, max = 5, style }: TiltProps) {
  const fine = usePointerFine();
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  const onMove = (e: React.PointerEvent) => {
    if (!fine) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(900px) rotateX(${(-py * max * 2).toFixed(2)}deg) rotateY(${(
        px *
        max *
        2
      ).toFixed(2)}deg)`;
    });
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = '';
  };

  if (!fine) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className={`${styles.tilt} ${className ?? ''}`}
      style={style}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      {children}
    </div>
  );
}

interface MagneticProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  strength?: number;
  'aria-label'?: string;
}

/** A button that leans toward the cursor and eases back on leave (CSS-sprung). */
export function MagneticButton({
  children,
  className,
  onClick,
  type = 'button',
  strength = 0.3,
  ...rest
}: MagneticProps) {
  const fine = usePointerFine();
  const ref = useRef<HTMLButtonElement>(null);
  const raf = useRef(0);

  const onMove = (e: React.PointerEvent) => {
    if (!fine) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const dx = (e.clientX - (r.left + r.width / 2)) * strength;
    const dy = (e.clientY - (r.top + r.height / 2)) * strength;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      if (ref.current)
        ref.current.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    });
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = '';
  };

  return (
    <button
      ref={ref}
      type={type}
      className={`${styles.magnetic} ${className ?? ''}`}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerLeave={reset}
      {...rest}
    >
      {children}
    </button>
  );
}

interface RollingProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
  /**
   * Where the roll starts. Defaults to 0, but a figure that is the complement
   * of another must count DOWN from the total, or the two disagree with each
   * other on screen for the length of the animation: the accuracy card read
   * "0.00% correct · 299 missed" for about a second, a pair that cannot both be
   * true. Two rolls sharing a duration and an easing, one 0 → correct and one
   * total → missed, sum to the total on every frame by construction.
   */
  from?: number;
  /**
   * Eased progress 0→1 supplied by the caller instead of run internally. Several
   * readouts of the SAME measurement have to move as one: three independent rAF
   * loops drift apart within a frame or two, and the accuracy card showed
   * "3,965 correct" beside "22.46% correct" — two views of one number
   * disagreeing. Pass one progress and they cannot.
   */
  progress?: number;
  /** Re-roll when the element is hovered (a stat that "recomputes"). */
  rerollOnHover?: boolean;
  /** Opt-in: a left-to-right highlight that sweeps across the digits. */
  glow?: boolean;
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

function formatGrouped(value: number, decimals: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * A stat that counts up to its value the first time it scrolls into view — a
 * restrained "slot-machine" roll (tabular-nums, a hair of blur while moving).
 * Accessibility + tests: the FINAL formatted string is always what the
 * element settles to, and reduced-motion renders it immediately with no roll.
 */
export function RollingNumber({
  value,
  from = 0,
  progress,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
  duration = 1100,
  rerollOnHover = false,
  glow = false,
}: RollingProps) {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [display, setDisplay] = useState(reduced ? value : from);
  const driven = progress !== undefined;
  const [runId, setRunId] = useState(0);
  const raf = useRef(0);

  // All state updates happen inside the rAF callback (or the reroll event
  // handler) — never synchronously in the effect body — so the count-up can
  // never cascade renders. Reduced-motion just settles on the value.
  useEffect(() => {
    if (driven || !inView) return;
    if (reduced) {
      raf.current = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(raf.current);
    }
    let startTs = 0;
    const tick = (now: number) => {
      if (!startTs) startTs = now;
      const p = Math.min(1, (now - startTs) / duration);
      setDisplay(p >= 1 ? value : from + (value - from) * easeOutExpo(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [driven, inView, value, from, reduced, duration, runId]);

  const shown = driven && !reduced ? from + (value - from) * progress! : display;
  const rolling = !reduced && shown !== value;
  return (
    <span
      ref={ref}
      className={`${styles.rolling} tabular ${glow ? styles.glow : ''} ${className ?? ''}`}
      data-rolling={rolling || undefined}
      onPointerEnter={rerollOnHover && !reduced ? () => setRunId((n) => n + 1) : undefined}
    >
      {prefix}
      {formatGrouped(display, decimals)}
      {suffix}
    </span>
  );
}

const SCRAMBLE = '01234567890·×/∑λ∆';

interface DecodeProps {
  text: string;
  className?: string;
  as?: ElementType;
}

/**
 * A "decode" reveal: each character resolves out of a brief digit-scramble,
 * left to right — a classifier settling on a readout. Fires once on view.
 * Reduced-motion renders the final string immediately (and it is always the
 * accessible text). Only the visual glyphs scramble; screen readers get the
 * real text via aria-label.
 */
export function Decode({ text, className, as }: DecodeProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Tag: any = as ?? 'span';
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLElement>('0px 0px -18% 0px');
  const [out, setOut] = useState(reduced ? text : '');
  const raf = useRef(0);

  // Every setOut runs inside a rAF callback, so nothing sets state
  // synchronously during the effect. Reduced-motion settles on the text.
  useEffect(() => {
    if (reduced) {
      raf.current = requestAnimationFrame(() => setOut(text));
      return () => cancelAnimationFrame(raf.current);
    }
    if (!inView) return;
    const chars = text.split('');
    const nonSpace = chars.filter((c) => c !== ' ').length;
    let startTs = 0;
    const total = 620 + chars.length * 26;
    const tick = (now: number) => {
      if (!startTs) startTs = now;
      const elapsed = now - startTs;
      let settled = 0;
      const next = chars
        .map((c, i) => {
          if (c === ' ') return ' ';
          const revealAt = (i / chars.length) * (total * 0.6);
          if (elapsed >= revealAt + 260) {
            settled += 1;
            return c;
          }
          if (elapsed >= revealAt) {
            return SCRAMBLE[(Math.floor(elapsed / 40) + i) % SCRAMBLE.length];
          }
          return '';
        })
        .join('');
      setOut(settled < nonSpace ? next : text);
      if (settled < nonSpace) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [inView, text, reduced]);

  return (
    <Tag ref={ref} className={className} aria-label={text}>
      <span aria-hidden>{out || ' '}</span>
    </Tag>
  );
}
