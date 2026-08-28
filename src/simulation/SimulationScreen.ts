/**
 * SimulationScreen.ts
 *
 * The top-level Screen component. It wires together the model and view
 * factories and passes screen-level options (name, background color, tandem)
 * to the parent Screen class.
 *
 * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar
 * icons come from createSimulationIcon() in src/common/MotionMatchScreenIcons.ts
 * (see doc/multi-screen.md).
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createSimulationIcon } from "../common/MotionMatchScreenIcons.js";
import MotionMatchColors from "../MotionMatchColors.js";
import { SimulationModel } from "./model/SimulationModel.js";
import { SimulationKeyboardHelpContent } from "./view/SimulationKeyboardHelpContent.js";
import { SimulationScreenView } from "./view/SimulationScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type SimulationScreenOptions = ScreenOptions & { tandem: Tandem };

export class SimulationScreen extends Screen<SimulationModel, SimulationScreenView> {
  public constructor(options: SimulationScreenOptions) {
    super(
      // Model factory — called once when the screen is first shown
      () => new SimulationModel(),
      // View factory — receives the model instance
      (model) =>
        new SimulationScreenView(model, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<SimulationScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: MotionMatchColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new SimulationKeyboardHelpContent(),
          homeScreenIcon: createSimulationIcon(),
          navigationBarIcon: createSimulationIcon(),
        },
        options,
      ),
    );
  }
}
