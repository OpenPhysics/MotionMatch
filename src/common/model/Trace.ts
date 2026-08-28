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
import { differentiateTrailing, type Sample } from "./motionMath.js";

/** Five 20 Hz samples span the requested 200 ms smoothing interval. */
const SMOOTHING_WINDOW_SAMPLES = 5;

export class Trace {
  /** Position samples, in metres, in recording order. */
  private samples: Sample[] = [];

  /** Cached velocity series; invalidated whenever a sample is added. */
  private velocityCache: Sample[] | null = null;
  /** Causal smoothed values, finalized as each raw sample arrives. */
  private smoothedSamples: Sample[] = [];

  /** Records one position sample. */
  public add(time: number, position: number): void {
    this.samples.push({ time: time, value: position });
    const smoothingStart = Math.max(0, this.samples.length - SMOOTHING_WINDOW_SAMPLES);
    const smoothingWindow = this.samples.slice(smoothingStart);
    this.smoothedSamples.push({
      time: time,
      value: smoothingWindow.reduce((sum, sample) => sum + sample.value, 0) / smoothingWindow.length,
    });
    this.velocityCache = null;
  }

  /** Discards the run. */
  public clear(): void {
    this.samples = [];
    this.smoothedSamples = [];
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
   * Position samples with a short trailing average. Each value is finalized
   * when recorded, so later samples cannot alter the displayed past.
   */
  public getSmoothedPositionSamples(): readonly Sample[] {
    return this.smoothedSamples;
  }

  /** The causal velocity series, recomputed lazily from finalized values. */
  public getVelocitySamples(): readonly Sample[] {
    if (this.velocityCache === null) {
      this.velocityCache = differentiateTrailing(this.getSmoothedPositionSamples(), DERIVATIVE_WINDOW_SAMPLES);
    }
    return this.velocityCache;
  }

  /** Position of the most recent sample, or null before the first one. */
  public getLatestPosition(): number | null {
    const last = this.samples[this.samples.length - 1];
    return last === undefined ? null : last.value;
  }
}
