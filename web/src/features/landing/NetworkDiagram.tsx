import { useMemo } from 'react';
import type { MnistDemoController } from '../mnist/useMnistDemoController';
import styles from './LandingPage.module.css';

/*
 * Live anatomy of the 784 -> 100 -> 10 MLP. Not an illustration: when
 * the workbench above has classified ink, this renders the actual
 * telemetry — the true 28x28 input raster, all 100 hidden activations,
 * and the real output confidences. Idle (nothing drawn yet), it holds
 * a dim structural state and invites the visitor upward.
 */

const IN = 28; // input grid side
const HID = 10; // hidden grid side (10x10 = 100 units)

interface NetworkDiagramProps {
  controller: MnistDemoController;
}

export function NetworkDiagram({ controller }: NetworkDiagramProps) {
  const { inputPixels, hiddenActivations, confidence, prediction } = controller;
  const live =
    inputPixels !== null &&
    inputPixels.length === IN * IN &&
    (hiddenActivations?.length ?? 0) === HID * HID &&
    confidence.length === 10;

  // Geometry. viewBox 780 x 320.
  const inCell = 7.5;
  const inX = 30;
  const inY = 50;
  const inSize = IN * inCell; // 210
  const hidCell = 15;
  const hidX = 330;
  const hidY = 78;
  const hidSize = HID * hidCell; // 150
  const outX = 600;
  const outY0 = 42;
  const outGap = 24;

  // Idle placeholder ink: a sparse diagonal wisp so the block reads as
  // an input surface without pretending to be data.
  const idleInput = useMemo(() => {
    const v = new Array(IN * IN).fill(0);
    for (let i = 0; i < IN; i += 1) {
      const c = Math.floor(IN / 2 + Math.sin(i / 4.2) * 5);
      if (c > 0 && c < IN - 1) {
        v[i * IN + c] = 0.5;
        v[i * IN + c + 1] = 0.28;
      }
    }
    return v;
  }, []);

  const inputVals = live ? inputPixels : idleInput;
  const hiddenVals = live ? hiddenActivations! : null;

  // Representative fan-out curves (structure, not per-weight claims).
  const inEdgeYs = [0.12, 0.3, 0.5, 0.7, 0.88].map((f) => inY + inSize * f);
  const hidEdgeYs = [0.15, 0.5, 0.85].map((f) => hidY + hidSize * f);

  return (
    <div className={styles.netWrap} data-live={live || undefined}>
      <svg
        viewBox="0 0 780 320"
        className={styles.netSvg}
        role="img"
        aria-label={
          live
            ? `Live network state: input raster, 100 hidden activations, predicted ${prediction}`
            : 'Network anatomy: 784 inputs, 100 hidden units, 10 outputs'
        }
      >
        {/* input: the true 28x28 raster */}
        <g>
          {inputVals.map((v, i) => {
            const a = Math.max(0, Math.min(1, v));
            if (a < 0.02) return null;
            return (
              <rect
                key={`i${i}`}
                x={inX + (i % IN) * inCell}
                y={inY + Math.floor(i / IN) * inCell}
                width={inCell - 1}
                height={inCell - 1}
                fill={`rgb(247 248 248 / ${(0.12 + a * 0.85).toFixed(2)})`}
              />
            );
          })}
          <rect
            x={inX - 4}
            y={inY - 4}
            width={inSize + 8}
            height={inSize + 8}
            className={styles.netFrame}
            rx={6}
          />
          <text x={inX} y={inY + inSize + 26} className={styles.netLabel}>
            784 inputs
          </text>
          <text x={inX} y={inY + inSize + 42} className={styles.netSub}>
            {live ? 'your ink, rasterized' : '28 × 28 grayscale'}
          </text>
        </g>

        {/* input -> hidden flow */}
        {inEdgeYs.map((y1, i) =>
          hidEdgeYs.map((y2, j) => (
            <path
              key={`e${i}-${j}`}
              d={`M ${inX + inSize + 8} ${y1} C ${inX + inSize + 80} ${y1}, ${hidX - 80} ${y2}, ${hidX - 10} ${y2}`}
              className={styles.netEdge}
            />
          )),
        )}

        {/* hidden: all 100 units, real activations when live */}
        <g>
          {Array.from({ length: HID * HID }, (_, i) => {
            const a = hiddenVals
              ? Math.max(0, Math.min(1, hiddenVals[i]))
              : 0.08 + ((i * 37) % 11) / 110;
            return (
              <rect
                key={`h${i}`}
                x={hidX + (i % HID) * hidCell}
                y={hidY + Math.floor(i / HID) * hidCell}
                width={hidCell - 2}
                height={hidCell - 2}
                rx={2}
                fill={`rgb(247 248 248 / ${(0.05 + a * 0.85).toFixed(2)})`}
              />
            );
          })}
          <rect
            x={hidX - 5}
            y={hidY - 5}
            width={hidSize + 10}
            height={hidSize + 10}
            className={styles.netFrame}
            rx={6}
          />
          <text x={hidX} y={hidY + hidSize + 27} className={styles.netLabel}>
            100 hidden · sigmoid
          </text>
          <text x={hidX} y={hidY + hidSize + 43} className={styles.netSub}>
            {live ? 'live activations' : '78,400 weights + 100 biases in'}
          </text>
        </g>

        {/* hidden -> output flow */}
        {hidEdgeYs.map((y1, i) =>
          [1, 4, 8].map((j) => (
            <path
              key={`f${i}-${j}`}
              d={`M ${hidX + hidSize + 8} ${y1} C ${hidX + hidSize + 70} ${y1}, ${outX - 70} ${outY0 + j * outGap + 5}, ${outX - 12} ${outY0 + j * outGap + 5}`}
              className={styles.netEdge}
            />
          )),
        )}

        {/* output: ten classes, real confidence bars when live */}
        <g>
          {Array.from({ length: 10 }, (_, d) => {
            const y = outY0 + d * outGap;
            const conf = live ? Math.max(0, Math.min(1, confidence[d])) : 0;
            const winner = live && prediction === d;
            return (
              <g key={`o${d}`}>
                <text x={outX} y={y + 9} className={winner ? styles.netDigitLit : styles.netDigit}>
                  {d}
                </text>
                <rect
                  x={outX + 22}
                  y={y + 1}
                  width={110}
                  height={7}
                  rx={3.5}
                  fill="rgb(255 255 255 / 0.06)"
                />
                {live && conf > 0.005 && (
                  <rect
                    x={outX + 22}
                    y={y + 1}
                    width={Math.max(3, conf * 110)}
                    height={7}
                    rx={3.5}
                    fill={winner ? 'rgb(247 248 248 / 0.95)' : 'rgb(247 248 248 / 0.3)'}
                  />
                )}
                {winner && (
                  <text x={outX + 142} y={y + 9} className={styles.netPct}>
                    {(conf * 100).toFixed(1)}%
                  </text>
                )}
              </g>
            );
          })}
          <text x={outX} y={outY0 + 10 * outGap + 12} className={styles.netLabel}>
            10 outputs
          </text>
        </g>
      </svg>
      <p className={styles.netCaption}>
        {live ? (
          <>
            <i aria-hidden /> live — mirroring the ink you gave the workbench above
          </>
        ) : (
          'Draw in the workbench above and this diagram comes alive with the real activations.'
        )}
      </p>
    </div>
  );
}
