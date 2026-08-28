/**
 * GraphMode.ts
 *
 * Which quantity the student is matching: position against time, or velocity
 * against time. The toggle changes the target curve, the y-axis, and the
 * tolerance — but not the profile, so a student can switch mid-lesson and see
 * the same motion from both sides.
 *
 * A const object rather than a TS `enum`: `erasableSyntaxOnly` rejects `enum`.
 */

import MotionMatchNamespace from "../../MotionMatchNamespace.js";

export const GraphMode = {
  POSITION: "position",
  VELOCITY: "velocity",
} as const;

export type GraphModeValue = (typeof GraphMode)[keyof typeof GraphMode];

/** Ordered for the radio-button group. */
export const GRAPH_MODES: readonly GraphModeValue[] = [GraphMode.POSITION, GraphMode.VELOCITY];

MotionMatchNamespace.register("GraphMode", GraphMode);
