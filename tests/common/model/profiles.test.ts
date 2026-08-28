/**
 * The nine target curves.
 *
 * These tests exist because the profiles are the sim's content: a curve that
 * strays outside the sensor's range, or whose velocity target does not match
 * the position curve it is drawn from, is not a bug a student could report —
 * they would simply be unable to score, and would assume it was them.
 */

import { describe, expect, it } from "vitest";
import { smoothstep } from "../../../src/common/model/MotionProfile.js";
import { PROFILES } from "../../../src/common/model/profiles.js";
import {
  CORNER_SMOOTHING_S,
  POSITION_RANGE_M,
  RUN_DURATION_S,
  VELOCITY_RANGE_MPS,
} from "../../../src/MotionMatchConstants.js";

/** The PS-3219's usable window, in metres. */
const SENSOR_MIN = 0.15;

/** Samples across the run, dense enough to catch a local excursion. */
function times(count = 501): number[] {
  return Array.from({ length: count }, (_, i) => (RUN_DURATION_S * i) / (count - 1));
}

describe("motion profiles", () => {
  it("there are exactly nine, lettered A through I", () => {
    expect(PROFILES).toHaveLength(9);
    expect(PROFILES.map((p) => p.letter)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I"]);
  });

  it("every profile has a unique id", () => {
    expect(new Set(PROFILES.map((p) => p.id)).size).toBe(PROFILES.length);
  });

  for (const profile of PROFILES) {
    describe(`profile ${profile.letter}`, () => {
      it("stays inside the sensor's usable range for the whole run", () => {
        for (const t of times()) {
          const x = profile.position(t);
          expect(x).toBeGreaterThanOrEqual(SENSOR_MIN);
          expect(x).toBeLessThanOrEqual(POSITION_RANGE_M.max);
        }
      });

      it("stays inside the velocity axis", () => {
        for (const t of times()) {
          expect(VELOCITY_RANGE_MPS.contains(profile.velocity(t))).toBe(true);
        }
      });

      it("raw velocity is the derivative of position away from corners", () => {
        const h = 1e-4;
        for (const t of times(101)) {
          // Skip the ends (one-sided) and a neighbourhood of each corner, where
          // the derivative genuinely does not exist.
          if (t < 0.2 || t > RUN_DURATION_S - 0.2) {
            continue;
          }
          if (profile.corners.some((corner) => Math.abs(t - corner) < 0.2)) {
            continue;
          }
          const numerical = (profile.position(t + h) - profile.position(t - h)) / (2 * h);
          expect(profile.rawVelocity(t)).toBeCloseTo(numerical, 3);
        }
      });

      it("smoothed velocity is continuous, including across corners", () => {
        const step = 0.01;
        let previous = profile.velocity(0);
        for (let t = step; t <= RUN_DURATION_S; t += step) {
          const current = profile.velocity(t);
          // Over 10 ms no profile should change speed by more than this; a step
          // discontinuity would jump far further.
          expect(Math.abs(current - previous)).toBeLessThan(0.05);
          previous = current;
        }
      });

      it("smoothed and raw velocity agree away from corners", () => {
        for (const t of times(101)) {
          if (profile.corners.some((corner) => Math.abs(t - corner) <= CORNER_SMOOTHING_S)) {
            continue;
          }
          expect(profile.velocity(t)).toBeCloseTo(profile.rawVelocity(t), 6);
        }
      });
    });
  }

  it("the piecewise profiles are the ones with corners", () => {
    const withCorners = PROFILES.filter((p) => p.corners.length > 0).map((p) => p.letter);
    expect(withCorners).toEqual(["D", "F", "G"]);
  });

  it("the smooth profiles declare no corners", () => {
    const withoutCorners = PROFILES.filter((p) => p.corners.length === 0).map((p) => p.letter);
    expect(withoutCorners).toEqual(["A", "B", "C", "E", "H", "I"]);
  });
});

describe("smoothstep", () => {
  it("is clamped, monotonic, and flat at both ends", () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 10);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(2)).toBe(1);
    expect(smoothstep(0.25)).toBeLessThan(smoothstep(0.75));
  });
});
