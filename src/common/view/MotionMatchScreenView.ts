/**
 * MotionMatchScreenView.ts
 *
 * The one view both screens use.
 *
 * The Simulation screen and the Motion Sensor screen differ only in where
 * position comes from, so they share a view rather than each owning a
 * near-copy. Two options carry the whole difference: a writable position
 * property makes the walker draggable, and a sensor source adds the connection
 * panel. Everything else — chart, track, curve chooser, run controls — is
 * identical by construction, which is what makes a student's second screen feel
 * like the same activity with real hardware attached.
 */

import type { NumberProperty, TReadOnlyProperty } from "scenerystack/axon";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { HBox, Line, Node, Rectangle, type TColor, Text, VBox } from "scenerystack/scenery";
import { PhetFont, ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/MotionMatchButtonOptions.js";
import type { ScreenA11yStrings, SensorA11yStrings } from "../../i18n/StringManager.js";
import { StringManager } from "../../i18n/StringManager.js";
import MotionMatchColors from "../../MotionMatchColors.js";
import { CHART_WIDTH, SCREEN_VIEW_MARGIN } from "../../MotionMatchConstants.js";
import type { MotionMatchModel } from "../model/MotionMatchModel.js";
import type { MotionSensorSource } from "../model/MotionSensorSource.js";
import { MatchChartNode } from "./MatchChartNode.js";
import { PlayAreaNode } from "./PlayAreaNode.js";
import { ProfileControl } from "./ProfileControl.js";
import { RunControl } from "./RunControl.js";
import { SensorPanel } from "./SensorPanel.js";

const LEGEND_FONT = new PhetFont(12);

export type MotionMatchScreenViewSelfOptions = {
  readonly a11y: ScreenA11yStrings;
  /** Present on the Simulation screen only; makes the walker draggable. */
  readonly writablePositionProperty?: NumberProperty;
  /** Present on the Motion Sensor screen only; adds the connection panel. */
  readonly sensorSource?: MotionSensorSource;
  readonly sensorA11y?: SensorA11yStrings;
  readonly showDiagnosticsProperty?: TReadOnlyProperty<boolean>;
};

export type MotionMatchScreenViewOptions = MotionMatchScreenViewSelfOptions & ScreenViewOptions;

export class MotionMatchScreenView extends ScreenView {
  private readonly chartNode: MatchChartNode;
  private readonly disposeMotionMatchScreenView: () => void;

  public constructor(model: MotionMatchModel, providedOptions: MotionMatchScreenViewOptions) {
    const options = optionize<MotionMatchScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()({}, providedOptions);
    super(options);

    const a11y = providedOptions.a11y;
    const strings = StringManager.getInstance();
    const legendStrings = strings.getLegendStrings();

    this.addChild(
      new Rectangle(0, 0, this.layoutBounds.width, this.layoutBounds.height, {
        fill: MotionMatchColors.backgroundColorProperty,
      }),
    );

    // The combo box's popup has to be added above everything else, so it gets
    // its own layer created before the controls that fill it.
    const comboBoxListParent = new Node();

    const chartNode = new MatchChartNode(model);
    chartNode.left = SCREEN_VIEW_MARGIN;
    chartNode.top = SCREEN_VIEW_MARGIN;
    this.chartNode = chartNode;
    this.addChild(chartNode);

    // Dash pattern in the swatch matches the dash pattern on the chart, so the
    // legend is readable in greyscale and by a colour-blind student.
    const legend = new HBox({
      spacing: 24,
      children: [
        MotionMatchScreenView.createLegendEntry(
          legendStrings.targetStringProperty,
          MotionMatchColors.targetCurveColorProperty,
          [6, 4],
        ),
        MotionMatchScreenView.createLegendEntry(
          legendStrings.yoursStringProperty,
          MotionMatchColors.traceColorProperty,
          [],
        ),
      ],
      left: SCREEN_VIEW_MARGIN + 44,
      top: chartNode.bottom + 6,
    });
    this.addChild(legend);

    const playAreaNode = new PlayAreaNode({
      width: CHART_WIDTH,
      positionProperty: model.source.positionProperty,
      ...(providedOptions.writablePositionProperty
        ? { writablePositionProperty: providedOptions.writablePositionProperty }
        : {}),
      walkerAccessibleName: a11y.controls.walkerStringProperty,
      walkerAccessibleHelpText: a11y.controls.walkerHelpStringProperty,
      ...(providedOptions.sensorSource
        ? { hasPositionProperty: providedOptions.sensorSource.isAvailableProperty }
        : {}),
    });
    playAreaNode.left = SCREEN_VIEW_MARGIN;
    playAreaNode.top = legend.bottom + 10;
    this.addChild(playAreaNode);

    const profileControl = new ProfileControl({
      profileProperty: model.profileProperty,
      graphModeProperty: model.graphModeProperty,
      listParent: comboBoxListParent,
      comboBoxAccessibleName: a11y.controls.profileComboBoxStringProperty,
      comboBoxAccessibleHelpText: a11y.controls.profileComboBoxHelpStringProperty,
      radioAccessibleName: a11y.controls.graphModeRadioStringProperty,
    });

    const runControl = new RunControl(model, a11y);

    const sensorSource = providedOptions.sensorSource;
    const sensorA11y = providedOptions.sensorA11y;
    const showDiagnosticsProperty = providedOptions.showDiagnosticsProperty;
    const sensorPanel =
      sensorSource && sensorA11y && showDiagnosticsProperty
        ? new SensorPanel({
            source: sensorSource,
            a11y: sensorA11y,
            showDiagnosticsProperty: showDiagnosticsProperty,
          })
        : null;

    const controlColumn = new VBox({
      align: "left",
      spacing: 14,
      children: [profileControl, runControl, ...(sensorPanel === null ? [] : [sensorPanel])],
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      top: SCREEN_VIEW_MARGIN,
    });
    this.addChild(controlColumn);

    const resetAllButton = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      listener: () => {
        model.reset();
        this.reset();
      },
      right: this.layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      bottom: this.layoutBounds.maxY - SCREEN_VIEW_MARGIN,
    });
    this.addChild(resetAllButton);

    this.addChild(comboBoxListParent);

    // Traversal order follows the task: choose a curve, start the run, move the
    // walker, connect hardware if there is any, reset last.
    this.addChild(
      new Node({
        pdomOrder: [
          profileControl.comboBox,
          profileControl.graphModeRadioGroup,
          runControl.startButton,
          runControl.stopButton,
          runControl.tryAgainButton,
          ...(providedOptions.writablePositionProperty ? [playAreaNode.walkerNode] : []),
          ...(sensorPanel?.connectButton ? [sensorPanel.connectButton] : []),
          ...(sensorPanel ? [sensorPanel.disconnectButton] : []),
          resetAllButton,
        ],
      }),
    );

    // Nothing here links against model state directly — the chart and the
    // panels own their listeners and tear them down themselves.
    this.disposeMotionMatchScreenView = () => {
      // intentionally empty
    };
  }

  private static createLegendEntry(labelProperty: TReadOnlyProperty<string>, stroke: TColor, lineDash: number[]): Node {
    return new HBox({
      spacing: 6,
      children: [
        new Line(0, 0, 22, 0, { stroke: stroke, lineWidth: 2.5, lineDash: lineDash }),
        new Text(labelProperty, { font: LEGEND_FONT, fill: MotionMatchColors.textColorProperty, maxWidth: 120 }),
      ],
    });
  }

  /** Redraws the target when a preference changes its shape or its band. */
  public refreshTarget(): void {
    this.chartNode.updateTarget();
  }

  public reset(): void {
    this.chartNode.updateTarget();
  }

  public override dispose(): void {
    this.disposeMotionMatchScreenView();
    super.dispose();
  }
}
