import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Activity, Binary, BrainCircuit, Cpu, Gauge, Layers3 } from 'lucide-react';
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from 'motion/react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { motionTokens } from './motionTokens';
import { forwardPassScenes, type VisualState } from './scrollScenes';
import styles from './ForwardPassStory.module.css';

const rasterCells = Array.from({ length: 64 }, (_, index) => {
  const x = index % 8;
  const y = Math.floor(index / 8);
  return x === 4 || y === 1 || (x > 1 && x < 6 && y > 4) || (x === 2 && y > 2 && y < 7);
});

const simdLaneValues = [92, 58, 76, 44, 88, 62, 70, 96];
const hiddenValues = [42, 77, 58, 91, 64, 36, 83, 69, 55, 97, 73, 48];
const softmaxValues = [8, 14, 6, 18, 11, 92, 20, 7, 13, 17];
const benchmarkValues = [100, 99, 86];

function StageIcon({ stage }: { stage: VisualState }) {
  if (stage === 'raster') return <Binary size={16} strokeWidth={1.8} aria-hidden />;
  if (stage === 'simd') return <Cpu size={16} strokeWidth={1.8} aria-hidden />;
  if (stage === 'hidden') return <BrainCircuit size={16} strokeWidth={1.8} aria-hidden />;
  if (stage === 'softmax') return <Activity size={16} strokeWidth={1.8} aria-hidden />;
  return <Gauge size={16} strokeWidth={1.8} aria-hidden />;
}

function TensorVisual({ activeStage }: { activeStage: VisualState }) {
  return (
    <div className={styles.tensorVisual} data-stage={activeStage} aria-hidden>
      <div className={styles.rasterGrid}>
        {rasterCells.map((active, index) => (
          <span key={index} data-active={active} />
        ))}
      </div>

      <div className={styles.simdLanes}>
        {simdLaneValues.map((value, index) => (
          <span key={index}>
            <i style={{ width: `${value}%` }} />
          </span>
        ))}
      </div>

      <div className={styles.hiddenCloud}>
        {hiddenValues.map((value, index) => (
          <span
            key={index}
            style={
              {
                '--activation': value / 100,
                '--delay': `${index * 42}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className={styles.softmaxStack}>
        {softmaxValues.map((value, index) => (
          <span key={index} data-winner={index === 5}>
            <b>{index}</b>
            <i style={{ height: `${value}%` }} />
          </span>
        ))}
      </div>

      <div className={styles.benchmarkBars}>
        {['baseline', 'native', 'openmp'].map((label, index) => (
          <span key={label}>
            <b>{label}</b>
            <i style={{ width: `${benchmarkValues[index]}%` }} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function ForwardPassStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const totalVh = useMemo(
    () => forwardPassScenes.reduce((sum, scene) => sum + scene.heightVh, 0),
    [],
  );

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: reduced ? 1000 : 96,
    damping: reduced ? 100 : 26,
    mass: 0.7,
  });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    const index = Math.min(
      forwardPassScenes.length - 1,
      Math.max(0, Math.floor(latest * forwardPassScenes.length)),
    );
    setActiveIndex(index);
  });

  const activeScene = forwardPassScenes[activeIndex] ?? forwardPassScenes[0];
  const x = useTransform(progress, [0, 0.5, 1], activeScene.keyframes.x);
  const y = useTransform(progress, [0, 0.5, 1], activeScene.keyframes.y);
  const scale = useTransform(progress, [0, 0.5, 1], activeScene.keyframes.scale);
  const rotateX = useTransform(progress, [0, 0.5, 1], activeScene.keyframes.rotateX);
  const rotateY = useTransform(progress, [0, 0.5, 1], activeScene.keyframes.rotateY);
  const opacity = useTransform(progress, [0, 0.5, 1], activeScene.keyframes.opacity);
  const filter = useTransform(progress, [0, 0.5, 1], activeScene.keyframes.filter);

  return (
    <section
      id="forward-pass"
      className={styles.section}
      ref={sectionRef}
      style={{ '--story-height': `${totalVh}svh` } as CSSProperties}
      aria-labelledby="forward-pass-title"
    >
      <div className={styles.grid}>
        <div className={styles.stickyStage}>
          <div className={styles.stageHeader}>
            <span>
              <Layers3 size={16} strokeWidth={1.8} aria-hidden />
              Scroll-linked forward pass
            </span>
            <strong>{activeScene.navLabel}</strong>
          </div>

          <motion.div
            className={styles.stagePlate}
            data-stage={activeScene.visualState}
            style={reduced ? undefined : { x, y, scale, rotateX, rotateY, opacity, filter }}
            transition={motionTokens.pageSpring}
          >
            <TensorVisual activeStage={activeScene.visualState} />
            <div className={styles.metricReadout}>
              <span>{activeScene.metric.label}</span>
              <strong>{activeScene.metric.value}</strong>
              <small>{activeScene.metric.detail}</small>
            </div>
          </motion.div>

          <div className={styles.stageNav} aria-label="Forward-pass scene progress">
            {forwardPassScenes.map((scene, index) => (
              <span key={scene.id} data-active={index === activeIndex}>
                {scene.navLabel}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.sceneRail}>
          <div className={styles.storyIntro}>
            <span className={styles.kicker}>Pixels become tensors</span>
            <h2 id="forward-pass-title">C++ runs the forward pass.</h2>
          </div>

          {forwardPassScenes.map((scene, index) => (
            <article
              key={scene.id}
              className={styles.sceneCopy}
              data-stage={scene.id}
              data-active={index === activeIndex}
              style={{ minHeight: `${scene.heightVh}svh` }}
            >
              <span className={styles.sceneIndex}>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <span className={styles.sceneLabel}>
                  <StageIcon stage={scene.id} />
                  {scene.navLabel}
                </span>
                <h3>{scene.headline}</h3>
                <p>{scene.body}</p>
                <dl>
                  <div>
                    <dt>{scene.metric.label}</dt>
                    <dd>{scene.metric.value}</dd>
                  </div>
                  <div>
                    <dt>Detail</dt>
                    <dd>{scene.metric.detail}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
