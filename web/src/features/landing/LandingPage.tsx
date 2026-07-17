import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Command, Menu, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  benchMethodology,
  classifyThroughput,
  crossoverLosses,
  crossoverPragma,
  kernelBenchmarks,
  reproduceBenchmarkCommand,
  wasmKernelSource,
  wasmRuntimeFacts,
} from '../performance/benchmarkData';
import type { MnistDemoController } from '../mnist/useMnistDemoController';
import { NetworkDiagram } from './NetworkDiagram';
import { PixelSign } from './PixelSign';
import { Workbench } from './Workbench';
import styles from './LandingPage.module.css';

const REPO_URL = 'https://github.com/yadava5/fast-mnist-nn';

const CHAPTERS = [
  { id: 'performance', index: '1.0', label: 'kernels' },
  { id: 'forward-pass', index: '2.0', label: 'network' },
  { id: 'runtime', index: '3.0', label: 'runtime' },
  { id: 'evidence', index: '4.0', label: 'proof' },
] as const;

const NAV_LINKS = [
  { id: 'classifier', label: 'live bench' },
  ...CHAPTERS.map((c) => ({ id: c.id, label: c.label })),
] as const;

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

/** Scroll-spy over the chapter sections for the sticky rail + nav. */
function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.15, 0.4] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

/** Adds data-inview to chapter shells as they enter, for CSS reveals. */
function useRevealObserver() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
    if (nodes.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((n) => n.setAttribute('data-inview', 'true'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.setAttribute('data-inview', 'true');
            observer.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);
}

function Nav({ active }: { active: string | null }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (id: string) => {
    setMenuOpen(false);
    scrollToSection(id);
  };

  return (
    // Blur is inlined because the CSS pipeline's minifier has been
    // observed stripping the unprefixed backdrop-filter declaration,
    // shipping glass with no glass. Inline styles bypass it entirely.
    <header
      className={styles.nav}
      aria-label="Site"
      style={{ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
    >
      <a
        className={styles.brand}
        href="#hero"
        onClick={(e) => {
          e.preventDefault();
          setMenuOpen(false);
          window.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'auto'
              : 'smooth',
          });
        }}
      >
        fast<em>_</em>mnist
      </a>
      <nav className={styles.navLinks} aria-label="Sections">
        {NAV_LINKS.map((link) => (
          <button
            key={link.id}
            type="button"
            data-active={active === link.id}
            onClick={() => go(link.id)}
          >
            {link.label}
          </button>
        ))}
      </nav>
      <div className={styles.navActions}>
        <span className={styles.navHint} aria-hidden>
          <Command size={13} strokeWidth={2} />K
        </span>
        <a className={styles.navCta} href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub
          <ArrowUpRight size={15} strokeWidth={2} aria-hidden />
        </a>
        <button
          type="button"
          className={styles.menuButton}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
        </button>
      </div>
      {menuOpen && (
        <nav className={styles.mobileMenu} aria-label="Sections">
          {NAV_LINKS.map((link) => (
            <button key={link.id} type="button" onClick={() => go(link.id)}>
              {link.label}
            </button>
          ))}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
          </a>
        </nav>
      )}
    </header>
  );
}

function Hero() {
  const reduced = useReducedMotion();
  const subhead =
    'The classifier arrived as coursework — a from-scratch C++ MLP we did not write. Ours is everything beneath it: AVX-512, AVX2, and NEON kernels forged by hand, OpenMP thresholds tuned against measurement — never intuition — and a wasm simd128 port racing scalar, live, on the machine you are holding.';
  const words = subhead.split(' ');

  return (
    <section className={styles.hero} id="hero" aria-labelledby="hero-title">
      <motion.a
        className={styles.heroPill}
        href="#classifier"
        onClick={(e) => {
          e.preventDefault();
          scrollToSection('classifier');
        }}
        initial={reduced ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      >
        <i className={styles.heroPillDot} aria-hidden />
        <span className={styles.pillLong}>
          Hand-forged simd128 kernel — benchmarked live on your silicon
        </span>
        <span className={styles.pillShort}>Live SIMD benchmark below</span>
        <ArrowDown size={14} strokeWidth={2} aria-hidden />
      </motion.a>

      <motion.h1
        id="hero-title"
        className={styles.heroTitle}
        initial={reduced ? false : { opacity: 0, filter: 'blur(10px)', y: 14 }}
        animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
        transition={{ duration: 0.8, delay: 0.15, ease: [0.19, 1, 0.22, 1] }}
      >
        <span className={styles.heroTitleBright}>Handed a neural network.</span>
        <span className={styles.heroTitleMuted}>
          Handed back a <em>fast</em> one.
        </span>
      </motion.h1>

      <p className={styles.heroSubhead}>
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            className={styles.heroWord}
            style={reduced ? undefined : { animationDelay: `${700 + i * 24}ms` }}
            data-static={reduced || undefined}
          >
            {word}{' '}
          </span>
        ))}
      </p>

      <motion.div
        className={styles.heroCtas}
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.15, ease: [0.19, 1, 0.22, 1] }}
      >
        <button
          type="button"
          className={styles.ctaPrimary}
          onClick={() => scrollToSection('classifier')}
        >
          Fire the live bench
          <ArrowDown size={16} strokeWidth={2} aria-hidden />
        </button>
        <a
          className={styles.ctaGhost}
          href={`${REPO_URL}/blob/main/src/NeuralNet.cpp`}
          target="_blank"
          rel="noreferrer"
        >
          Read the kernels
          <ArrowUpRight size={16} strokeWidth={2} aria-hidden />
        </a>
      </motion.div>

      <motion.dl
        className={styles.heroMetrics}
        aria-label="Verified numbers from the committed benchmark run"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 1.5 }}
      >
        <div>
          <dt>kernel speedup</dt>
          <dd className="tabular">3.50× matmul 256 (M2)</dd>
        </div>
        <div>
          <dt>native classify</dt>
          <dd className="tabular">81,628 img/s (M2)</dd>
        </div>
        <div>
          <dt>isa ladder</dt>
          <dd className="tabular">AVX-512 · AVX2 · NEON · simd128</dd>
        </div>
        <div>
          <dt>test accuracy</dt>
          <dd className="tabular">97.01% / 10,000</dd>
        </div>
      </motion.dl>
    </section>
  );
}

interface ChapterShellProps {
  id: string;
  index: string;
  eyebrow: string;
  bright: string;
  muted: string;
  children: React.ReactNode;
}

function ChapterShell({ id, index, eyebrow, bright, muted, children }: ChapterShellProps) {
  return (
    <section id={id} className={styles.chapter} data-reveal aria-labelledby={`${id}-title`}>
      <span className={styles.chapterCount}>{index.split('.')[0].padStart(2, '0')} / 04</span>
      <h2 id={`${id}-title`} className={styles.chapterTitle}>
        <span>{bright}</span>
        <span>{muted}</span>
      </h2>
      <p className={styles.chapterEyebrow}>{eyebrow}</p>
      <div className={styles.chapterBody}>{children}</div>
    </section>
  );
}

function ChapterRail({ active }: { active: string | null }) {
  return (
    <aside className={styles.rail} aria-label="Chapters">
      {CHAPTERS.map((c) => (
        <button
          key={c.id}
          type="button"
          data-active={active === c.id}
          onClick={() => scrollToSection(c.id)}
        >
          <span className="tabular">{c.index}</span> {c.label}
        </button>
      ))}
      <i className={styles.railLine} aria-hidden />
    </aside>
  );
}

/** Proportional baseline-vs-optimized bars: the speedup, drawn to scale. */
function BenchBars({
  baselineMs,
  optimizedMs,
  baseline,
  optimized,
  baselineLabel,
  optimizedLabel,
}: {
  baselineMs: number;
  optimizedMs: number;
  baseline: string;
  optimized: string;
  baselineLabel: string;
  optimizedLabel: string;
}) {
  const optPct = Math.max(4, (optimizedMs / baselineMs) * 100);
  return (
    <div className={styles.benchBars}>
      <div className={styles.benchBarRow}>
        <span>{baselineLabel}</span>
        <div className={styles.benchTrack}>
          <i className={styles.benchFillBase} style={{ width: '100%' }} />
        </div>
        <b className="tabular">{baseline}</b>
      </div>
      <div className={styles.benchBarRow}>
        <span>{optimizedLabel}</span>
        <div className={styles.benchTrack}>
          <i className={styles.benchFillOpt} style={{ width: `${optPct}%` }} />
        </div>
        <b className="tabular">{optimized}</b>
      </div>
    </div>
  );
}

function KernelsChapter() {
  return (
    <ChapterShell
      id="performance"
      index="1.0"
      eyebrow="1.0 kernels — google benchmark, 3 release configs, committed run 20251226-154121"
      bright="Matrix math, forged in intrinsics."
      muted="Measured, including where it loses."
    >
      <div className={styles.benchGrid}>
        {kernelBenchmarks.map((k) => (
          <article key={k.id} className={styles.benchCard}>
            <header>
              <span>{k.operation}</span>
              <b className="tabular">{k.speedup}</b>
            </header>
            <BenchBars
              baselineMs={k.baselineMs}
              optimizedMs={k.optimizedMs}
              baseline={k.baseline}
              optimized={k.optimized}
              baselineLabel={k.baselineLabel}
              optimizedLabel={k.optimizedLabel}
            />
            {k.gflops && <span className={styles.benchGflops}>{k.gflops}</span>}
            <p>{k.note}</p>
          </article>
        ))}
      </div>
      <p className={styles.benchFootnote}>
        Hand-written SIMD is active in <b>all</b> configs above (NEON on the M2 that produced this
        run) — these bars measure threading and native codegen on top of it. The SIMD-vs-scalar
        comparison runs live in the workbench, on your machine.
      </p>

      <div className={styles.crossover}>
        <div>
          <h3>The crossover — where OpenMP loses on purpose</h3>
          <p>
            Below a per-op size threshold, thread startup costs more than the work. The committed
            run keeps the losses:{' '}
            {crossoverLosses.map((c, i) => (
              <span key={c.op}>
                <b className="tabular">{c.op}</b> goes {c.single} → {c.omp} ({c.factor})
                {i < crossoverLosses.length - 1 ? '; ' : '.'}
              </span>
            ))}{' '}
            The threshold is in the code, not on a slide:
          </p>
          <pre className={styles.codeline}>
            <code>{crossoverPragma}</code>
          </pre>
        </div>
      </div>

      <div className={styles.benchHonesty}>
        <p>
          <b>The honest row:</b> full classify throughput is{' '}
          <b className="tabular">{classifyThroughput.baseline}</b> single-threaded and{' '}
          <b className="tabular">{classifyThroughput.openmpNative}</b> with OpenMP.{' '}
          {classifyThroughput.conclusion} — threads pay off in kernels, not in a{' '}
          {classifyThroughput.benchParams} forward pass (bench topology{' '}
          <b className="tabular">{classifyThroughput.benchTopology}</b>).
        </p>
        <pre className={styles.codeline}>
          <code>{reproduceBenchmarkCommand}</code>
        </pre>
      </div>

      <div className={styles.kernelPeek}>
        <header>
          <h3>The kernel running in this page</h3>
          <span>wasm/f64x2 · dual accumulators · src/NeuralNet.cpp</span>
        </header>
        <pre className={styles.codeblock}>
          <code>{wasmKernelSource}</code>
        </pre>
        <ul className={styles.kernelNotes}>
          <li>
            Two independent accumulators keep the multiply-add dependency chain from serializing —
            the same shape as the AVX-512 kernel's dual <code>_mm512_fmadd_pd</code> streams.
          </li>
          <li>LLVM's autovectorizer declines this loop. Writing it by hand buys ~3.7×.</li>
          <li>AVX-512, AVX2, and NEON siblings live beside it, selected at compile time.</li>
        </ul>
      </div>

      <p className={styles.methodology}>{benchMethodology}</p>
    </ChapterShell>
  );
}

function NetworkChapter({ controller }: { controller: MnistDemoController }) {
  return (
    <ChapterShell
      id="forward-pass"
      index="2.0"
      eyebrow="2.0 network — the starter: course-provided, framework-free"
      bright="Three matrices, two sigmoids."
      muted="The part we did not write."
    >
      <div className={styles.netLayout}>
        <NetworkDiagram controller={controller} />
        <div className={styles.netFacts}>
          <p>
            The starter arrived from coursework as clean, framework-free C++: two fused
            matrix-vector passes, <code>sigmoid(W·x + b)</code> into 100 hidden units, then again
            into 10 class scores, trained by the course's from-scratch backprop. Every inference
            funnels through that one gemv — the exact surface the real work targets: the kernels it
            dispatches to.
          </p>
          <ul className={styles.factList}>
            <li>
              <b className="tabular">79,510</b> parameters
            </li>
            <li>
              <b className="tabular">318KB</b> float32 binary weights
            </li>
            <li>
              <b>sigmoid</b> activations, both layers
            </li>
            <li>
              <b>argmax</b> over L1-normalized outputs
            </li>
          </ul>
        </div>
      </div>
    </ChapterShell>
  );
}

function RuntimeChapter({ controller }: { controller: MnistDemoController }) {
  const tiers = [
    {
      id: 'wasm',
      name: 'browser wasm',
      body: 'The same core, compiled with Emscripten. Hand-written f64x2 simd128 kernel — the one being timed on this page right now.',
      state: controller.predictionSource === 'browser-wasm' ? 'active' : 'ready',
    },
    {
      id: 'server',
      name: 'native server',
      body: 'C++17 + cpp-httplib. AVX-512 / AVX2 / NEON selected at compile time, OpenMP above tuned thresholds.',
      state:
        controller.serverStatus === 'online'
          ? controller.predictionSource === 'server'
            ? 'active'
            : 'ready'
          : 'offline',
    },
    {
      id: 'js',
      name: 'js demo fallback',
      body: 'A labeled template matcher that keeps the page interactive if WASM is unavailable. Never used for accuracy or timing claims.',
      state: controller.predictionSource === 'browser-js-demo' ? 'active' : 'standby',
    },
  ] as const;

  return (
    <ChapterShell
      id="runtime"
      index="3.0"
      eyebrow="3.0 runtime — one core, three places to run"
      bright="Native first. Portable always."
      muted="The same C++, in your tab."
    >
      <div className={styles.tierGrid}>
        {tiers.map((t, i) => (
          <article key={t.id} className={styles.tierCard} data-state={t.state}>
            <span className="tabular">0{i + 1}</span>
            <h3>{t.name}</h3>
            <p>{t.body}</p>
            <b data-state={t.state}>{t.state}</b>
          </article>
        ))}
      </div>
      <dl className={styles.wasmFacts} aria-label="Measured WASM artifact facts">
        {wasmRuntimeFacts.map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd className="tabular">{f.value}</dd>
          </div>
        ))}
      </dl>
    </ChapterShell>
  );
}

function ProofChapter() {
  return (
    <ChapterShell
      id="evidence"
      index="4.0"
      eyebrow="4.0 proof — measured, not promised"
      bright="Every number on this page"
      muted="is reproducible from the repo."
    >
      <div className={styles.proofGrid}>
        <article>
          <h3>Reproduce the accuracy</h3>
          <pre className={styles.codeblock}>
            <code>{`cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j

# 41 tests, 469 assertions
./build/fast_mnist_tests

# 9701 / 10000 = 97.01%
./test_model model.weights data 10000`}</code>
          </pre>
        </article>
        <article>
          <h3>Reproduce this page's runtime</h3>
          <pre className={styles.codeblock}>
            <code>{`source "$EMSDK/emsdk_env.sh"

# stages web/public/wasm
./tools/build_wasm.sh

cd web
VITE_ENABLE_WASM=true npm run build`}</code>
          </pre>
        </article>
      </div>
      <div className={styles.proofLinks}>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Repository <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
        </a>
        <a href={`${REPO_URL}/releases`} target="_blank" rel="noreferrer">
          Releases <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
        </a>
        <a href={`${REPO_URL}/blob/main/BENCHMARKS.md`} target="_blank" rel="noreferrer">
          Benchmark methodology <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
        </a>
      </div>
    </ChapterShell>
  );
}

function Footer() {
  return (
    <footer className={styles.footer} data-reveal>
      <PixelSign word="FAST" />
      <div className={styles.footerMeta}>
        <span>
          Fast MNIST — a course-provided network, hand-optimized. Optimization by Ayush Yadav;
          contributor: Shree Chaturvedi.
        </span>
        <span className={styles.footerLegal}>
          MIT license · benchmarks from committed M2 run 20251226-154121
        </span>
      </div>
    </footer>
  );
}

export function LandingPage({ controller }: { controller: MnistDemoController }) {
  const active = useActiveSection(NAV_LINKS.map((l) => l.id));
  useRevealObserver();

  return (
    <main className={styles.page}>
      <Nav active={active} />
      <Hero />
      <Workbench controller={controller} />
      <div className={styles.chapters}>
        <ChapterRail active={active} />
        <div className={styles.chapterFlow}>
          <KernelsChapter />
          <NetworkChapter controller={controller} />
          <RuntimeChapter controller={controller} />
          <ProofChapter />
        </div>
      </div>
      <Footer />
    </main>
  );
}
