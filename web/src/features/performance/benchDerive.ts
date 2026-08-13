/*
 * Derivations over the committed benchmark records.
 *
 * `benchRuns.generated.ts` holds raw wall-clock medians read out of the JSON
 * in `docs/benchmarks/runs/`. This module turns those into the figures the
 * page shows — speedups, GFLOP/s, images per second, formatted durations.
 *
 * Everything here is a pure function of an artifact value. Nothing in this
 * file, and nothing downstream of it, may introduce a number that is not
 * computed from a run record. That is the whole point: a reader can open the
 * JSON, apply the formula named next to the figure, and land on the same
 * digits.
 */

import {
  decemberRun,
  dot20xRun,
  referenceRun,
  referenceRunId,
  shippedArtifacts,
  simdCensus,
  type BenchCase,
  type BenchRun,
  type ShippedArtifact,
  type SimdCensus,
} from './benchRuns.generated';

export type { BenchCase, BenchRun, ShippedArtifact, SimdCensus };
export { referenceRunId, shippedArtifacts, simdCensus };

/** The run every figure on the landing page comes from. */
export const reference: BenchRun = referenceRun;

/** The December MacBook Air run — history, kept for the two-machine comparison. */
export const december: BenchRun = decemberRun;

/** The 20-repetition dot-only run. Its `benchDot/256` is the headline figure. */
export const dot20x: BenchRun = dot20xRun;

/*
 * Case identity. Google Benchmark names the matmul kernel `benchDot` because
 * it benchmarks `Matrix::dot`; the page calls it matmul because that is the
 * operation. Both names travel together so a reader who opens the artifact
 * looking for "matmul" can still find the row.
 */
export interface CaseId {
  /** The key in the JSON, e.g. `benchDot/256`. */
  key: string;
  /** What the page calls it. */
  label: string;
  family: 'matmul' | 'transpose' | 'axpy';
  /** N for matmul/transpose (square), vector length for axpy. */
  size: number;
}

const FAMILY: Record<string, { family: CaseId['family']; label: string }> = {
  benchDot: { family: 'matmul', label: 'matmul' },
  benchTranspose: { family: 'transpose', label: 'transpose' },
  benchAxpy: { family: 'axpy', label: 'axpy' },
};

/** Parse `benchDot/256` into its display identity. Returns null for `benchClassify` etc. */
export function parseCase(key: string): CaseId | null {
  const [prefix, sizeText] = key.split('/');
  const meta = FAMILY[prefix];
  if (!meta || !sizeText) return null;
  const size = Number(sizeText);
  if (!Number.isFinite(size)) return null;
  return { key, label: `${meta.label} ${size}`, family: meta.family, size };
}

/** Every sized matrix case in a run, ordered by family then size. */
export function matrixCases(run: BenchRun): CaseId[] {
  const order: CaseId['family'][] = ['matmul', 'transpose', 'axpy'];
  return Object.keys(run.cases)
    .map(parseCase)
    .filter((c): c is CaseId => c !== null)
    .sort((a, b) => order.indexOf(a.family) - order.indexOf(b.family) || a.size - b.size);
}

/* ─────────────────────────── the formulas ─────────────────────────── */

/** speedup = baseline ÷ openmp+native. Below 1.0 means threading LOST. */
export function speedup(c: BenchCase): number {
  return c.baselineNs / c.ompNs;
}

/**
 * A square matmul of N×N is 2·N³ floating-point operations (one multiply and
 * one add per inner-loop step). FLOPs per nanosecond is numerically the same
 * as GFLOP/s, so the conversion is a plain division.
 */
export function gflops(n: number, ns: number): number {
  return (2 * n ** 3) / ns;
}

/**
 * Images per second for the whole-network cases. One benchmark iteration is
 * one image, so this is 1e9 ÷ ns/op — the same derivation BENCHMARKS.md's
 * throughput table uses.
 */
export function imagesPerSecond(ns: number): number {
  return 1e9 / ns;
}

/* ───────────────────────────── formatting ───────────────────────────── */

/** ns → the smallest legible unit, matching the committed BENCHMARKS.md style. */
export function formatNs(ns: number): string {
  if (ns < 1000) return `${Math.round(ns)}ns`;
  if (ns < 1e6) return `${(ns / 1000).toFixed(ns < 10000 ? 1 : 0)}µs`;
  return `${(ns / 1e6).toFixed(2)}ms`;
}

/** 3.5704… → "3.57×". Two decimals below 10×, matching BENCHMARKS.md. */
export function formatSpeedup(x: number): string {
  return `${x.toFixed(2)}×`;
}

/** A ratio a reader can act on: 0.922× is easier to read as "1.08× slower". */
export function formatSlowdown(x: number): string {
  return `${(1 / x).toFixed(2)}× slower`;
}

export function formatImagesPerSecond(ns: number): string {
  return `${Math.round(imagesPerSecond(ns)).toLocaleString('en-US')} img/s`;
}

export function formatGflops(n: number, ns: number): string {
  return `${gflops(n, ns).toFixed(1)} GFLOP/s`;
}

/**
 * Bytes → kB, decimal, matching docs/WASM.md's stated convention (bytes ÷ 1000,
 * not ÷ 1024). Stating which one is meant is the difference between a figure a
 * reader can check and a figure that is 2.4% off for reasons nobody can see.
 */
export function formatKb(bytes: number): string {
  return `${(bytes / 1000).toFixed(1)} kB`;
}

/** 2026-08-02T21:01:44-04:00 → "2 August 2026". */
export function formatRunDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ────────────────────────── aggregate reads ────────────────────────── */

export interface CaseRow extends CaseId {
  baselineNs: number;
  ompNs: number;
  speedup: number;
  /** Coefficient of variation, %, or null on a single-repetition record. */
  cvBaseline: number | null;
  cvOmp: number | null;
  wins: boolean;
}

export function caseRow(run: BenchRun, id: CaseId): CaseRow {
  const c = run.cases[id.key];
  const s = speedup(c);
  return {
    ...id,
    baselineNs: c.baselineNs,
    ompNs: c.ompNs,
    speedup: s,
    cvBaseline: c.cvBaseline ?? null,
    cvOmp: c.cvOmp ?? null,
    wins: s > 1,
  };
}

export function caseRows(run: BenchRun): CaseRow[] {
  return matrixCases(run).map((id) => caseRow(run, id));
}

/** How many sized matrix cases threading wins, and out of how many. */
export function winRecord(run: BenchRun): { wins: number; losses: number; total: number } {
  const rows = caseRows(run);
  const wins = rows.filter((r) => r.wins).length;
  return { wins, losses: rows.length - wins, total: rows.length };
}
