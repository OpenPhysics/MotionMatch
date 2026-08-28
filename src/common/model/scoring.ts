/**
 * scoring.ts
 *
 * How well a recorded run matched its target curve.
 *
 * ── Why fraction-in-band, not RMS error ───────────────────────────────────────
 * The score is the percentage of recorded samples that fell inside a tolerance
 * band around the target. That band is drawn on the chart, so the number is not
 * a verdict handed down by a hidden formula: a student can point at the stretch
 * of their trace that left the band and say *that* is what cost them. An RMS
 * error is a better statistic and a worse teacher — it has no on-screen
 * counterpart, and one bad moment quietly dominates it.
 *
 * Pure functions, no SceneryStack imports.
 */

import type { Sample } from "./motionMath.js";

/** A score of 100 means every sample landed inside the band. */
export const PERFECT_SCORE = 100;

/**
 * Percentage of `samples` lying within `tolerance` of `target`, rounded to a
 * whole number in [0, 100].
 *
 * An empty run scores 0 rather than throwing: stopping a run before the first
 * sample is a thing students do, and it should read as "no match", not as a
 * broken screen.
 */
export function scoreRun(samples: readonly Sample[], target: (time: number) => number, tolerance: number): number {
  if (samples.length === 0) {
    return 0;
  }

  let matched = 0;
  for (const sample of samples) {
    if (Math.abs(sample.value - target(sample.time)) <= tolerance) {
      matched += 1;
    }
  }

  return Math.round((PERFECT_SCORE * matched) / samples.length);
}
