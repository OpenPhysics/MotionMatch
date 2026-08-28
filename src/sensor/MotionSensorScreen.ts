/**
 * MotionSensorScreen.ts
 *
 * The top-level Screen component. It wires together the model and view
 * factories and passes screen-level options (name, background color, tandem)
 * to the parent Screen class.
 *
 * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar
 * icons come from createMotionSensorIcon() in src/common/MotionMatchScreenIcons.ts
 * (see doc/multi-screen.md).
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createMotionSensorIcon } from "../common/MotionMatchScreenIcons.js";
import MotionMatchColors from "../MotionMatchColors.js";
import { MotionSensorModel } from "./model/MotionSensorModel.js";
import { MotionSensorKeyboardHelpContent } from "./view/MotionSensorKeyboardHelpContent.js";
import { MotionSensorScreenView } from "./view/MotionSensorScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type MotionSensorScreenOptions = ScreenOptions & { tandem: Tandem };

export class MotionSensorScreen extends Screen<MotionSensorModel, MotionSensorScreenView> {
  public constructor(options: MotionSensorScreenOptions) {
    super(
      // Model factory — called once when the screen is first shown
      () => new MotionSensorModel(),
      // View factory — receives the model instance
      (model) =>
        new MotionSensorScreenView(model, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<MotionSensorScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: MotionMatchColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new MotionSensorKeyboardHelpContent(),
          homeScreenIcon: createMotionSensorIcon(),
          navigationBarIcon: createMotionSensorIcon(),
        },
        options,
      ),
    );
  }
}
