/**
 * MotionMatchPreferencesNode.ts
 *
 * Custom preferences UI shown in Preferences → Simulation. Controls are bound
 * to MotionMatchPreferencesModel Properties (whose initial values come from
 * motionMatchQueryParameters).
 */

import { Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox } from "scenerystack/sun";
import type { Tandem } from "scenerystack/tandem";
import { StringManager } from "../i18n/StringManager.js";
import MotionMatchColors from "../MotionMatchColors.js";
import MotionMatchNamespace from "../MotionMatchNamespace.js";
import type { MotionMatchPreferencesModel } from "./MotionMatchPreferencesModel.js";

export class MotionMatchPreferencesNode extends VBox {
  public constructor(preferencesModel: MotionMatchPreferencesModel, tandem?: Tandem) {
    const prefStrings = StringManager.getInstance().getPreferences();

    // The Preferences dialog is always white, so use the dark "light control surface"
    // colors (readable on white in both default and projector profiles), not textColorProperty
    // (which is near-white in default mode and would be invisible on the white dialog).
    const header = new Text(prefStrings.titleStringProperty, {
      font: new PhetFont({ size: 18, weight: "bold" }),
      fill: MotionMatchColors.controlSurfaceTextColorProperty,
    });

    const exampleToggleCheckbox = new Checkbox(
      preferencesModel.exampleToggleProperty,
      new Text(prefStrings.exampleToggleStringProperty, {
        font: new PhetFont(14),
        fill: MotionMatchColors.controlSurfaceTextColorProperty,
      }),
      {
        checkboxColor: MotionMatchColors.controlSurfaceTextColorProperty,
        checkboxColorBackground: MotionMatchColors.controlSurfaceColorProperty,
        spacing: 8,
        ...(tandem && { tandem: tandem.createTandem("exampleToggleCheckbox") }),
      },
    );

    super({
      align: "left",
      spacing: 12,
      children: [header, exampleToggleCheckbox],
    });
  }
}

MotionMatchNamespace.register("MotionMatchPreferencesNode", MotionMatchPreferencesNode);
