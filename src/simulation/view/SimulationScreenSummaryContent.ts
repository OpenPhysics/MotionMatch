/**
 * SimulationScreenSummaryContent.ts
 *
 * The accessible screen summary: what is on the screen, what the controls do,
 * what the run is doing right now, and how to get started.
 *
 * The "current details" region is live — it names the chosen curve, the graph
 * type, and the state of the run, so a screen-reader user can re-read where
 * they are at any moment without replaying anything.
 */
import { ScreenSummaryContent } from "scenerystack/sim";
import { createCurrentDetailsProperty } from "../../common/view/currentDetailsProperty.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { SimulationModel } from "../model/SimulationModel.js";

export class SimulationScreenSummaryContent extends ScreenSummaryContent {
  private readonly disposeSimulationScreenSummaryContent: () => void;

  public constructor(model: SimulationModel) {
    const a11y = StringManager.getInstance().getSimulationA11yStrings();
    const currentDetails = createCurrentDetailsProperty(model, a11y);

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetails.property,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });

    this.disposeSimulationScreenSummaryContent = currentDetails.dispose;
  }

  public override dispose(): void {
    this.disposeSimulationScreenSummaryContent();
    super.dispose();
  }
}
