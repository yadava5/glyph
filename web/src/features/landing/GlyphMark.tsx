import type { MouseEventHandler } from 'react';
import styles from './GlyphMark.module.css';

/*
 * Glyph wordmark — the site's brand lockup. A monochrome tile in which a
 * single handwritten "2" is drawn straight across four SIMD lanes: HAND over
 * MACHINE, the whole thesis in one mark. On hover / keyboard focus the pen
 * stroke re-draws itself across the lanes — a small, landing-cohesive echo of
 * the footer FlowMark. Reduced-motion renders the finished stroke, static.
 */
export function GlyphMark({ onHome }: { onHome?: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <a className={styles.root} href="#hero" aria-label="Glyph — back to top" onClick={onHome}>
      <svg className={styles.tile} viewBox="0 0 40 40" aria-hidden="true">
        <rect className={styles.chip} x="1" y="1" width="38" height="38" rx="9" />
        <g className={styles.lanes}>
          <line x1="8" y1="11" x2="32" y2="11" />
          <line x1="8" y1="17" x2="32" y2="17" />
          <line x1="8" y1="23" x2="32" y2="23" />
          <line x1="8" y1="29" x2="32" y2="29" />
        </g>
        <path
          className={styles.hand}
          d="M12.5 16 C12.5 10.5 27 9.5 27 15.5 C27 20 17 24 12 30 L29 30"
          pathLength={1}
        />
      </svg>
      <span className={styles.word} aria-hidden="true">
        glyph
      </span>
    </a>
  );
}
