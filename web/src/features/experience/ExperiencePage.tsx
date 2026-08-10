import { useRef } from 'react';
import {
  ExternalLink,
  GitPullRequest,
  Keyboard,
  MonitorCog,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import { NeuralNetHero } from '../../components/NeuralNetHero';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { ClassifierWorkbench } from '../mnist/ClassifierWorkbench';
import { getRuntimeLabel, type MnistDemoController } from '../mnist/useMnistDemoController';
import {
  benchmarkMethodology,
  reproduceBenchmarkCommand,
  wasmRuntimeFacts,
} from '../performance/benchmarkData';
import { ForwardPassStory } from './ForwardPassStory';
import { motionTokens } from './motionTokens';
import { PerformanceSection } from './PerformanceSection';
import styles from './ExperiencePage.module.css';

interface ExperiencePageProps {
  controller: MnistDemoController;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

function HeroSection({ controller }: ExperiencePageProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: reduced ? 1000 : 90,
    damping: reduced ? 100 : 26,
    mass: 0.8,
  });
  const visualY = useTransform(progress, [0, 1], [0, -70]);
  const visualScale = useTransform(progress, [0, 1], [1, 0.9]);
  const copyOpacity = useTransform(progress, [0, 0.68], [1, 0.24]);
  const runtimeLabel = getRuntimeLabel(controller.predictionSource);

  return (
    <section id="hero" ref={sectionRef} className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.topbar}>
        <a className={styles.brand} href="#hero" aria-label="Glyph home">
          <span>Glyph</span>
          <small>C++ inference cockpit</small>
        </a>
        <div className={styles.topActions}>
          <span className={styles.commandHint} aria-hidden>
            <Keyboard size={15} strokeWidth={1.8} />
            Cmd K
          </span>
        </div>
      </div>

      <motion.div
        className={styles.heroNetwork}
        style={reduced ? undefined : { y: visualY, scale: visualScale }}
        transition={motionTokens.pageSpring}
      >
        <NeuralNetHero className={styles.networkCanvas} visualState="hero" />
      </motion.div>

      <motion.div
        className={styles.heroCopy}
        style={reduced ? undefined : { opacity: copyOpacity }}
      >
        <span className={styles.heroKicker}>
          <MonitorCog size={15} strokeWidth={1.8} aria-hidden />
          Technical inference cockpit
        </span>
        <h1 id="hero-title">784 pixels. 100 hidden units. 10 outputs. Faster in C++.</h1>
        <p>
          Draw a digit, inspect the tensor path, and scroll through the benchmark evidence behind
          the SIMD and OpenMP claims.
        </p>
        <div className={styles.heroActions}>
          <button type="button" onClick={() => scrollToSection('classifier')}>
            Open classifier
          </button>
          <button type="button" onClick={() => scrollToSection('performance')}>
            View benchmarks
          </button>
        </div>
      </motion.div>

      <aside className={styles.heroDiagnostics} aria-label="Runtime state">
        <span data-state={controller.serverStatus}>
          <i aria-hidden />
          {controller.serverStatus === 'checking' && 'Server check'}
          {controller.serverStatus === 'online' && 'Native online'}
          {controller.serverStatus === 'offline' && 'Fallback ready'}
        </span>
        <span>{runtimeLabel ?? 'awaiting prediction'}</span>
      </aside>

      <div className={styles.heroMetrics} aria-label="Model metrics">
        <span>
          <b>784</b>
          pixels
        </span>
        <span>
          <b>100</b>
          hidden
        </span>
        <span>
          <b>10</b>
          outputs
        </span>
        <span>
          <b>~97%</b>
          accuracy
        </span>
      </div>
    </section>
  );
}

function RuntimeSection({ controller }: ExperiencePageProps) {
  const runtimeLabel = getRuntimeLabel(controller.predictionSource);

  return (
    <section id="runtime" className={styles.runtimeSection} aria-labelledby="runtime-title">
      <div className={styles.runtimeShell}>
        <div className={styles.sectionCopy}>
          <span className={styles.sectionKicker}>
            <Server size={15} strokeWidth={1.8} aria-hidden />
            Runtime paths
          </span>
          <h2 id="runtime-title">Native first. WASM portable. JS as demo fallback.</h2>
          <p>
            The UI keeps the runtime label visible without letting server status dominate the
            experience. The native backend remains the benchmark path; browser modes keep the demo
            available when the server is unavailable.
          </p>
        </div>

        <div className={styles.runtimeGrid}>
          <article data-state={controller.serverStatus === 'online' ? 'active' : 'idle'}>
            <span>01</span>
            <h3>Native server</h3>
            <p>C++ classifier endpoint, SIMD kernels, Release build timing.</p>
            <strong>{controller.serverStatus === 'online' ? 'online' : 'not connected'}</strong>
          </article>
          <article data-state={controller.predictionSource === 'browser-wasm' ? 'active' : 'idle'}>
            <span>02</span>
            <h3>WASM</h3>
            <p>Offline path with compact glue, browser SIMD, and bundled weights.</p>
            <strong>{runtimeLabel === 'browser-wasm' ? 'active' : 'portable'}</strong>
          </article>
          <article
            data-state={controller.predictionSource === 'browser-js-demo' ? 'active' : 'idle'}
          >
            <span>03</span>
            <h3>JS fallback</h3>
            <p>Template classifier for demo continuity, not used for benchmark claims.</p>
            <strong>{runtimeLabel === 'browser-js-demo' ? 'active' : 'fallback'}</strong>
          </article>
        </div>

        <div className={styles.wasmFacts}>
          {wasmRuntimeFacts.map((fact) => (
            <div key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EvidenceSection() {
  return (
    <section id="evidence" className={styles.evidenceSection} aria-labelledby="evidence-title">
      <div className={styles.evidenceShell}>
        <div className={styles.sectionCopy}>
          <span className={styles.sectionKicker}>
            <ShieldCheck size={15} strokeWidth={1.8} aria-hidden />
            Reproducibility
          </span>
          <h2 id="evidence-title">Benchmarks are committed, reproducible, and labeled.</h2>
          <p>
            This redesign displays existing benchmark numbers. It does not refresh performance data
            or widen the claim beyond the documented local M2 run.
          </p>
        </div>

        <div className={styles.evidenceGrid}>
          <article>
            <h3>Methodology</h3>
            <ul>
              {benchmarkMethodology.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article>
            <h3>Reproduce</h3>
            <pre>
              <code>{reproduceBenchmarkCommand}</code>
            </pre>
          </article>

          <article>
            <h3>Sources</h3>
            <div className={styles.linkStack}>
              <a href="https://github.com/yadava5/glyph" target="_blank" rel="noreferrer">
                <GitPullRequest size={16} strokeWidth={1.8} aria-hidden />
                Source repository
                <ExternalLink size={13} strokeWidth={1.8} aria-hidden />
              </a>
              <a href="https://github.com/yadava5/glyph/releases" target="_blank" rel="noreferrer">
                <Terminal size={16} strokeWidth={1.8} aria-hidden />
                Release artifacts
                <ExternalLink size={13} strokeWidth={1.8} aria-hidden />
              </a>
            </div>
          </article>
        </div>

        <footer className={styles.footer}>
          <span>Built with C++ SIMD kernels, OpenMP, Motion, React Three Fiber, and Vite.</span>
          <span>By Ayush Yadav. Contributor: Shree Chaturvedi.</span>
        </footer>
      </div>
    </section>
  );
}

export function ExperiencePage({ controller }: ExperiencePageProps) {
  return (
    <main className={styles.page}>
      <HeroSection controller={controller} />
      <ClassifierWorkbench controller={controller} />
      <ForwardPassStory />
      <PerformanceSection />
      <RuntimeSection controller={controller} />
      <EvidenceSection />
    </main>
  );
}
