/**
 * MotionMatchPreferencesNode.ts
 *
 * The Preferences → Simulation tab.
 *
 * Teacher-facing controls for match tolerance, optional motion hints, and raw
 * sensor diagnostics.
 *
 * Note the text colour: the Preferences dialog is always light, whatever colour
 * profile the sim is in, so labels here use `controlSurfaceTextColorProperty`
 * and never `textColorProperty`.
 */

import { Node, Text, VBox } from "scenerystack/scenery";
import { NumberControl, PhetFont } from "scenerystack/scenery-phet";
import { Checkbox } from "scenerystack/sun";
import type { Tandem } from "scenerystack/tandem";
import { StringManager } from "../i18n/StringManager.js";
import MotionMatchColors from "../MotionMatchColors.js";
import { POSITION_TOLERANCE_RANGE_M } from "../MotionMatchConstants.js";
import MotionMatchNamespace from "../MotionMatchNamespace.js";
import type { MotionMatchPreferencesModel } from "./MotionMatchPreferencesModel.js";

const LABEL_FONT = new PhetFont(14);
const DESCRIPTION_FONT = new PhetFont(12);
const CONTENT_WIDTH = 440;

export class MotionMatchPreferencesNode extends Node {
  public constructor(preferences: MotionMatchPreferencesModel, tandem?: Tandem) {
    const strings = StringManager.getInstance().getPreferences();

    const toleranceControl = new NumberControl(
      strings.matchToleranceStringProperty,
      preferences.positionToleranceProperty,
      POSITION_TOLERANCE_RANGE_M,
      {
        delta: 0.05,
        titleNodeOptions: { font: LABEL_FONT, fill: MotionMatchColors.controlSurfaceTextColorProperty },
        numberDisplayOptions: { decimalPlaces: 2, textOptions: { font: LABEL_FONT } },
        sliderOptions: { constrainValue: (value: number) => Math.round(value * 20) / 20 },
        ...(tandem ? { tandem: tandem.createTandem("toleranceControl") } : {}),
      },
    );

    const toleranceDescription = new Text(strings.matchToleranceDescriptionStringProperty, {
      font: DESCRIPTION_FONT,
      fill: MotionMatchColors.controlSurfaceTextColorProperty,
      maxWidth: CONTENT_WIDTH,
    });

    const diagnosticsCheckbox = new Checkbox(
      preferences.showDiagnosticsProperty,
      new Text(strings.showDiagnosticsStringProperty, {
        font: LABEL_FONT,
        fill: MotionMatchColors.controlSurfaceTextColorProperty,
        maxWidth: CONTENT_WIDTH - 40,
      }),
      {
        accessibleName: strings.showDiagnosticsStringProperty,
        ...(tandem ? { tandem: tandem.createTandem("diagnosticsCheckbox") } : {}),
      },
    );

    const motionDescriptionsCheckbox = new Checkbox(
      preferences.showMotionDescriptionsProperty,
      new Text(strings.showMotionDescriptionsStringProperty, {
        font: LABEL_FONT,
        fill: MotionMatchColors.controlSurfaceTextColorProperty,
        maxWidth: CONTENT_WIDTH - 40,
      }),
      {
        accessibleName: strings.showMotionDescriptionsStringProperty,
        ...(tandem ? { tandem: tandem.createTandem("motionDescriptionsCheckbox") } : {}),
      },
    );

    super({
      children: [
        new VBox({
          align: "left",
          spacing: 12,
          children: [toleranceControl, toleranceDescription, motionDescriptionsCheckbox, diagnosticsCheckbox],
        }),
      ],
    });
  }
}

MotionMatchNamespace.register("MotionMatchPreferencesNode", MotionMatchPreferencesNode);
