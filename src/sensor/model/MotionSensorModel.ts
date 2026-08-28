/**
 * MotionSensorModel.ts
 *
 * The Motion Sensor screen's model: MotionMatchModel driven by a real PASCO
 * Wireless Motion Sensor over Web Bluetooth. Identical to the Simulation
 * screen in every other respect — same curves, same lifecycle, same scoring —
 * which is the whole point of the two-screen pairing.
 */

import { MotionMatchModel } from "../../common/model/MotionMatchModel.js";
import { MotionSensorSource } from "../../common/model/MotionSensorSource.js";
import { PositionSourceType } from "../../common/model/PositionSource.js";
import type { MotionMatchPreferencesModel } from "../../preferences/MotionMatchPreferencesModel.js";
import motionMatchQueryParameters from "../../preferences/motionMatchQueryParameters.js";

export class MotionSensorModel extends MotionMatchModel {
  /** Kept as a concrete type so the view can drive connect / disconnect. */
  public readonly sensorSource: MotionSensorSource;

  public constructor(preferences: MotionMatchPreferencesModel) {
    const source = new MotionSensorSource({
      pollIntervalMs: motionMatchQueryParameters.pollIntervalMs,
      diagnosticsEnabledProperty: preferences.showDiagnosticsProperty,
    });
    super({
      sourceType: PositionSourceType.MOTION_SENSOR,
      source: source,
      positionToleranceProperty: preferences.positionToleranceProperty,
    });
    this.sensorSource = source;
  }
}
