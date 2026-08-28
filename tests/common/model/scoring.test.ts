/**
 * The scorer.
 *
 * The score is the one number a student takes away from a run, so its edges
 * matter: exactly on the tolerance must count, one epsilon beyond must not, and
 * an empty run must read as zero rather than crash the screen.
 */

import { describe, expect, it } from "vitest";
import type { Sample } from "../../../src/common/model/motionMath.js";
import { PERFECT_SCORE, scoreRun } from "../../../src/common/model/scoring.js";

const flatTarget = () => 2;

function samplesAt(values: readonly number[]): Sample[] {
  return values.map((value, i) => ({ time: i * 0.05, value: value }));
}

describe("scoreRun", () => {
  it("scores a trace that sits on the target 100", () => {
    expect(scoreRun(samplesAt([2, 2, 2, 2]), flatTarget, 0.25)).toBe(PERFECT_SCORE);
  });

  it("counts a sample exactly on the tolerance as matched", () => {
    expect(scoreRun(samplesAt([2.25, 1.75]), flatTarget, 0.25)).toBe(PERFECT_SCORE);
  });

  it("does not count a sample just beyond the tolerance", () => {
    expect(scoreRun(samplesAt([2.2500001, 1.7499999]), flatTarget, 0.25)).toBe(0);
  });

  it("is the proportion of samples inside the band", () => {
    // Two of four inside.
    expect(scoreRun(samplesAt([2, 2, 3, 3]), flatTarget, 0.25)).toBe(50);
  });

  it("rounds to a whole percent", () => {
    // One of three inside → 33.33…
    expect(scoreRun(samplesAt([2, 3, 3]), flatTarget, 0.25)).toBe(33);
  });

  it("scores an empty run 0 rather than throwing", () => {
    expect(scoreRun([], flatTarget, 0.25)).toBe(0);
  });

  it("follows the target, not a constant", () => {
    const ramp = (time: number) => time;
    const onTheRamp: Sample[] = [0, 1, 2, 3].map((t) => ({ time: t, value: t }));
    expect(scoreRun(onTheRamp, ramp, 0.01)).toBe(PERFECT_SCORE);
    const flat: Sample[] = [0, 1, 2, 3].map((t) => ({ time: t, value: 0 }));
    expect(scoreRun(flat, ramp, 0.01)).toBe(25);
  });

  it("a wider tolerance never lowers the score", () => {
    const trace = samplesAt([2, 2.3, 2.6, 1.5]);
    const narrow = scoreRun(trace, flatTarget, 0.25);
    const wide = scoreRun(trace, flatTarget, 0.6);
    expect(wide).toBeGreaterThanOrEqual(narrow);
  });
});
