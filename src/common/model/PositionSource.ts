/**
 * PositionSource.ts
 *
 * The seam that lets the Simulation screen and the Motion Sensor screen run the
 * same model, the same chart, and the same scorer. A source answers one
 * question — where is the walker right now, in metres from the sensor — and the
 * model samples that answer on its own fixed clock.
 *
 * ── Why "latest value", not a running total ───────────────────────────────────
 * RadioactivityAndStatistics solves the same problem with a monotonically
 * increasing count, so that a mismatch between the sim's clock and the device's
 * clock cannot lose events. That trick is specific to *counting*: totals can be
 * differenced over any interval. Position is a continuous signal that is sampled,
 * not accumulated, so the contract here is deliberately different — the source
 * publishes its most recent reading and the model decides when to look.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import MotionMatchNamespace from "../../MotionMatchNamespace.js";

export const PositionSourceType = {
  /** Driven by mouse, touch, or keyboard on the walker. */
  POINTER: "pointer",
  /** Driven by a PASCO Wireless Motion Sensor over Web Bluetooth. */
  MOTION_SENSOR: "motionSensor",
} as const;

export type PositionSourceTypeValue = (typeof PositionSourceType)[keyof typeof PositionSourceType];

export type TPositionSource = {
  readonly sourceType: PositionSourceTypeValue;

  /** Most recent reading, in metres from the sensor. */
  readonly positionProperty: TReadOnlyProperty<number>;

  /**
   * Whether the source can currently supply readings. The pointer source is
   * always available; the sensor source is available only while connected.
   * A run cannot start unless this is true.
   */
  readonly isAvailableProperty: TReadOnlyProperty<boolean>;

  /**
   * Advances a source that runs on the sim's clock. Hardware sources ignore it:
   * the sensor keeps ranging whether or not the sim is stepping, and pretending
   * otherwise would make a paused tab look like a stationary student.
   */
  step(dt: number): void;

  reset(): void;
  dispose(): void;
};

MotionMatchNamespace.register("PositionSourceType", PositionSourceType);
