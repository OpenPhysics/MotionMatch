/**
 * MotionSensorModel.ts
 *
 * The Motion Sensor screen's model: MotionMatchModel driven by a real PASCO
 * Wireless Motion Sensor, over Web Bluetooth or WebUSB. Identical to the
 * Simulation screen in every other respect — same curves, same lifecycle, same
 * scoring — which is the whole point of the two-screen pairing.
 */

import { MotionMatchModel } from "../../common/model/MotionMatchModel.js";
import { MotionSensorSource } from "../../common/model/MotionSensorSource.js";
import { PositionSourceType } from "../../common/model/PositionSource.js";
import type { MotionMatchPreferencesModel } from "../../preferences/MotionMatchPreferencesModel.js";
import motionMatchQueryParameters from "../../preferences/motionMatchQueryParameters.js";
import { MotionRange, type MotionRangeValue } from "./PascoMotionProtocol.js";

const RANGE_BY_NAME: Record<string, MotionRangeValue | undefined> = {
  short: MotionRange.SHORT,
  long: MotionRange.LONG,
};

export class MotionSensorModel extends MotionMatchModel {
  /** Kept as a concrete type so the view can drive connect / disconnect. */
  public readonly sensorSource: MotionSensorSource;

  public constructor(preferences: MotionMatchPreferencesModel) {
    const usbBringUp = motionMatchQueryParameters.usbBringUp;
    const source = new MotionSensorSource({
      // The preference, not its query parameter: the rate is editable while the
      // sim runs, and the source re-times itself when it changes.
      sampleRateProperty: preferences.sensorSampleRateProperty,
      // "device" leaves the sensor on its power-up range and sends no command
      // at all, so a connection costs exactly one exchange fewer.
      range: RANGE_BY_NAME[motionMatchQueryParameters.sensorRange ?? "device"] ?? null,
      streamingEnabled: motionMatchQueryParameters.sensorStreaming,
      usbProbeOnly: usbBringUp === "probe" || usbBringUp === "probeAll",
      usbAcceptAllDevices: usbBringUp === "all" || usbBringUp === "probeAll",
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
