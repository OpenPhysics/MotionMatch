/**
 * RunControl.ts
 *
 * Start the run, stop it early, try again — and the score for the run just
 * finished.
 *
 * ── The score is only ever the current run ────────────────────────────────────
 * Nothing is stored. There is no name to enter, no leaderboard, no history to
 * page through: the number appears when a run ends, and it is gone the moment
 * the student picks a different curve, switches to velocity, or presses Try
 * Again. That is the whole scoring feature, deliberately.
 */

import { DerivedProperty, PatternStringProperty } from "scenerystack/axon";
import { Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { RectangularPushButton } from "scenerystack/sun";
import { FLAT_PANEL_PUSH_BUTTON_OPTIONS, LIGHT_SURFACE_TEXT_FILL } from "../../common/MotionMatchButtonOptions.js";
import { MotionMatchPanel } from "../../common/MotionMatchPanel.js";
import type { ScreenA11yStrings } from "../../i18n/StringManager.js";
import { StringManager } from "../../i18n/StringManager.js";
import MotionMatchColors from "../../MotionMatchColors.js";
import { CONTROL_PANEL_WIDTH } from "../../MotionMatchConstants.js";
import type { MotionMatchModel } from "../model/MotionMatchModel.js";
import { PositionSourceType } from "../model/PositionSource.js";
import { RunState } from "../model/RunState.js";

const BUTTON_FONT = new PhetFont(15);
const SCORE_FONT = new PhetFont({ size: 26, weight: "bold" });
const MESSAGE_FONT = new PhetFont(14);

export class RunControl extends MotionMatchPanel {
  /** Exposed so the ScreenView can order them in the PDOM. */
  public readonly startButton: RectangularPushButton;
  public readonly stopButton: RectangularPushButton;
  public readonly tryAgainButton: RectangularPushButton;

  private readonly disposeRunControl: () => void;

  public constructor(model: MotionMatchModel, a11y: ScreenA11yStrings) {
    const strings = StringManager.getInstance();
    const runStrings = strings.getRunStrings();

    // Three buttons in one slot rather than one relabelled button: a screen
    // reader then announces a stable name for each action instead of a control
    // whose identity changes underneath the user.
    const isReadyProperty = new DerivedProperty([model.runStateProperty], (state) => state === RunState.READY);
    const isRecordingProperty = new DerivedProperty([model.runStateProperty], (state) => state === RunState.RECORDING);
    const isScoredProperty = new DerivedProperty([model.runStateProperty], (state) => state === RunState.SCORED);
    const isCountingDownProperty = new DerivedProperty(
      [model.runStateProperty],
      (state) => state === RunState.COUNTDOWN,
    );

    const startButton = new RectangularPushButton({
      ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
      content: new Text(runStrings.startStringProperty, { font: BUTTON_FONT, fill: LIGHT_SURFACE_TEXT_FILL }),
      listener: () => model.startRun(),
      accessibleName: a11y.controls.startButtonStringProperty,
      visibleProperty: isReadyProperty,
      enabledProperty: model.canStartProperty,
    });

    const stopButton = new RectangularPushButton({
      ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
      content: new Text(runStrings.stopStringProperty, { font: BUTTON_FONT, fill: LIGHT_SURFACE_TEXT_FILL }),
      listener: () => model.stopRun(),
      accessibleName: a11y.controls.stopButtonStringProperty,
      visibleProperty: isRecordingProperty,
    });

    const tryAgainButton = new RectangularPushButton({
      ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
      content: new Text(runStrings.tryAgainStringProperty, { font: BUTTON_FONT, fill: LIGHT_SURFACE_TEXT_FILL }),
      listener: () => model.abandonRun(),
      accessibleName: a11y.controls.tryAgainButtonStringProperty,
      visibleProperty: isScoredProperty,
    });

    // The countdown reads "Get ready…" plus the seconds remaining, so the
    // number is never alone on screen without an explanation.
    const countdownProperty = new DerivedProperty(
      [model.countdownProperty, runStrings.getReadyStringProperty],
      (count, getReady) => `${getReady} ${count}`,
    );
    const countdownText = new Text(countdownProperty, {
      font: SCORE_FONT,
      fill: MotionMatchColors.accentColorProperty,
      visibleProperty: isCountingDownProperty,
      maxWidth: CONTROL_PANEL_WIDTH - 40,
    });

    // PatternStringProperty needs a number, and the score is null between runs;
    // 0 is a safe stand-in because the readout is hidden unless a score exists.
    const scoreNumberProperty = new DerivedProperty([model.scoreProperty], (score) => score ?? 0);
    const scoreStringProperty = new PatternStringProperty(runStrings.scorePatternStringProperty, {
      score: scoreNumberProperty,
    });
    const hasScoreProperty = new DerivedProperty([model.scoreProperty], (score) => score !== null);
    const scoreText = new Text(scoreStringProperty, {
      font: SCORE_FONT,
      fill: MotionMatchColors.accentColorProperty,
      visibleProperty: hasScoreProperty,
      maxWidth: CONTROL_PANEL_WIDTH - 40,
    });

    // Only the sensor screen can be unable to start, and only for one reason:
    // nothing is connected yet. Saying so beats a disabled button with no
    // explanation.
    const needsSensorProperty = new DerivedProperty(
      [model.source.isAvailableProperty],
      (available) => model.sourceType === PositionSourceType.MOTION_SENSOR && !available,
    );
    const connectFirstText = new Text(runStrings.connectFirstStringProperty, {
      font: MESSAGE_FONT,
      fill: MotionMatchColors.textColorProperty,
      visibleProperty: needsSensorProperty,
      maxWidth: CONTROL_PANEL_WIDTH - 40,
    });

    super(
      new VBox({
        align: "center",
        spacing: 10,
        preferredWidth: CONTROL_PANEL_WIDTH - 24,
        stretch: false,
        children: [startButton, stopButton, tryAgainButton, countdownText, scoreText, connectFirstText],
      }),
      { minWidth: CONTROL_PANEL_WIDTH },
    );

    this.startButton = startButton;
    this.stopButton = stopButton;
    this.tryAgainButton = tryAgainButton;

    this.disposeRunControl = () => {
      for (const property of [
        isReadyProperty,
        isRecordingProperty,
        isScoredProperty,
        isCountingDownProperty,
        countdownProperty,
        scoreNumberProperty,
        scoreStringProperty,
        hasScoreProperty,
        needsSensorProperty,
      ]) {
        property.dispose();
      }
    };
  }

  public override dispose(): void {
    this.disposeRunControl();
    super.dispose();
  }
}
