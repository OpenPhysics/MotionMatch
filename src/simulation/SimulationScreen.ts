/**
 * SimulationScreen.ts
 *
 * The Simulation screen: match the target curve by dragging the walker.
 *
 * The view is the shared MotionMatchScreenView; handing it a writable position
 * property is the whole of what makes this screen the pointer-driven one.
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Screen, type ScreenOptions } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createSimulationIcon } from "../common/MotionMatchScreenIcons.js";
import { MotionMatchKeyboardHelpContent } from "../common/view/MotionMatchKeyboardHelpContent.js";
import { MotionMatchScreenView } from "../common/view/MotionMatchScreenView.js";
import { StringManager } from "../i18n/StringManager.js";
import MotionMatchColors from "../MotionMatchColors.js";
import type { MotionMatchPreferencesModel } from "../preferences/MotionMatchPreferencesModel.js";
import { SimulationModel } from "./model/SimulationModel.js";
import { SimulationScreenSummaryContent } from "./view/SimulationScreenSummaryContent.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type SimulationScreenOptions = ScreenOptions & { tandem: Tandem };

export class SimulationScreen extends Screen<SimulationModel, MotionMatchScreenView> {
  public constructor(preferences: MotionMatchPreferencesModel, options: SimulationScreenOptions) {
    super(
      () => new SimulationModel(preferences),
      (model) =>
        new MotionMatchScreenView(model, {
          a11y: StringManager.getInstance().getSimulationA11yStrings(),
          writablePositionProperty: model.pointerSource.walkerPositionProperty,
          showMotionDescriptionsProperty: preferences.showMotionDescriptionsProperty,
          screenSummaryContent: new SimulationScreenSummaryContent(model),
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<SimulationScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: MotionMatchColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new MotionMatchKeyboardHelpContent(),
          homeScreenIcon: createSimulationIcon(),
          navigationBarIcon: createSimulationIcon(),
        },
        options,
      ),
    );
  }
}
