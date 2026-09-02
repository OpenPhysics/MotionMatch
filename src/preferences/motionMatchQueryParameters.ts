/**
 * motionMatchQueryParameters.ts
 *
 * Sim-specific startup query parameters. This is the single place where every
 * sim-specific query parameter is declared and documented. Public-facing
 * parameters (intended for end users / sharing links) must set `public: true`.
 *
 * ── How to add a query parameter ──────────────────────────────────────────────
 * 1. Add an entry below with a `type`, `defaultValue`, and (if user-facing)
 *    `public: true`. Add `isValidValue` to bound numeric ranges.
 * 2. If it should also be user-editable at runtime, surface it as a preference
 *    in MotionMatchPreferencesModel (initialize that Property from this query parameter).
 *
 * Usage: append e.g. `?matchTolerance=0.4` to the sim URL.
 */

import { logGlobal } from "scenerystack/phet-core";
import { QueryStringMachine } from "scenerystack/query-string-machine";
import {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_POSITION_TOLERANCE_M,
  POSITION_TOLERANCE_RANGE_M,
} from "../MotionMatchConstants.js";
import MotionMatchNamespace from "../MotionMatchNamespace.js";

const motionMatchQueryParameters = QueryStringMachine.getAll({
  /**
   * Half-width of the position match band, in metres. Teachers lower it to make
   * a class work harder, or raise it for younger students. Also editable at
   * runtime in Preferences → Simulation.
   */
  matchTolerance: {
    type: "number",
    defaultValue: DEFAULT_POSITION_TOLERANCE_M,
    isValidValue: (value: number) => POSITION_TOLERANCE_RANGE_M.contains(value),
    public: true,
  },

  /**
   * Show the raw sensor reading and connection detail on the Motion Sensor
   * screen. For hardware bring-up, not for students.
   */
  showDiagnostics: {
    type: "boolean",
    defaultValue: false,
  },

  /**
   * How often to poll the sensor, in milliseconds. Lower is more responsive and
   * more likely to saturate the BLE link; raise it when debugging a flaky one.
   */
  pollIntervalMs: {
    type: "number",
    defaultValue: DEFAULT_POLL_INTERVAL_MS,
    isValidValue: (value: number) => value >= 10 && value <= 1000,
  },

  /**
   * Receiver range to ask the sensor for at connect. `long` is the range the
   * device powers up on and the only one this sim has been run on; `short`
   * raises the receiver's gain, which suits a 0–2 m axis in principle and is
   * what PASCO recommends for close work. Needs hardware to tell which tracks
   * a walking student better — hence a query parameter rather than a default.
   */
  sensorRange: {
    type: "string",
    defaultValue: "device",
    validValues: ["device", "short", "long"],
  },

  /**
   * How to reach the PS-3219. `usb` uses WebUSB against PASCO's vendor ID and
   * needs the sensor plugged into the machine running the browser; `bluetooth`
   * is the default and the only path that has been used with students.
   */
  sensorTransport: {
    type: "string",
    defaultValue: "bluetooth",
    validValues: ["bluetooth", "usb"],
  },

  /**
   * Put the device on its own clock at this rate instead of polling it, which
   * removes the round-trip jitter a poll cannot avoid. Needs a transport that
   * carries the stream, so USB only; Bluetooth ignores it and keeps polling.
   * Zero, the default, polls everywhere and is what students run.
   */
  sensorSampleRateHz: {
    type: "number",
    defaultValue: 0,
    isValidValue: (value: number) => value === 0 || (value >= 1 && value <= 250),
  },

  /**
   * USB bring-up only. `probe` opens the sensor, reports its descriptors and
   * sends nothing — the safe first look, since a PS-3219 can be knocked off the
   * bus by transfers it dislikes. `all` drops the vendor filter from the picker.
   */
  usbBringUp: {
    type: "string",
    defaultValue: "off",
    validValues: ["off", "probe", "all", "probeAll"],
  },
});

MotionMatchNamespace.register("motionMatchQueryParameters", motionMatchQueryParameters);

// Log query parameters (for the console / PhET-iO).
logGlobal("phet.chipper.queryParameters");

export default motionMatchQueryParameters;
