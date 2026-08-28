/**
 * RunState.ts
 *
 * Where a matching run is in its lifecycle.
 *
 *   READY ──start──▶ COUNTDOWN ──▶ RECORDING ──▶ SCORED
 *     ▲                  │              │            │
 *     └───── reset ──────┴──── stop ────┴─ tryAgain ─┘
 *
 * Changing the profile or the graph mode always returns to READY: the score on
 * screen must never belong to a curve other than the one being displayed.
 */

import MotionMatchNamespace from "../../MotionMatchNamespace.js";

export const RunState = {
  /** Target curve shown, nothing recorded yet. */
  READY: "ready",
  /** 3-2-1 lead-in; the student is getting into position. */
  COUNTDOWN: "countdown",
  /** Sampling the active source onto the trace. */
  RECORDING: "recording",
  /** The run finished (or was stopped) and a score is on screen. */
  SCORED: "scored",
} as const;

export type RunStateValue = (typeof RunState)[keyof typeof RunState];

MotionMatchNamespace.register("RunState", RunState);
