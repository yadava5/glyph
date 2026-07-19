import { Fragment, useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, BookOpen, Command, Menu, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  benchMethodology,
  classifyThroughput,
  crossoverLosses,
  crossoverPragma,
  isaLadder,
  kernelBenchmarks,
  kernelSource,
  reproduceBenchmarkCommand,
  scalarIdle,
  wasmRuntimeFacts,
} from '../performance/benchmarkData';
import type { MnistDemoController } from '../mnist/useMnistDemoController';
import { NetworkDiagram } from './NetworkDiagram';
import { Workbench } from './Workbench';
import { LaneField } from './LaneField';
import { FlowMark } from './FlowMark';
import {
  AccuracyWaffle,
  CrossoverChart,
  GflopsSlope,
  LaneScale,
  ThroughputGauge,
} from './PerfVizLazy';
import { Decode, MagneticButton, RollingNumber, Spotlight, Tilt } from './interactions';
import styles from './LandingPage.module.css';

const REPO_URL = 'https://github.com/yadava5/fast-mnist-nn';
const SYSTEM_CARD_URL = '/system-card';
const KERNEL_URL = `${REPO_URL}/blob/main/src/NeuralNet.cpp`;

/* The five acts of the scroll. The live bench sits at the hinge between
 * implementation and proof — it is the implementation, running. */
const ACTS = [
  { id: 'problem', n: '01', label: 'problem' },
  { id: 'solution', n: '02', label: 'solution' },
  { id: 'build', n: '03', label: 'build' },
  { id: 'classifier', n: '··', label: 'live bench' },
  { id: 'proof', n: '04', label: 'proof' },
] as const;

const NAV_LINKS = [
  { id: 'problem', label: 'problem' },
  { id: 'solution', label: 'solution' },
  { id: 'build', label: 'build' },
  { id: 'classifier', label: 'live bench' },
  { id: 'proof', label: 'proof' },
] as const;

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

/** Scroll-spy over the act sections for the rails + nav. */
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

/** Adds data-inview to act shells as they enter, for CSS reveals. */
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
        <a className={styles.navCard} href={SYSTEM_CARD_URL}>
          <BookOpen size={14} strokeWidth={2} aria-hidden />
          System Card
        </a>
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
          <a href={SYSTEM_CARD_URL}>
            Read the System Card <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
          </a>
        </nav>
      )}
    </header>
  );
}

/** Fixed vertical act index — a systems-doc TOC. Wide screens only. */
function ActRail({ active }: { active: string | null }) {
  return (
    <aside className={styles.actRail} aria-label="Chapters">
      {ACTS.map((a) => (
        <button
          key={a.id}
          type="button"
          data-active={active === a.id}
          onClick={() => scrollToSection(a.id)}
        >
          <span className="tabular">{a.n}</span>
          <em>{a.label}</em>
          <i aria-hidden />
        </button>
      ))}
    </aside>
  );
}

/**
 * Word spans for the hero title, so a sky "read-head" can sweep on hover.
 * The inter-word spaces are rendered as text nodes BETWEEN the inline-block
 * spans (an inline-block trims its own trailing whitespace), which keeps both
 * the visible spacing and the accessible heading text intact.
 */
function TitleWords({ text, offset = 0 }: { text: string; offset?: number }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className={styles.titleWord} style={{ '--i': i + offset } as React.CSSProperties}>
            {word}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </>
  );
}

function Hero() {
  const reduced = useReducedMotion();
  const subhead =
    'The classifier came as coursework — a from-scratch C++ MLP we did not write. The speed is ours: the hot dot-product hand-written in SIMD across four instruction sets — AVX-512, AVX2, NEON, and a wasm-simd128 port that races scalar, live, on the machine you are holding. Every number here is measured — including the case where it loses.';
  const words = subhead.split(' ');

  return (
    <Spotlight
      as="section"
      className={styles.hero}
      id="hero"
      aria-labelledby="hero-title"
      glow="56 189 248"
    >
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
        <span className={styles.heroTitleBright}>
          <TitleWords text="Handed a neural network." />
        </span>
        <span className={styles.heroTitleMuted}>
          <TitleWords text="Handed back a" /> <em className={styles.shimmerWord}>fast</em>{' '}
          <TitleWords text="one." offset={4} />
        </span>
      </motion.h1>

      <p className={styles.heroSubhead}>
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            className={styles.heroWord}
            style={reduced ? undefined : { animationDelay: `${700 + i * 22}ms` }}
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
        <MagneticButton className={styles.ctaPrimary} onClick={() => scrollToSection('classifier')}>
          Fire the live bench
          <ArrowDown size={16} strokeWidth={2} aria-hidden />
        </MagneticButton>
        <a className={styles.ctaGhost} href={SYSTEM_CARD_URL}>
          <BookOpen size={16} strokeWidth={2} aria-hidden />
          Read the System Card
        </a>
      </motion.div>

      <Tilt className={styles.heroMetricsTilt} max={4}>
        <motion.dl
          className={styles.heroMetrics}
          aria-label="Verified numbers from the committed benchmark run"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.5 }}
        >
          <div>
            <dt>matmul 256 · M2</dt>
            <dd className="tabular">3.50× omp+native vs 1-thread</dd>
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
      </Tilt>
    </Spotlight>
  );
}

interface ActShellProps {
  id: string;
  n: string;
  eyebrow: string;
  bright: string;
  muted: string;
  lede: React.ReactNode;
  accent?: 'steel' | 'amber' | 'sky' | 'green';
  children: React.ReactNode;
}

function ActShell({ id, n, eyebrow, bright, muted, lede, accent, children }: ActShellProps) {
  return (
    <section
      id={id}
      className={styles.act}
      data-accent={accent}
      data-reveal
      aria-labelledby={`${id}-title`}
    >
      <div className={styles.actInner}>
        <header className={styles.actHead}>
          <span className={styles.actCount}>
            <b className="tabular">{n}</b> / 04 <em>{eyebrow}</em>
          </span>
          <h2 id={`${id}-title`} className={styles.actTitle}>
            <span>{bright}</span>
            <span>{muted}</span>
          </h2>
          <p className={styles.actLede}>{lede}</p>
        </header>
        <div className={styles.actBody}>{children}</div>
      </div>
    </section>
  );
}

/** A 64-bit-per-cell vector register: `lit` of `lanes` lanes carrying work. */
function LaneRegister({ lanes, lit, tone }: { lanes: number; lit: number; tone: 'idle' | 'full' }) {
  const cells = Array.from({ length: lanes }, (_, i) => i < lit);
  return (
    <div className={styles.laneReg} data-tone={tone} role="img" aria-hidden>
      {cells.map((on, i) => (
        <i key={i} data-on={on || undefined} style={{ '--i': i } as React.CSSProperties} />
      ))}
    </div>
  );
}

function ProblemAct() {
  return (
    <ActShell
      id="problem"
      n="01"
      eyebrow="problem"
      accent="amber"
      bright="Seven eighths of the"
      muted="silicon, asleep."
      lede={
        <>
          The starter classifier was correct and completely scalar. Every dot product walks the
          weights one <span className={styles.serifTurn}>double</span> at a time — and the widest
          math unit on the machine watches almost all of it happen in the dark.
        </>
      }
    >
      <div className={styles.problemGrid}>
        <div className={styles.laneCard}>
          <span className={styles.miniLabel}>a 512-bit register · eight f64 lanes</span>
          <div className={styles.laneRows}>
            <div className={styles.laneRow}>
              <span>scalar loop</span>
              <LaneRegister lanes={8} lit={1} tone="idle" />
              <b className="tabular">1 / 8</b>
            </div>
            <div className={styles.laneRow}>
              <span>simd kernel</span>
              <LaneRegister lanes={8} lit={8} tone="full" />
              <b className="tabular">8 / 8</b>
            </div>
          </div>
          <p className={styles.laneCaption}>
            <b className="tabular">{scalarIdle.headline}</b> — {scalarIdle.caption}. The lanes exist
            in the hardware; the scalar loop simply never fills them.
          </p>
        </div>

        <div className={styles.problemProse}>
          <p>
            A <code>double</code> is 64 bits. An AVX-512 vector register is 512 — room for eight of
            them, side by side, multiplied and added in a single instruction. A scalar loop issues
            that instruction eight times instead, one lane lit, seven idle.
          </p>
          <p>
            And the compiler will not rescue it: LLVM&apos;s autovectorizer declines this reduction
            loop, so{' '}
            <span className={styles.serifTurn}>the width is right there, and nothing uses it.</span>{' '}
            The speed was never missing. It was left on the floor.
          </p>
          <ul className={styles.starterFacts} aria-label="The starter network">
            <li>
              <span>the starter</span>
              <b className="tabular">784 → 100 → 10</b>
            </li>
            <li>
              <span>parameters</span>
              <b className="tabular">79,510</b>
            </li>
            <li>
              <span>weights (float32)</span>
              <b className="tabular">318 KB</b>
            </li>
            <li>
              <span>who wrote it</span>
              <b>coursework, not us</b>
            </li>
          </ul>
        </div>
      </div>
    </ActShell>
  );
}

function SolutionAct() {
  return (
    <ActShell
      id="solution"
      n="02"
      eyebrow="solution"
      accent="steel"
      bright="Write the lanes"
      muted="by hand."
      lede={
        <>
          Not a bigger compiler flag — the kernel itself. Hand-write the hot dot-product in SIMD
          intrinsics so every lane carries weight, and run{' '}
          <span className={styles.serifTurn}>two accumulators</span> so the multiply-add chain never
          waits on itself.
        </>
      }
    >
      <div className={styles.solutionGrid}>
        <div className={styles.kernelPeek}>
          <header>
            <h3>The AVX-512 kernel</h3>
            <span>dual accumulators · src/NeuralNet.cpp</span>
          </header>
          <pre className={styles.codeblock}>
            <code>{kernelSource}</code>
          </pre>
        </div>
        <div className={styles.solutionNotes}>
          <ul className={styles.kernelNotes}>
            <li>
              Two independent streams — <code>acc0</code>, <code>acc1</code> — so the fused
              multiply-add on one does not stall waiting for the other to retire. The dependency
              chain is split, not shortened.
            </li>
            <li>
              <code>_mm512_fmadd_pd</code> is one instruction doing eight multiplies and eight adds.
              The tail loop mops up the last <code>n &amp; 15</code> elements scalar.
            </li>
          </ul>
          <div className={styles.decisionCard}>
            <span className={styles.miniLabel}>the decision · ADR-0001</span>
            <p>
              Hand-roll the kernels instead of linking OpenBLAS or Eigen. OpenBLAS would likely win
              large <code>matmul</code> by another <b className="tabular">2–3×</b> — we trade that
              for reproducibility, a tiny binary, and the ability to read every optimization in{' '}
              <code>src/</code>.
            </p>
            <a className={styles.inlineLink} href={KERNEL_URL} target="_blank" rel="noreferrer">
              Read the kernels <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </ActShell>
  );
}

function ImplementationAct({ controller }: { controller: MnistDemoController }) {
  const tiers = [
    {
      id: 'wasm',
      name: 'browser wasm',
      body: 'The same core, compiled with Emscripten. The hand-written f64x2 simd128 kernel — the one being timed on this page right now.',
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
    <ActShell
      id="build"
      n="03"
      eyebrow="implementation"
      accent="sky"
      bright="One kernel,"
      muted="four instruction sets."
      lede={
        <>
          The same dual-accumulator shape, ported four ways; a compile-time target picks the widest
          rung the machine supports. The fourth ISA is the trick —{' '}
          <span className={styles.serifTurn}>it runs in your browser.</span>
        </>
      }
    >
      <ol className={styles.isaLadder} aria-label="Instruction-set ladder">
        {isaLadder.map((rung) => (
          <li key={rung.id} className={styles.isaRung} data-hot={rung.id === 'wasm' || undefined}>
            <div className={styles.isaHead}>
              <b>{rung.isa}</b>
              <span className={styles.isaWidth}>{rung.width}</span>
            </div>
            <div className={styles.isaLanes} role="img" aria-label={`${rung.lanes} f64 lanes`}>
              {Array.from({ length: rung.lanes }, (_, i) => (
                <i key={i} style={{ '--i': i } as React.CSSProperties} />
              ))}
            </div>
            <code className={styles.isaIntrinsic}>{rung.intrinsic}</code>
            <span className={styles.isaWhere}>{rung.where}</span>
            <p>{rung.note}</p>
          </li>
        ))}
      </ol>
      <p className={styles.actNote}>
        The wasm-simd128 rung compiles the exact same kernel with Emscripten — which is what lets
        the instrument below time it against scalar, on your own machine.
      </p>

      <LaneScale />

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
    </ActShell>
  );
}

/** The bench hinge — one line of framing above the live instrument. */
function BenchIntro() {
  return (
    <div className={styles.benchIntro} data-reveal>
      <div className={styles.actInner}>
        <span className={styles.benchIntroEyebrow}>·· the fourth ISA, running</span>
        <h2 className={styles.benchIntroTitle}>
          <Decode text="Proof you can run." /> <em>Scalar versus simd128, on your machine.</em>
        </h2>
        <p>
          The workbench below is the real classifier compiled to wasm. Each stroke times the
          hand-written simd128 kernel against the same math with vector lanes switched off —
          measured in C++, in your tab. The median is in the titlebar.
        </p>
      </div>
    </div>
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

function ProofAct({ controller }: { controller: MnistDemoController }) {
  return (
    <ActShell
      id="proof"
      n="04"
      eyebrow="proof"
      accent="green"
      bright="Measured, not promised."
      muted="Including where it loses."
      lede={
        <>
          Every figure is scoped to exactly what it measures, and pulled from one committed Google
          Benchmark run. The honest rows — where threading{' '}
          <span className={styles.serifTurn}>costs</span> more than it buys — stay on the page.
        </>
      }
    >
      <div className={styles.liveInstrument}>
        <ThroughputGauge controller={controller} />
        <div className={styles.liveInstrumentNote}>
          <span className={styles.miniLabel}>the one live number</span>
          <p>
            Everything else on this page is a <b>committed</b> M2 run you can reproduce. This dial
            is the exception — it is <em>your</em> machine, timing the wasm simd128 kernel against
            scalar as you draw in the bench above. The committed bars below measure threading and
            native codegen; the dial measures SIMD itself.
          </p>
        </div>
      </div>

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
        comparison is the live one in the workbench, on your machine.
      </p>

      <div className={styles.chartsRow}>
        <CrossoverChart />
        <GflopsSlope />
      </div>

      <div className={styles.crossover}>
        <h3>The crossover — where OpenMP loses on purpose</h3>
        <p>
          Below a per-op size threshold, thread startup costs more than the work. The committed run
          keeps the losses:{' '}
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

      <div className={styles.liveAnatomy}>
        <div className={styles.liveAnatomyHead}>
          <h3>The whole pipeline, live</h3>
          <p>
            Not an illustration — the real 28×28 raster, all 100 hidden activations, and the ten
            output confidences from the ink you gave the bench above.
          </p>
        </div>
        <NetworkDiagram controller={controller} />
      </div>

      <AccuracyWaffle />

      <dl className={styles.proofStats} data-cols="2" aria-label="Testing evidence">
        <div>
          <dt>C++ tests</dt>
          <dd className="tabular">
            <RollingNumber value={41} rerollOnHover />
          </dd>
          <span>Catch2 · 469 assertions · RapidCheck properties</span>
        </div>
        <div>
          <dt>end-to-end</dt>
          <dd className="tabular">
            <RollingNumber value={29} rerollOnHover />
          </dd>
          <span>8 Playwright specs × 4 projects − 3 skips</span>
        </div>
      </dl>

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
          <h3>Reproduce this page&apos;s runtime</h3>
          <pre className={styles.codeblock}>
            <code>{`source "$EMSDK/emsdk_env.sh"

# stages web/public/wasm
./tools/build_wasm.sh

cd web
VITE_ENABLE_WASM=true npm run build`}</code>
          </pre>
        </article>
      </div>
      <p className={styles.methodology}>{benchMethodology}</p>
    </ActShell>
  );
}

/** Closing CTA band — try it, then read the whole story. */
function TryItBand() {
  return (
    <section className={styles.tryBand} id="try" data-reveal aria-labelledby="try-title">
      <div className={styles.actInner}>
        <span className={styles.tryEyebrow}>try it</span>
        <h2 id="try-title" className={styles.tryTitle}>
          Draw a digit. Watch a hand-written kernel <em>beat scalar on your own silicon.</em>
        </h2>
        <p className={styles.tryLede}>
          Then read the System Card — the same story in full: every kernel, every benchmark cell,
          the crossover math, and the reconciled test counts.
        </p>
        <div className={styles.tryCtas}>
          <MagneticButton
            className={styles.ctaPrimary}
            onClick={() => scrollToSection('classifier')}
          >
            <ArrowUpRight size={16} strokeWidth={2} aria-hidden />
            Fire the live bench
          </MagneticButton>
          <a className={styles.ctaSystemCard} href={SYSTEM_CARD_URL}>
            <BookOpen size={16} strokeWidth={2} aria-hidden />
            Read the System Card
            <ArrowUpRight size={15} strokeWidth={2} aria-hidden />
          </a>
          <a className={styles.ctaGhost} href={REPO_URL} target="_blank" rel="noreferrer">
            Source on GitHub
            <ArrowUpRight size={16} strokeWidth={2} aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className={styles.footer} data-reveal>
      <FlowMark />
      <div className={styles.footerMeta}>
        <span>
          Fast MNIST — a course-provided network, hand-optimized. Optimization by Ayush Yadav;
          contributor: Shree Chaturvedi.
        </span>
        <span className={styles.footerLinks}>
          <a href={SYSTEM_CARD_URL}>System Card</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Repository
          </a>
          <a href={`${REPO_URL}/blob/main/BENCHMARKS.md`} target="_blank" rel="noreferrer">
            Benchmarks
          </a>
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
      <LaneField />
      <div className={styles.pageContent}>
        <Nav active={active} />
        <ActRail active={active} />
        <Hero />
        <ProblemAct />
        <SolutionAct />
        <ImplementationAct controller={controller} />
        <BenchIntro />
        <Workbench controller={controller} />
        <ProofAct controller={controller} />
        <TryItBand />
        <Footer />
      </div>
    </main>
  );
}
