/**
 * MotionSensorScreen.ts
 *
 * The Motion Sensor screen: match the target curve by walking in front of a
 * PASCO Wireless Motion Sensor.
 *
 * Same view, same curves, same scoring as the Simulation screen — it is handed
 * a sensor source instead of a writable position, which adds the connection
 * panel and makes the walker follow the hardware.
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Screen, type ScreenOptions } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createMotionSensorIcon } from "../common/MotionMatchScreenIcons.js";
import { MotionMatchKeyboardHelpContent } from "../common/view/MotionMatchKeyboardHelpContent.js";
import { MotionMatchScreenView } from "../common/view/MotionMatchScreenView.js";
import { StringManager } from "../i18n/StringManager.js";
import MotionMatchColors from "../MotionMatchColors.js";
import type { MotionMatchPreferencesModel } from "../preferences/MotionMatchPreferencesModel.js";
import { MotionSensorModel } from "./model/MotionSensorModel.js";
import { MotionSensorScreenSummaryContent } from "./view/MotionSensorScreenSummaryContent.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type MotionSensorScreenOptions = ScreenOptions & { tandem: Tandem };

export class MotionSensorScreen extends Screen<MotionSensorModel, MotionMatchScreenView> {
  public constructor(preferences: MotionMatchPreferencesModel, options: MotionSensorScreenOptions) {
    super(
      () => new MotionSensorModel(preferences),
      (model) => {
        const a11y = StringManager.getInstance().getMotionSensorA11yStrings();
        return new MotionMatchScreenView(model, {
          a11y: a11y,
          sensorA11y: a11y,
          sensorSource: model.sensorSource,
          showDiagnosticsProperty: preferences.showDiagnosticsProperty,
          screenSummaryContent: new MotionSensorScreenSummaryContent(model),
          tandem: options.tandem.createTandem("view"),
        });
      },
      optionize<MotionSensorScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: MotionMatchColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new MotionMatchKeyboardHelpContent(),
          homeScreenIcon: createMotionSensorIcon(),
          navigationBarIcon: createMotionSensorIcon(),
        },
        options,
      ),
    );
  }
}
