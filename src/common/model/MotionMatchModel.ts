/**
 * MotionMatchModel.ts
 *
 * Everything both screens share: which curve is the target, which quantity is
 * being matched, where the run is in its lifecycle, the recorded trace, and the
 * score.
 *
 * The two screens differ in exactly one way — where position comes from — so
 * the source is chosen once, at construction, and nothing below branches on it.
 *
 * ── One clock, two screens ────────────────────────────────────────────────────
 * The trace is sampled on a fixed-timestep accumulator rather than on raw frame
 * dt. A run therefore has the same number of samples, at the same instants,
 * whether it came from a 144 Hz display dragging a walker or from a sensor
 * answering every 40 ms. Scores are comparable across screens and machines.
 */

import { BooleanProperty, DerivedProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import type { TModel } from "scenerystack/joist";
import {
  COUNTDOWN_S,
  DEFAULT_POSITION_TOLERANCE_M,
  DEFAULT_VELOCITY_TOLERANCE_MPS,
  RUN_DURATION_S,
  SAMPLE_PERIOD_S,
} from "../../MotionMatchConstants.js";
import MotionMatchNamespace from "../../MotionMatchNamespace.js";
import { GraphMode, type GraphModeValue } from "./GraphMode.js";
import type { MotionProfile } from "./MotionProfile.js";
import type { Sample } from "./motionMath.js";
import type { PositionSourceTypeValue, TPositionSource } from "./PositionSource.js";
import { DEFAULT_PROFILE, PROFILES } from "./profiles.js";
import { RunState, type RunStateValue } from "./RunState.js";
import { scoreRun } from "./scoring.js";
import { Trace } from "./Trace.js";

/**
 * A dt larger than this is a tab that was backgrounded, not a slow frame.
 * Clamping stops the accumulator from firing hundreds of catch-up samples and
 * recording a flat line for time the student was not actually there for.
 */
const MAXIMUM_DT_S = 0.25;

/**
 * Samples in a complete run. Derived once so the run ends on a sample count
 * rather than on an accumulated float reaching RUN_DURATION_S — repeatedly
 * adding 0.05 drifts, and a run that ends one sample early or late would make
 * scores incomparable between runs.
 */
const TOTAL_SAMPLES = Math.round(RUN_DURATION_S / SAMPLE_PERIOD_S);

/**
 * Slack for the countdown comparison. Three seconds of 0.05 s ticks sums to
 * 2.9999999999999996, which without this would hold the countdown for one extra
 * frame.
 */
const TIME_EPSILON_S = 1e-9;

export type MotionMatchModelOptions = {
  /** Which source this screen is locked to. */
  readonly sourceType: PositionSourceTypeValue;
  /** The source itself, constructed by the screen model. */
  readonly source: TPositionSource;
  /** Half-width of the position match band, in metres. */
  readonly positionToleranceProperty?: TReadOnlyProperty<number>;
};

export class MotionMatchModel implements TModel {
  public readonly sourceType: PositionSourceTypeValue;
  public readonly source: TPositionSource;

  /** Which of the nine curves is the target. */
  public readonly profileProperty: Property<MotionProfile>;

  /** Whether the student is matching position or velocity. */
  public readonly graphModeProperty: Property<GraphModeValue>;

  public readonly runStateProperty: Property<RunStateValue>;

  /** Seconds elapsed within the current run, or within the countdown. */
  public readonly runTimeProperty: NumberProperty;

  /** Whole seconds left in the 3-2-1 lead-in; 0 outside COUNTDOWN. */
  public readonly countdownProperty: TReadOnlyProperty<number>;

  /** Percentage match for the run just finished, or null when there isn't one. */
  public readonly scoreProperty: Property<number | null>;

  /** True whenever the trace changed, so the view can redraw only when needed. */
  public readonly traceChangedProperty: BooleanProperty;

  /** Whether a run can be started right now. */
  public readonly canStartProperty: TReadOnlyProperty<boolean>;

  /**
   * The live match tolerance from Preferences, or null when the screen was
   * built without one. Public so the chart can redraw its band when a teacher
   * changes it mid-lesson.
   */
  public readonly positionToleranceProperty: TReadOnlyProperty<number> | null;

  private readonly trace: Trace;

  /** Leftover time not yet consumed by a whole sample period. */
  private timeAccumulator = 0;

  /** How many samples the current run has recorded. Integer, never derived from a float. */
  private sampleIndex = 0;

  private readonly resetRunOnChange: () => void;

  /** Guards against a second dispose(); axon Properties throw if disposed twice. */
  private isDisposed = false;

  public constructor(providedOptions: MotionMatchModelOptions) {
    this.sourceType = providedOptions.sourceType;
    this.source = providedOptions.source;
    this.positionToleranceProperty = providedOptions.positionToleranceProperty ?? null;

    this.trace = new Trace();

    this.profileProperty = new Property<MotionProfile>(DEFAULT_PROFILE, { validValues: [...PROFILES] });
    this.graphModeProperty = new Property<GraphModeValue>(GraphMode.POSITION);
    this.runStateProperty = new Property<RunStateValue>(RunState.READY);
    this.runTimeProperty = new NumberProperty(0, { units: "s" });
    this.scoreProperty = new Property<number | null>(null);
    this.traceChangedProperty = new BooleanProperty(false);

    this.countdownProperty = new DerivedProperty([this.runStateProperty, this.runTimeProperty], (state, time) =>
      state === RunState.COUNTDOWN ? Math.max(1, Math.ceil(COUNTDOWN_S - time)) : 0,
    );

    this.canStartProperty = new DerivedProperty(
      [this.runStateProperty, this.source.isAvailableProperty],
      (state, available) => available && (state === RunState.READY || state === RunState.SCORED),
    );

    // A score belongs to one curve in one mode. Changing either would leave a
    // number on screen that no longer describes what is drawn, so both reset
    // the run — the single rule that keeps the readout honest.
    this.resetRunOnChange = () => {
      this.abandonRun();
    };
    this.profileProperty.lazyLink(this.resetRunOnChange);
    this.graphModeProperty.lazyLink(this.resetRunOnChange);
  }

  /** The target curve as a function of time, for the current mode. */
  public getTargetFunction(): (time: number) => number {
    const profile = this.profileProperty.value;
    return this.graphModeProperty.value === GraphMode.POSITION
      ? (time) => profile.position(time)
      : (time) => profile.velocity(time);
  }

  /** Half-width of the match band in the current mode, in metres or m/s. */
  public getTolerance(): number {
    if (this.graphModeProperty.value === GraphMode.VELOCITY) {
      return DEFAULT_VELOCITY_TOLERANCE_MPS;
    }
    return this.positionToleranceProperty?.value ?? DEFAULT_POSITION_TOLERANCE_M;
  }

  /** The recorded samples in the current mode, ready to plot or score. */
  public getTraceSamples(): readonly Sample[] {
    return this.graphModeProperty.value === GraphMode.POSITION
      ? this.trace.getPositionSamples()
      : this.trace.getVelocitySamples();
  }

  /** Begins the 3-2-1 lead-in. No effect unless a run can start. */
  public startRun(): void {
    if (!this.canStartProperty.value) {
      return;
    }
    this.trace.clear();
    this.scoreProperty.value = null;
    this.runTimeProperty.value = 0;
    this.timeAccumulator = 0;
    this.sampleIndex = 0;
    this.runStateProperty.value = RunState.COUNTDOWN;
    this.traceChangedProperty.value = !this.traceChangedProperty.value;
  }

  /**
   * Ends a run early and scores what was recorded. A short run is a low score
   * rather than no score — stopping is a choice the student made, and hiding
   * its consequence would teach the wrong thing.
   */
  public stopRun(): void {
    if (this.runStateProperty.value !== RunState.RECORDING) {
      return;
    }
    this.finishRun();
  }

  /** Clears the trace and score and returns to READY, keeping curve and mode. */
  public abandonRun(): void {
    this.trace.clear();
    this.scoreProperty.value = null;
    this.runTimeProperty.value = 0;
    this.timeAccumulator = 0;
    this.sampleIndex = 0;
    this.runStateProperty.value = RunState.READY;
    this.traceChangedProperty.value = !this.traceChangedProperty.value;
  }

  private finishRun(): void {
    this.scoreProperty.value = scoreRun(this.getTraceSamples(), this.getTargetFunction(), this.getTolerance());
    this.runStateProperty.value = RunState.SCORED;
    this.traceChangedProperty.value = !this.traceChangedProperty.value;
  }

  public step(dt: number): void {
    const state = this.runStateProperty.value;
    if (state !== RunState.COUNTDOWN && state !== RunState.RECORDING) {
      return;
    }

    const clampedDt = Math.min(dt, MAXIMUM_DT_S);
    this.source.step(clampedDt);

    if (state === RunState.COUNTDOWN) {
      this.runTimeProperty.value += clampedDt;
      if (this.runTimeProperty.value >= COUNTDOWN_S - TIME_EPSILON_S) {
        this.runTimeProperty.value = 0;
        this.timeAccumulator = 0;
        this.sampleIndex = 0;
        this.runStateProperty.value = RunState.RECORDING;
      }
      return;
    }

    // Fixed-timestep sampling: consume whole sample periods, keep the remainder.
    this.timeAccumulator += clampedDt;
    let recorded = false;

    while (
      this.timeAccumulator >= SAMPLE_PERIOD_S - TIME_EPSILON_S &&
      this.runStateProperty.value === RunState.RECORDING
    ) {
      this.timeAccumulator -= SAMPLE_PERIOD_S;

      // Sample times come from the index, so they are exact multiples of the
      // period however many frames the run took.
      this.trace.add(this.sampleIndex * SAMPLE_PERIOD_S, this.source.positionProperty.value);
      this.sampleIndex += 1;
      recorded = true;
      this.runTimeProperty.value = this.sampleIndex * SAMPLE_PERIOD_S;

      if (this.sampleIndex >= TOTAL_SAMPLES) {
        this.finishRun();
      }
    }

    if (recorded) {
      this.traceChangedProperty.value = !this.traceChangedProperty.value;
    }
  }

  public reset(): void {
    this.abandonRun();
    this.profileProperty.reset();
    this.graphModeProperty.reset();
    this.source.reset();
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;

    this.profileProperty.unlink(this.resetRunOnChange);
    this.graphModeProperty.unlink(this.resetRunOnChange);
    this.countdownProperty.dispose();
    this.canStartProperty.dispose();
    this.profileProperty.dispose();
    this.graphModeProperty.dispose();
    this.runStateProperty.dispose();
    this.runTimeProperty.dispose();
    this.scoreProperty.dispose();
    this.traceChangedProperty.dispose();
    this.source.dispose();
  }
}

MotionMatchNamespace.register("MotionMatchModel", MotionMatchModel);
