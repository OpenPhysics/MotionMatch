/**
 * SimulationModel.ts
 *
 * The Simulation screen's model: MotionMatchModel driven by the walker the
 * student drags. Everything else — the nine curves, the run lifecycle, the
 * scorer — is shared with the Motion Sensor screen.
 */

import { MotionMatchModel } from "../../common/model/MotionMatchModel.js";
import { PointerPositionSource } from "../../common/model/PointerPositionSource.js";
import { PositionSourceType } from "../../common/model/PositionSource.js";
import type { MotionMatchPreferencesModel } from "../../preferences/MotionMatchPreferencesModel.js";

export class SimulationModel extends MotionMatchModel {
  /** Kept as a concrete type so the view can write to it while dragging. */
  public readonly pointerSource: PointerPositionSource;

  public constructor(preferences: MotionMatchPreferencesModel) {
    const source = new PointerPositionSource();
    super({
      sourceType: PositionSourceType.POINTER,
      source: source,
      positionToleranceProperty: preferences.positionToleranceProperty,
    });
    this.pointerSource = source;
  }
}
