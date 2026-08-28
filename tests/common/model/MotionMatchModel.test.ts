/**
 * The run lifecycle.
 *
 * The rule these tests are really guarding is that a score on screen always
 * belongs to the curve and graph currently drawn. Everything else — countdown,
 * sample count, early stop — follows from the same state machine.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { GraphMode } from "../../../src/common/model/GraphMode.js";
import { MotionMatchModel } from "../../../src/common/model/MotionMatchModel.js";
import { PointerPositionSource } from "../../../src/common/model/PointerPositionSource.js";
import { PositionSourceType } from "../../../src/common/model/PositionSource.js";
import { PROFILES } from "../../../src/common/model/profiles.js";
import { RunState } from "../../../src/common/model/RunState.js";
import { COUNTDOWN_S, RUN_DURATION_S, SAMPLE_PERIOD_S } from "../../../src/MotionMatchConstants.js";

/** Steps the model in sample-sized ticks, as the sim's clock does. */
function advance(model: MotionMatchModel, seconds: number): void {
  const ticks = Math.round(seconds / SAMPLE_PERIOD_S);
  for (let i = 0; i < ticks; i++) {
    model.step(SAMPLE_PERIOD_S);
  }
}

describe("MotionMatchModel", () => {
  let source: PointerPositionSource;
  let model: MotionMatchModel;

  beforeEach(() => {
    source = new PointerPositionSource();
    model = new MotionMatchModel({ sourceType: PositionSourceType.POINTER, source: source });
  });

  it("starts ready, with no score", () => {
    expect(model.runStateProperty.value).toBe(RunState.READY);
    expect(model.scoreProperty.value).toBeNull();
    expect(model.getTraceSamples()).toHaveLength(0);
  });

  it("runs countdown, then recording, then scored", () => {
    model.startRun();
    expect(model.runStateProperty.value).toBe(RunState.COUNTDOWN);

    advance(model, COUNTDOWN_S);
    expect(model.runStateProperty.value).toBe(RunState.RECORDING);

    advance(model, RUN_DURATION_S);
    expect(model.runStateProperty.value).toBe(RunState.SCORED);
    expect(model.scoreProperty.value).not.toBeNull();
  });

  it("counts down whole seconds while waiting", () => {
    model.startRun();
    expect(model.countdownProperty.value).toBe(COUNTDOWN_S);
    advance(model, 1);
    expect(model.countdownProperty.value).toBe(COUNTDOWN_S - 1);
  });

  it("records the run at the fixed sample rate", () => {
    model.startRun();
    advance(model, COUNTDOWN_S + RUN_DURATION_S);
    expect(model.getTraceSamples()).toHaveLength(RUN_DURATION_S / SAMPLE_PERIOD_S);
  });

  it("samples the source, so a perfectly walked curve scores 100", () => {
    // Profile C is "stand still" at 2 m; park the walker there and do nothing.
    const standStill = PROFILES.find((p) => p.letter === "C");
    expect(standStill).toBeDefined();
    if (standStill === undefined) {
      return;
    }
    model.profileProperty.value = standStill;
    source.walkerPositionProperty.value = standStill.position(0);

    model.startRun();
    advance(model, COUNTDOWN_S + RUN_DURATION_S);
    expect(model.scoreProperty.value).toBe(100);
  });

  it("scores a run stopped early on what was actually recorded", () => {
    model.startRun();
    advance(model, COUNTDOWN_S + 2);
    const recorded = model.getTraceSamples().length;
    model.stopRun();

    expect(model.runStateProperty.value).toBe(RunState.SCORED);
    expect(model.scoreProperty.value).not.toBeNull();
    expect(model.getTraceSamples()).toHaveLength(recorded);
  });

  it("clears the run when the profile changes", () => {
    model.startRun();
    advance(model, COUNTDOWN_S + RUN_DURATION_S);
    expect(model.scoreProperty.value).not.toBeNull();

    const other = PROFILES.find((p) => p !== model.profileProperty.value);
    expect(other).toBeDefined();
    if (other !== undefined) {
      model.profileProperty.value = other;
    }

    expect(model.runStateProperty.value).toBe(RunState.READY);
    expect(model.scoreProperty.value).toBeNull();
    expect(model.getTraceSamples()).toHaveLength(0);
  });

  it("clears the run when the graph mode changes", () => {
    model.startRun();
    advance(model, COUNTDOWN_S + RUN_DURATION_S);

    model.graphModeProperty.value = GraphMode.VELOCITY;

    expect(model.runStateProperty.value).toBe(RunState.READY);
    expect(model.scoreProperty.value).toBeNull();
    expect(model.getTraceSamples()).toHaveLength(0);
  });

  it("targets position or velocity according to the mode", () => {
    const profile = model.profileProperty.value;
    expect(model.getTargetFunction()(3)).toBeCloseTo(profile.position(3), 10);
    model.graphModeProperty.value = GraphMode.VELOCITY;
    expect(model.getTargetFunction()(3)).toBeCloseTo(profile.velocity(3), 10);
  });

  it("cannot start a second run while one is recording", () => {
    model.startRun();
    advance(model, COUNTDOWN_S + 1);
    const recorded = model.getTraceSamples().length;
    model.startRun();
    expect(model.getTraceSamples().length).toBeGreaterThanOrEqual(recorded);
    expect(model.runStateProperty.value).toBe(RunState.RECORDING);
  });

  it("ignores a huge dt rather than recording a backgrounded tab", () => {
    model.startRun();
    advance(model, COUNTDOWN_S);
    // A ten-second frame is a tab that was hidden, not ten seconds of walking.
    model.step(10);
    expect(model.getTraceSamples().length).toBeLessThanOrEqual(5);
  });

  it("try again returns to ready without touching the curve or mode", () => {
    model.graphModeProperty.value = GraphMode.VELOCITY;
    const profile = model.profileProperty.value;
    model.startRun();
    advance(model, COUNTDOWN_S + RUN_DURATION_S);

    model.abandonRun();

    expect(model.runStateProperty.value).toBe(RunState.READY);
    expect(model.scoreProperty.value).toBeNull();
    expect(model.graphModeProperty.value).toBe(GraphMode.VELOCITY);
    expect(model.profileProperty.value).toBe(profile);
  });

  it("reset returns everything to its starting state", () => {
    model.graphModeProperty.value = GraphMode.VELOCITY;
    model.startRun();
    advance(model, COUNTDOWN_S + 1);

    model.reset();

    expect(model.runStateProperty.value).toBe(RunState.READY);
    expect(model.graphModeProperty.value).toBe(GraphMode.POSITION);
    expect(model.scoreProperty.value).toBeNull();
  });
});
