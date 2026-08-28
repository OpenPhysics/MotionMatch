/**
 * currentDetailsProperty.ts
 *
 * The live sentence a screen reader hears in the screen summary: which curve,
 * which graph, and what the run is doing right now.
 *
 * Each state gets its own whole localized sentence rather than being assembled
 * from fragments. Word order, agreement and punctuation differ between
 * languages, and a sentence stitched together at runtime is correct only in the
 * language it was stitched for.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { DerivedProperty, PatternStringProperty } from "scenerystack/axon";
import type { ScreenA11yStrings } from "../../i18n/StringManager.js";
import { StringManager } from "../../i18n/StringManager.js";
import { RUN_DURATION_S } from "../../MotionMatchConstants.js";
import { GraphMode } from "../model/GraphMode.js";
import type { MotionMatchModel } from "../model/MotionMatchModel.js";
import { PositionSourceType } from "../model/PositionSource.js";
import { RunState } from "../model/RunState.js";

export type CurrentDetails = {
  readonly property: TReadOnlyProperty<string>;
  readonly dispose: () => void;
};

export function createCurrentDetailsProperty(model: MotionMatchModel, a11y: ScreenA11yStrings): CurrentDetails {
  const modeStrings = StringManager.getInstance().getGraphModeStrings();

  const letterProperty = new DerivedProperty([model.profileProperty], (profile) => profile.letter);
  const modeNameProperty = new DerivedProperty(
    [model.graphModeProperty, modeStrings.positionStringProperty, modeStrings.velocityStringProperty],
    (mode, position, velocity) => (mode === GraphMode.POSITION ? position : velocity),
  );
  const scoreNumberProperty = new DerivedProperty([model.scoreProperty], (score) => score ?? 0);
  // Spoken time is rounded to whole seconds: a screen reader announcing two
  // decimal places twenty times a second is unusable.
  const wholeSecondsProperty = new DerivedProperty([model.runTimeProperty], (time) => Math.round(time));

  const readyProperty = new PatternStringProperty(a11y.currentDetails.readyStringProperty, {
    letter: letterProperty,
    mode: modeNameProperty,
  });
  const countdownProperty = new PatternStringProperty(a11y.currentDetails.countdownStringProperty, {
    count: model.countdownProperty,
  });
  const recordingProperty = new PatternStringProperty(a11y.currentDetails.recordingStringProperty, {
    time: wholeSecondsProperty,
    total: RUN_DURATION_S,
  });
  const scoredProperty = new PatternStringProperty(a11y.currentDetails.scoredStringProperty, {
    letter: letterProperty,
    score: scoreNumberProperty,
  });

  const property = new DerivedProperty(
    [
      model.runStateProperty,
      model.source.isAvailableProperty,
      readyProperty,
      countdownProperty,
      recordingProperty,
      scoredProperty,
      a11y.currentDetails.waitingForSensorStringProperty,
    ],
    (state, available, ready, countdown, recording, scored, waiting) => {
      // On the sensor screen, "ready to start" is untrue until something is
      // connected; say what is actually blocking instead.
      if (!available && model.sourceType === PositionSourceType.MOTION_SENSOR) {
        return waiting;
      }
      switch (state) {
        case RunState.COUNTDOWN:
          return countdown;
        case RunState.RECORDING:
          return recording;
        case RunState.SCORED:
          return scored;
        default:
          return ready;
      }
    },
  );

  return {
    property: property,
    dispose: () => {
      property.dispose();
      scoredProperty.dispose();
      recordingProperty.dispose();
      countdownProperty.dispose();
      readyProperty.dispose();
      wholeSecondsProperty.dispose();
      scoreNumberProperty.dispose();
      modeNameProperty.dispose();
      letterProperty.dispose();
    },
  };
}
