/**
 * RunControl.ts
 *
 * Start or pause the run with the standard play/pause control, then try again.
 *
 * ── The score is only ever the current run ────────────────────────────────────
 * Nothing is stored. There is no name to enter, no leaderboard, no history to
 * page through: the live number becomes final when a run ends, and it is gone the moment
 * the student picks a different curve, switches to velocity, or presses Try
 * Again. That is the whole scoring feature, deliberately.
 */

import { BooleanProperty, DerivedProperty } from "scenerystack/axon";
import { Text, VBox } from "scenerystack/scenery";
import { PhetFont, PlayPauseButton } from "scenerystack/scenery-phet";
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

const SCORE_FONT = new PhetFont({ size: 26, weight: "bold" });
const MESSAGE_FONT = new PhetFont(14);

export class RunControl extends MotionMatchPanel {
  /** Exposed so the ScreenView can order them in the PDOM. */
  public readonly playPauseButton: PlayPauseButton;
  public readonly tryAgainButton: RectangularPushButton;

  private readonly disposeRunControl: () => void;

  public constructor(model: MotionMatchModel, a11y: ScreenA11yStrings) {
    const strings = StringManager.getInstance();
    const runStrings = strings.getRunStrings();

    const isScoredProperty = new DerivedProperty([model.runStateProperty], (state) => state === RunState.SCORED);
    const isCountingDownProperty = new DerivedProperty(
      [model.runStateProperty],
      (state) => state === RunState.COUNTDOWN,
    );

    const isPlayingProperty = new BooleanProperty(false);
    const showPlayPauseProperty = new DerivedProperty(
      [model.runStateProperty],
      (state) => state === RunState.READY || state === RunState.COUNTDOWN || state === RunState.RECORDING,
    );
    const playPauseEnabledProperty = new DerivedProperty(
      [model.canStartProperty, model.runStateProperty],
      (canStart, state) => canStart || state === RunState.COUNTDOWN || state === RunState.RECORDING,
    );
    const playPauseButton = new PlayPauseButton(isPlayingProperty, {
      ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
      radius: 22,
      startPlayingAccessibleName: a11y.controls.startButtonStringProperty,
      endPlayingAccessibleName: a11y.controls.stopButtonStringProperty,
      visibleProperty: showPlayPauseProperty,
      enabledProperty: playPauseEnabledProperty,
    });

    const playingListener = (isPlaying: boolean) => {
      if (isPlaying) {
        model.startRun();
      } else if (model.runStateProperty.value === RunState.COUNTDOWN) {
        model.abandonRun();
      } else if (model.runStateProperty.value === RunState.RECORDING) {
        model.stopRun();
      }
    };
    isPlayingProperty.lazyLink(playingListener);

    const stateListener = (state: string) => {
      isPlayingProperty.value = state === RunState.COUNTDOWN || state === RunState.RECORDING;
    };
    model.runStateProperty.link(stateListener);

    const tryAgainButton = new RectangularPushButton({
      ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
      content: new Text(runStrings.tryAgainStringProperty, {
        font: new PhetFont(15),
        fill: LIGHT_SURFACE_TEXT_FILL,
      }),
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
        children: [playPauseButton, tryAgainButton, countdownText, connectFirstText],
      }),
      { minWidth: CONTROL_PANEL_WIDTH },
    );

    this.playPauseButton = playPauseButton;
    this.tryAgainButton = tryAgainButton;

    this.disposeRunControl = () => {
      for (const property of [
        isScoredProperty,
        isCountingDownProperty,
        showPlayPauseProperty,
        playPauseEnabledProperty,
        countdownProperty,
        needsSensorProperty,
      ]) {
        property.dispose();
      }
      model.runStateProperty.unlink(stateListener);
      isPlayingProperty.unlink(playingListener);
      isPlayingProperty.dispose();
    };
  }

  public override dispose(): void {
    this.disposeRunControl();
    super.dispose();
  }
}
