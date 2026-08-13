import { Fragment, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, BookOpen, Command, Menu, X } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import {
  benchMethodology,
  classifyThroughput,
  crossoverLosses,
  crossoverPragma,
  decemberRecord,
  headlineConvergence,
  isaLadder,
  kernelBenchmarks,
  kernelSource,
  referenceRecord,
  referenceRun,
  reproduceBenchmarkCommand,
  scalarIdle,
  signFlip,
  wasmRuntimeFacts,
} from '../performance/benchmarkData';
import { formatRunDate } from '../performance/benchDerive';
import type { MnistDemoController } from '../mnist/useMnistDemoController';
import { HiddenHeatmap } from '../../components/HiddenHeatmap';
import { SaliencyPanel } from '../../components/SaliencyPanel';
import { NetworkDiagram } from './NetworkDiagram';
import { Workbench } from './Workbench';
import { LaneField } from './LaneField';
import { FlowMark } from './FlowMark';
import { GlyphMark } from './GlyphMark';
import { InputRaster } from './InputRaster';
import {
  AccuracyWaffle,
  CrossoverChart,
  FailureMap,
  GflopsSlope,
  LaneScale,
  SimdCensusPanel,
  ThroughputGauge,
} from './PerfVizLazy';
import { MagneticButton, RollingNumber, Spotlight, Tilt } from './interactions';
import styles from './LandingPage.module.css';

const REPO_URL = 'https://github.com/yadava5/glyph';
const SYSTEM_CARD_URL = '/system-card';
const KERNEL_URL = `${REPO_URL}/blob/main/src/NeuralNet.cpp`;

/* The scroll: the live bench IS the fold, then four acts argue for it.
 * `··` marks the instrument — it is not a chapter, it is the exhibit. */
const ACTS = [
  { id: 'classifier', n: '··', label: 'live bench' },
  { id: 'problem', n: '01', label: 'problem' },
  { id: 'solution', n: '02', label: 'solution' },
  { id: 'build', n: '03', label: 'build' },
  { id: 'proof', n: '04', label: 'proof' },
] as const;

const NAV_LINKS = [
  { id: 'classifier', label: 'live bench' },
  { id: 'problem', label: 'problem' },
  { id: 'solution', label: 'solution' },
  { id: 'build', label: 'build' },
  { id: 'proof', label: 'proof' },
] as const;

/* Proof-internal index. `4.x` deliberately reads as a subordinate system to
 * the act numbers `01–04` — two levels, two shapes, no collision. */
const PROOF_SUBS = [
  { id: 'proof-artifact', n: '4.1', label: 'artifact' },
  { id: 'proof-live', n: '4.2', label: 'live' },
  { id: 'proof-run', n: '4.3', label: 'the run' },
  { id: 'proof-crossover', n: '4.4', label: 'crossover' },
  { id: 'proof-record', n: '4.5', label: 'record' },
  { id: 'proof-anatomy', n: '4.6', label: 'anatomy' },
  { id: 'proof-accuracy', n: '4.7', label: 'accuracy' },
  { id: 'proof-repro', n: '4.8', label: 'reproduce' },
] as const;

const PROOF_SUB_IDS = PROOF_SUBS.map((s) => s.id);

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

/** Scroll-spy over a list of section ids, for the rails + nav. */
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
      <GlyphMark
        onHome={(e) => {
          e.preventDefault();
          setMenuOpen(false);
          window.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'auto'
              : 'smooth',
          });
        }}
      />
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
        <a
          className={styles.navCard}
          href={SYSTEM_CARD_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <BookOpen size={14} strokeWidth={2} aria-hidden />
          System Card
        </a>
        <a className={styles.navCta} href={REPO_URL} target="_blank" rel="noopener noreferrer">
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
          <a href={SYSTEM_CARD_URL} target="_blank" rel="noopener noreferrer">
            Read the System Card <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
          </a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
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
 * Two constraints shape the markup: the spans stay `display:inline` — an
 * inline-block boundary terminates Chromium's find-in-page buffer, which
 * would make the headline un-searchable — and the inter-word spaces are
 * real text nodes BETWEEN the spans, so selection and clipboard read the
 * true sentence. The sweep therefore animates color only, never transform
 * (which a non-replaced inline box cannot carry anyway).
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

/** The headline card, looked up rather than re-typed. */
const matmul256 = kernelBenchmarks.find((k) => k.caseKey === 'benchDot/256')!;

/*
 * The fold: the thesis on the left, the thesis RUNNING on the right. The
 * workbench auto-fires its sample digit on first sight, so at 1024×700 a
 * visitor sees ink, a verdict, and a scalar-vs-simd measurement taken on
 * their own machine before they have scrolled a pixel.
 */
function Hero({ controller }: { controller: MnistDemoController }) {
  const reduced = useReducedMotion();
  const subhead =
    'The classifier came as coursework; the speed is ours — the hot loop hand-written in SIMD intrinsics four times, down to the simd128 kernel racing a lanes-off scalar build live in this page. Every number is measured, including where it loses.';
  const words = subhead.split(' ');

  return (
    <Spotlight
      as="section"
      className={styles.hero}
      id="hero"
      aria-labelledby="hero-title"
      glow="56 189 248"
    >
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <m.span
            className={styles.heroPill}
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
          >
            <i className={styles.heroPillDot} aria-hidden />
            live — a hand-written simd128 kernel, timed on your silicon
          </m.span>

          <m.h1
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
          </m.h1>

          <p className={styles.heroSubhead}>
            {words.map((word, i) => (
              <span
                key={`${word}-${i}`}
                className={styles.heroWord}
                // FM-4 · tight, capped cascade so the subhead settles to full text
                // in ~1.4s and never reads as truncated mid-reveal (was ~2.45s).
                style={reduced ? undefined : { animationDelay: `${450 + Math.min(i * 12, 480)}ms` }}
                data-static={reduced || undefined}
              >
                {word}{' '}
              </span>
            ))}
          </p>

          <m.div
            className={styles.heroCtas}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.15, ease: [0.19, 1, 0.22, 1] }}
          >
            <MagneticButton className={styles.ctaPrimary} onClick={() => scrollToSection('proof')}>
              Read the proof
              <ArrowDown size={16} strokeWidth={2} aria-hidden />
            </MagneticButton>
            <a
              className={styles.ctaGhost}
              href={SYSTEM_CARD_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpen size={16} strokeWidth={2} aria-hidden />
              Read the System Card
            </a>
          </m.div>
        </div>

        <m.div
          className={styles.heroBench}
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.19, 1, 0.22, 1] }}
        >
          <Workbench controller={controller} />
        </m.div>
      </div>

      <Tilt className={styles.heroMetricsTilt} max={4}>
        <m.dl
          className={styles.heroMetrics}
          aria-label="Verified numbers from the reference benchmark run"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.5 }}
        >
          {/* "matmul 256 · 3.57×" under a headline about a hand-written SIMD
              kernel reads as though SIMD bought the 3.57×. It did not: the SIMD
              kernels are compiled into BOTH configs, so this measures threading
              and native codegen on top of them. The label says so. */}
          <div>
            <dt>matmul 256 · threads + native</dt>
            <dd className="tabular">{matmul256.speedup} — SIMD in both sides</dd>
          </div>
          <div>
            <dt>classify, single thread</dt>
            <dd className="tabular">{classifyThroughput.baseline}</dd>
          </div>
          <div>
            <dt>isa ladder</dt>
            <dd className="tabular">AVX-512 · AVX2 · NEON · simd128</dd>
          </div>
          <div>
            <dt>test accuracy</dt>
            <dd className="tabular">97.01% / 10,000</dd>
          </div>
        </m.dl>
      </Tilt>
      <p className={styles.heroMetricsSource}>
        Measured on {referenceRun.machine}, {formatRunDate(referenceRun.dateISO)} —{' '}
        {referenceRun.reps} repetitions per case, medians. The records are in the repository as{' '}
        <a
          href={`${REPO_URL}/tree/main/docs/benchmarks/runs`}
          target="_blank"
          rel="noopener noreferrer"
        >
          bench-{referenceRun.stamp}-*.json
        </a>
        .
      </p>
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
          weights one <span className={styles.serifTurn}>double</span> at a time.
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
            <b className="tabular">{scalarIdle.headline}</b> — {scalarIdle.caption}.
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
            loop.
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
            <a
              className={styles.inlineLink}
              href={KERNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
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
      <LaneScale />

      <div className={styles.tierGrid}>
        {tiers.map((t) => (
          <article key={t.id} className={styles.tierCard} data-state={t.state}>
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

/**
 * Proportional baseline-vs-optimized bars, drawn to scale.
 *
 * The longer of the two bars is the full track and the other is scaled against
 * it, so a case where threading LOSES draws a longer optimized bar rather than
 * silently overflowing. The earlier version pinned baseline at 100% and sized
 * the optimized bar as a percentage of it — which for `axpy 1024` on the
 * reference run asks for 108% of the track, i.e. a loss that renders as a tie.
 */
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
  const longest = Math.max(baselineMs, optimizedMs);
  const pct = (v: number) => Math.max(4, (v / longest) * 100);
  const optimizedLost = optimizedMs > baselineMs;
  return (
    <div className={styles.benchBars} data-lost={optimizedLost || undefined}>
      <div className={styles.benchBarRow}>
        <span>{baselineLabel}</span>
        <div className={styles.benchTrack}>
          <i className={styles.benchFillBase} style={{ width: `${pct(baselineMs)}%` }} />
        </div>
        <b className="tabular">{baseline}</b>
      </div>
      <div className={styles.benchBarRow}>
        <span>{optimizedLabel}</span>
        <div className={styles.benchTrack}>
          <i className={styles.benchFillOpt} style={{ width: `${pct(optimizedMs)}%` }} />
        </div>
        <b className="tabular">{optimized}</b>
      </div>
    </div>
  );
}

/*
 * The headline number, measured on two machines at three repetition counts.
 * Agreement within 2% is the actual argument that it is a property of the
 * code rather than of one afternoon.
 */
function ConvergenceStrip() {
  return (
    <div className={styles.convergence}>
      <span className={styles.miniLabel}>matmul 256 — the same number, measured three times</span>
      <div className={styles.convergenceRow}>
        {headlineConvergence.map((c) => (
          <div key={c.id}>
            <span>{c.label}</span>
            <b className="tabular">{c.display}</b>
          </div>
        ))}
      </div>
      <p>
        Two machines, three repetition counts, a spread under 2%. The headline is a property of the
        code, not of one afternoon.
      </p>
    </div>
  );
}

/** The sticky proof index — the chapter carries its own instrument scale. */
function ProofRail({ active }: { active: string | null }) {
  const idx = PROOF_SUBS.findIndex((s) => s.id === active);
  return (
    <nav className={styles.proofRail} aria-label="Proof sections">
      <div className={styles.proofRailInner}>
        <span className={styles.proofRailTitle}>
          <b className="tabular">04</b> proof
        </span>
        <div className={styles.proofRailLinks}>
          {PROOF_SUBS.map((s) => (
            <button
              key={s.id}
              type="button"
              data-active={active === s.id}
              onClick={() => scrollToSection(s.id)}
            >
              <b className="tabular">{s.n}</b>
              <em>{s.label}</em>
            </button>
          ))}
        </div>
        <span className={styles.proofRailPos} aria-hidden>
          <b className="tabular">{idx >= 0 ? idx + 1 : '–'}</b> / {PROOF_SUBS.length}
        </span>
      </div>
    </nav>
  );
}

function ProofSub({
  id,
  n,
  title,
  lede,
  children,
}: {
  id: string;
  n: string;
  title: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className={styles.proofSub}>
      <header className={styles.proofSubHead}>
        <span className={styles.proofSubNum}>
          <b className="tabular">{n}</b>
        </span>
        <div>
          <h3>{title}</h3>
          {lede && <p>{lede}</p>}
        </div>
      </header>
      {children}
    </div>
  );
}

function ProofAct({ controller }: { controller: MnistDemoController }) {
  const activeSub = useActiveSection(PROOF_SUB_IDS);

  return (
    <section
      id="proof"
      className={styles.act}
      data-accent="green"
      data-reveal
      aria-labelledby="proof-title"
    >
      <ProofRail active={activeSub} />
      <div className={styles.actInner}>
        <header className={styles.actHead}>
          <span className={styles.actCount}>
            <b className="tabular">04</b> / 04 <em>proof</em>
          </span>
          <h2 id="proof-title" className={styles.actTitle}>
            <span>Measured, not promised.</span>
            <span>Including where it loses.</span>
          </h2>
          <p className={styles.actLede}>
            Every figure is scoped to exactly what it measures, and pulled from one committed Google
            Benchmark run. The honest rows — where threading{' '}
            <span className={styles.serifTurn}>costs</span> more than it buys — stay on the page.
          </p>
        </header>

        <div className={styles.actBody}>
          <ProofSub
            id="proof-artifact"
            n="4.1"
            title="The artifact, audited"
            lede="Before trusting a stopwatch, open the binary — a disassembly census of the exact glyph.wasm this page just ran."
          >
            <SimdCensusPanel />
          </ProofSub>

          <ProofSub
            id="proof-live"
            n="4.2"
            title="Your machine, on the record"
            lede="One number on this page is not committed: the one your machine is producing right now."
          >
            <div className={styles.liveInstrument}>
              <ThroughputGauge controller={controller} />
              <div className={styles.liveInstrumentNote}>
                <span className={styles.miniLabel}>the one live number</span>
                <p>
                  Everything else here is the <b>committed</b> {referenceRun.machine} run, which you
                  can re-run. This dial is the exception — it is <em>your</em> machine, timing the
                  wasm simd128 kernel against scalar as you draw in the bench at the top. The
                  committed bars below measure threading and native codegen; the dial measures SIMD
                  itself.
                </p>
              </div>
            </div>
          </ProofSub>

          <ProofSub
            id="proof-run"
            n="4.3"
            title="The committed run"
            lede="The two largest wins and the case that flipped — chosen to span the result, not to flatter it."
          >
            <div className={styles.benchGrid}>
              {kernelBenchmarks.map((k) => (
                <article key={k.id} className={styles.benchCard} data-lost={!k.wins || undefined}>
                  <header>
                    <span>{k.operation}</span>
                    <b className="tabular">
                      {k.speedup}
                      {k.speedupQualifier && (
                        <em className={styles.benchQualifier}>{k.speedupQualifier}</em>
                      )}
                    </b>
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
            <ConvergenceStrip />
          </ProofSub>

          <ProofSub
            id="proof-crossover"
            n="4.4"
            title="The crossover"
            lede="Below a per-op size threshold, thread startup costs more than the work. Eight of twelve cases lose — all twelve are plotted."
          >
            <div className={styles.chartsRow}>
              <CrossoverChart />
              <GflopsSlope />
            </div>
            <div className={styles.crossover}>
              <p>
                The committed run keeps the losses:{' '}
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
          </ProofSub>

          <ProofSub
            id="proof-record"
            n="4.5"
            title="The record, in full"
            lede="The whole tally, the kinder machine it replaced, and the row that embarrasses the headline."
          >
            <div className={styles.benchHonesty}>
              <p>
                <b>The tally:</b> across the twelve sized matrix cases in this run, threading wins{' '}
                <b className="tabular">{referenceRecord.wins}</b> and loses{' '}
                <b className="tabular">{referenceRecord.losses}</b>. The three cards above are the
                two largest wins and the one that flipped — they are not a selection. Every case is
                plotted in the crossover chart, losses included.
              </p>
              <p>
                <b>And this is the harsher machine.</b> The page used to draw a December MacBook Air
                run, where threading won <b className="tabular">{decemberRecord.wins}</b> of{' '}
                {decemberRecord.total} and <b className="tabular">{signFlip.op}</b> was a{' '}
                <b className="tabular">{signFlip.december}</b> win rather than the{' '}
                <b className="tabular">{signFlip.reference}</b> it is here. That run is still
                committed — it is history, not the reference, and{' '}
                <a
                  href={`${REPO_URL}/blob/main/docs/benchmarks/ENVIRONMENT.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ENVIRONMENT.md
                </a>{' '}
                says which is which and why. The README and the System Card quote this one, so now
                so does the page.
              </p>
              <p>
                <b>The honest row:</b> full classify throughput is{' '}
                <b className="tabular">{classifyThroughput.baseline}</b> single-threaded and{' '}
                <b className="tabular">{classifyThroughput.openmpNative}</b> with OpenMP —{' '}
                {classifyThroughput.delta}. {classifyThroughput.conclusion}: threads pay off in
                kernels, not in a {classifyThroughput.benchParams} forward pass (bench topology{' '}
                <b className="tabular">{classifyThroughput.benchTopology}</b>).
              </p>
            </div>
          </ProofSub>

          <ProofSub
            id="proof-anatomy"
            n="4.6"
            title="The pipeline, live"
            lede="Not an illustration — the real 28×28 raster, all 100 hidden activations, and the ten output confidences from your ink."
          >
            <div className={styles.liveAnatomy}>
              <NetworkDiagram controller={controller} />
              {/* The heatmap and saliency panels carry their own labels;
                  only the raster needs one supplied. */}
              <div className={styles.anatomySignals} id="results">
                <div className={styles.signalCell}>
                  <span className={styles.signalLabel}>what the network sees · 28×28</span>
                  <InputRaster pixels={controller.inputPixels} />
                </div>
                <div className={styles.signalCell}>
                  <HiddenHeatmap hiddenActivations={controller.hiddenActivations} />
                </div>
                <div className={styles.signalCell}>
                  <SaliencyPanel inputGrad={controller.inputGrad} />
                  <span className={styles.saliencyLegend} aria-hidden>
                    <i data-kind="for" /> supports the verdict · <i data-kind="against" /> opposes
                    it
                  </span>
                </div>
              </div>
            </div>
          </ProofSub>

          <ProofSub
            id="proof-accuracy"
            n="4.7"
            title="Accuracy, errors included"
            lede="9,701 of 10,000 — and every one of the 299 misses, mapped and inspectable."
          >
            <div className={styles.accuracyGrid}>
              <AccuracyWaffle />
              <FailureMap />
            </div>
          </ProofSub>

          <ProofSub
            id="proof-repro"
            n="4.8"
            title="Reproduce everything"
            lede="Every figure re-derivable from a clean checkout. These are the commands."
          >
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
                <h4>Reproduce the accuracy</h4>
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
                <h4>Reproduce this page&apos;s runtime</h4>
                <pre className={styles.codeblock}>
                  <code>{`source "$EMSDK/emsdk_env.sh"

# stages web/public/wasm
./tools/build_wasm.sh

cd web
VITE_ENABLE_WASM=true npm run build`}</code>
                </pre>
              </article>
            </div>
            <pre className={styles.codeline}>
              <code>{reproduceBenchmarkCommand}</code>
            </pre>
            <p className={styles.methodology}>{benchMethodology}</p>
          </ProofSub>
        </div>
      </div>
    </section>
  );
}

/** Closing band — the artifacts travel; the page is just their reading. */
function TryItBand() {
  return (
    <section className={styles.tryBand} id="try" data-reveal aria-labelledby="try-title">
      <div className={styles.actInner}>
        <span className={styles.tryEyebrow}>where to next</span>
        <h2 id="try-title" className={styles.tryTitle}>
          Every claim on this page is committed. <em>Take the artifacts, not our word.</em>
        </h2>
        <p className={styles.tryLede}>
          Run records, the wasm census, the failure pack with all 299 misses — in the repository,
          gated by CI. The System Card tells the same story in full: every kernel, every benchmark
          cell, the crossover math, the reconciled test counts.
        </p>
        <div className={styles.tryCtas}>
          <MagneticButton
            className={styles.ctaPrimary}
            onClick={() => scrollToSection('classifier')}
          >
            <ArrowUp size={16} strokeWidth={2} aria-hidden />
            Back to the bench
          </MagneticButton>
          <a
            className={styles.ctaSystemCard}
            href={SYSTEM_CARD_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <BookOpen size={16} strokeWidth={2} aria-hidden />
            Read the System Card
            <ArrowUpRight size={15} strokeWidth={2} aria-hidden />
          </a>
          <a className={styles.ctaGhost} href={REPO_URL} target="_blank" rel="noopener noreferrer">
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
      <div className={styles.footerMeta}>
        <span>
          Glyph — a course-provided network, hand-optimized. Optimization by Ayush Yadav;
          contributor: Shree Chaturvedi.
        </span>
        <span className={styles.footerLinks}>
          <a href={SYSTEM_CARD_URL} target="_blank" rel="noopener noreferrer">
            System Card
          </a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            Repository
          </a>
          <a href={`${REPO_URL}/blob/main/BENCHMARKS.md`} target="_blank" rel="noopener noreferrer">
            Benchmarks
          </a>
        </span>
        <span className={styles.footerLegal}>
          MIT license · benchmarks from committed run {referenceRun.stamp} ({referenceRun.machine})
        </span>
      </div>
      <FlowMark />
    </footer>
  );
}

export function LandingPage({ controller }: { controller: MnistDemoController }) {
  const active = useActiveSection(NAV_LINKS.map((l) => l.id));
  useRevealObserver();

  return (
    <main className={styles.page}>
      <LaneField pulse={controller.timing?.n ?? 0} />
      <div className={styles.pageContent}>
        <Nav active={active} />
        <ActRail active={active} />
        <Hero controller={controller} />
        <ProblemAct />
        <SolutionAct />
        <ImplementationAct controller={controller} />
        <ProofAct controller={controller} />
        <TryItBand />
        <Footer />
      </div>
    </main>
  );
}
