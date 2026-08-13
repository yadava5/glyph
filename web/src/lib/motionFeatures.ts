/*
 * Motion feature bundle, loaded lazily by the LazyMotion provider in App.
 *
 * The full `motion` component runtime was the single largest dependency in
 * the entry chunk. With `LazyMotion` + `m`, the entry ships only the tiny
 * render layer; this file — and the animation/layout runtime it pulls in —
 * arrives as its own chunk a beat later. `domMax` (not `domAnimation`)
 * because the command palette animates layout.
 *
 * Per the motion docs this MUST be a separate module: dynamic-importing
 * 'motion/react' directly would resolve to the same chunk the static
 * imports live in, and nothing would split.
 */
import { domMax } from 'motion/react';

export default domMax;
