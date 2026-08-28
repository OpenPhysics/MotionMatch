/**
 * Trace.ts
 *
 * The student's recorded run: position sampled on the model's fixed clock, plus
 * the velocity derived from it.
 *
 * Velocity is always differentiated here, host-side, even on the Motion Sensor
 * screen where the device could report its own. Two reasons: the sensor's
 * derivative uses a different window from ours, so scores would not be
 * comparable between the two screens; and reading one measurement per BLE round
 * trip instead of three keeps the poll rate up.
 */

import { DERIVATIVE_WINDOW_SAMPLES } from "../../MotionMatchConstants.js";
import { differentiate, type Sample } from "./motionMath.js";

export class Trace {
  /** Position samples, in metres, in recording order. */
  private samples: Sample[] = [];

  /** Cached velocity series; invalidated whenever a sample is added. */
  private velocityCache: Sample[] | null = null;

  /** Records one position sample. */
  public add(time: number, position: number): void {
    this.samples.push({ time: time, value: position });
    this.velocityCache = null;
  }

  /** Discards the run. */
  public clear(): void {
    this.samples = [];
    this.velocityCache = null;
  }

  public get length(): number {
    return this.samples.length;
  }

  public get isEmpty(): boolean {
    return this.samples.length === 0;
  }

  /** The recorded position series. */
  public getPositionSamples(): readonly Sample[] {
    return this.samples;
  }

  /**
   * The velocity series, differentiated from position with a centered window.
   * Recomputed lazily, so appending a sample during a run stays O(1).
   */
  public getVelocitySamples(): readonly Sample[] {
    if (this.velocityCache === null) {
      this.velocityCache = differentiate(this.samples, DERIVATIVE_WINDOW_SAMPLES);
    }
    return this.velocityCache;
  }

  /** Position of the most recent sample, or null before the first one. */
  public getLatestPosition(): number | null {
    const last = this.samples[this.samples.length - 1];
    return last === undefined ? null : last.value;
  }
}
