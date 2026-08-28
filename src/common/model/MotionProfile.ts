/**
 * MotionProfile.ts
 *
 * One target curve the student tries to match, and the machinery that turns a
 * single definition into both a position-vs-time and a velocity-vs-time target.
 *
 * A profile is defined **once**, as a position function plus its analytic
 * derivative. The velocity target is never a second hand-drawn curve: it is the
 * derivative of the very curve shown in position mode, which is the whole point
 * of the position/velocity toggle.
 *
 * ── Corner smoothing ──────────────────────────────────────────────────────────
 * Several of PASCO's profiles are piecewise-linear in position (walk slowly,
 * then quickly; wait, walk, stop). Their exact derivative is a step, which no
 * student can walk and which reads as a vertical line on the chart. Each such
 * corner is therefore blended with a smoothstep over CORNER_SMOOTHING_S, so the
 * velocity target is continuous. Position is left exactly as drawn — the blend
 * would shift it by under 2 cm on a 4 m axis, far inside the match tolerance,
 * and keeping position exact means the two modes stay legible as the same curve.
 *
 * See doc/model.md for the nine profiles and their equations.
 */

import { CORNER_SMOOTHING_S } from "../../MotionMatchConstants.js";

/**
 * The raw mathematical shape of a profile, before corner smoothing.
 *
 * `corners` lists the times at which `velocity` jumps. It is part of the
 * definition rather than something detected numerically, so a profile author
 * states the discontinuities explicitly and smoothing never guesses.
 */
export type ProfileShape = {
  readonly position: (time: number) => number;
  readonly velocity: (time: number) => number;
  readonly corners: readonly number[];
};

/** A single point where a piecewise-linear profile changes slope. */
export type Knot = {
  readonly time: number;
  readonly position: number;
};

/**
 * Smooth Hermite interpolation on [0, 1]: 0 at 0, 1 at 1, zero slope at both
 * ends. Values outside [0, 1] are clamped.
 */
export function smoothstep(t: number): number {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/**
 * Builds a shape from a position function and its analytic derivative. Use for
 * profiles that are smooth everywhere (a line, a parabola, a sinusoid).
 */
export function analyticShape(position: (time: number) => number, velocity: (time: number) => number): ProfileShape {
  return { position, velocity, corners: [] };
}

/**
 * Builds a shape from a list of knots joined by straight lines. Slopes are
 * derived from the knots, and every interior knot whose slope actually changes
 * becomes a corner.
 */
export function piecewiseLinearShape(knots: readonly Knot[]): ProfileShape {
  const slopes: number[] = [];
  for (let i = 0; i < knots.length - 1; i++) {
    const from = knots[i];
    const to = knots[i + 1];
    if (from === undefined || to === undefined) {
      throw new Error("piecewiseLinearShape: knot list must be dense");
    }
    slopes.push((to.position - from.position) / (to.time - from.time));
  }

  /** Index of the segment containing `time`, clamped to the ends. */
  const segmentIndexAt = (time: number): number => {
    for (let i = 0; i < slopes.length; i++) {
      const to = knots[i + 1];
      if (to !== undefined && time < to.time) {
        return i;
      }
    }
    return slopes.length - 1;
  };

  const position = (time: number): number => {
    const i = segmentIndexAt(time);
    const from = knots[i];
    const slope = slopes[i];
    if (from === undefined || slope === undefined) {
      throw new Error("piecewiseLinearShape: empty knot list");
    }
    return from.position + slope * (time - from.time);
  };

  const velocity = (time: number): number => {
    const slope = slopes[segmentIndexAt(time)];
    if (slope === undefined) {
      throw new Error("piecewiseLinearShape: empty knot list");
    }
    return slope;
  };

  // Only interior knots where the slope genuinely changes are corners; a knot
  // that merely subdivides a straight run is not a discontinuity.
  const corners: number[] = [];
  for (let i = 1; i < knots.length - 1; i++) {
    const before = slopes[i - 1];
    const after = slopes[i];
    const knot = knots[i];
    if (before !== undefined && after !== undefined && knot !== undefined && before !== after) {
      corners.push(knot.time);
    }
  }

  return { position, velocity, corners };
}

/**
 * The velocity target: the shape's derivative, with a smoothstep blend across
 * each declared corner.
 *
 * Corners in the nine profiles are at least 1.5 s apart and the blend is 0.4 s
 * wide, so at most one blend is ever active at a given time.
 */
export function smoothedVelocity(shape: ProfileShape, time: number): number {
  const halfWidth = CORNER_SMOOTHING_S / 2;

  for (const corner of shape.corners) {
    if (time > corner - halfWidth && time < corner + halfWidth) {
      const before = shape.velocity(corner - CORNER_SMOOTHING_S);
      const after = shape.velocity(corner + CORNER_SMOOTHING_S);
      return before + (after - before) * smoothstep((time - (corner - halfWidth)) / CORNER_SMOOTHING_S);
    }
  }

  return shape.velocity(time);
}

/**
 * A target curve, ready for the chart and the scorer.
 *
 * `letter` is the profile's identifier in PASCO's own activity sheet (A–I); it
 * is deliberately not localized, so a class working from the printed worksheet
 * and a class working from the sim are talking about the same curve.
 */
export class MotionProfile {
  public readonly id: string;
  public readonly letter: string;
  private readonly shape: ProfileShape;

  public constructor(id: string, letter: string, shape: ProfileShape) {
    this.id = id;
    this.letter = letter;
    this.shape = shape;
  }

  /** Target position at `time`, in metres from the sensor. */
  public position(time: number): number {
    return this.shape.position(time);
  }

  /** Target velocity at `time`, in m/s, with corners smoothed. */
  public velocity(time: number): number {
    return smoothedVelocity(this.shape, time);
  }

  /** The exact derivative at `time`, with no corner smoothing. For tests and docs. */
  public rawVelocity(time: number): number {
    return this.shape.velocity(time);
  }

  /** Times at which the raw derivative jumps. Empty for the smooth profiles. */
  public get corners(): readonly number[] {
    return this.shape.corners;
  }
}
