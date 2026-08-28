/**
 * MotionMatchPreferencesModel.ts
 *
 * Model for the simulation-specific preferences shown in Preferences →
 * Simulation. Each preference Property takes its initial value from the
 * corresponding query parameter in motionMatchQueryParameters.
 */

import { BooleanProperty, NumberProperty } from "scenerystack/axon";
import type { Tandem } from "scenerystack/tandem";
import { POSITION_TOLERANCE_RANGE_M } from "../MotionMatchConstants.js";
import MotionMatchNamespace from "../MotionMatchNamespace.js";
import motionMatchQueryParameters from "./motionMatchQueryParameters.js";

export class MotionMatchPreferencesModel {
  /**
   * Half-width of the position match band, in metres. Widening it makes every
   * curve easier; the band is drawn on the chart, so the change is visible
   * rather than a silent thumb on the scale.
   */
  public readonly positionToleranceProperty: NumberProperty;

  /** Whether to show raw sensor readings on the Motion Sensor screen. */
  public readonly showDiagnosticsProperty: BooleanProperty;

  public constructor(tandem?: Tandem) {
    this.positionToleranceProperty = new NumberProperty(motionMatchQueryParameters.matchTolerance, {
      range: POSITION_TOLERANCE_RANGE_M,
      units: "m",
      ...(tandem ? { tandem: tandem.createTandem("positionToleranceProperty") } : {}),
    });

    this.showDiagnosticsProperty = new BooleanProperty(
      motionMatchQueryParameters.showDiagnostics,
      tandem ? { tandem: tandem.createTandem("showDiagnosticsProperty") } : undefined,
    );
  }

  public reset(): void {
    this.positionToleranceProperty.reset();
    this.showDiagnosticsProperty.reset();
  }
}

MotionMatchNamespace.register("MotionMatchPreferencesModel", MotionMatchPreferencesModel);
