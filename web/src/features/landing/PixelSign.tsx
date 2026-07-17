import styles from './LandingPage.module.css';

/*
 * The closing mark: a word rendered as a dot-matrix raster — the same
 * pixel language as the 28x28 input the network reads. On reveal, lit
 * cells scatter in like activations firing; afterwards a sparse subset
 * keeps shimmering, the machine idling. Pure SVG + CSS, deterministic
 * "randomness" so every visitor sees the same choreography.
 */

const GLYPHS: Record<string, number[]> = {
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
};

const ROWS = 7;
const GLYPH_COLS = 5;
const LETTER_GAP = 2;
const UNIT = 10;
const CELL = 8.4;

interface PixelSignProps {
  word?: string;
}

export function PixelSign({ word = 'FAST' }: PixelSignProps) {
  const letters = word.split('').filter((c) => GLYPHS[c]);
  const totalCols = letters.length * GLYPH_COLS + (letters.length - 1) * LETTER_GAP;

  const cells: { x: number; y: number; lit: boolean; index: number }[] = [];
  letters.forEach((letter, li) => {
    const glyph = GLYPHS[letter];
    const colOffset = li * (GLYPH_COLS + LETTER_GAP);
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < GLYPH_COLS; c += 1) {
        cells.push({
          x: (colOffset + c) * UNIT,
          y: r * UNIT,
          lit: (glyph[r] >> (GLYPH_COLS - 1 - c)) & 1 ? true : false,
          index: cells.length,
        });
      }
    }
  });

  return (
    <svg
      className={styles.pixelSign}
      viewBox={`0 0 ${totalCols * UNIT} ${ROWS * UNIT}`}
      role="img"
      aria-label={word}
    >
      {cells.map((cell) => {
        // Deterministic scatter: a Weyl-style hash spreads reveal delays
        // across ~0.9s without Math.random() re-rolling every render.
        const h = (cell.index * 2654435761) % 1000;
        const delay = (h / 1000) * 0.9;
        const shimmer = cell.lit && cell.index % 9 === 0;
        return (
          <rect
            key={cell.index}
            className={
              cell.lit
                ? shimmer
                  ? `${styles.pixelLit} ${styles.pixelShimmer}`
                  : styles.pixelLit
                : styles.pixelDim
            }
            x={cell.x}
            y={cell.y}
            width={CELL}
            height={CELL}
            rx={1.6}
            style={
              cell.lit
                ? ({
                    '--pixel-delay': `${delay.toFixed(3)}s`,
                    '--shimmer-delay': `${((h % 400) / 100).toFixed(2)}s`,
                  } as React.CSSProperties)
                : undefined
            }
          />
        );
      })}
    </svg>
  );
}
