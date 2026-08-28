/**
 * MotionSensorSource.ts
 *
 * The Motion Sensor screen's source: a PASCO Wireless Motion Sensor (PS-3219)
 * reached over Web Bluetooth through the `pasco-ble` library.
 *
 * ── Polling, not streaming ────────────────────────────────────────────────────
 * pasco-ble's transport is request/response — one `readData` is one BLE round
 * trip. We poll faster than the model samples, so a fresh reading is always
 * waiting when the model's fixed clock comes round.
 *
 * ── The device object is built lazily ─────────────────────────────────────────
 * `new PASCOBLEDevice()` throws outright where Web Bluetooth is missing —
 * Firefox, Safari, an insecure origin, a headless test browser. Constructing it
 * in this constructor therefore took the whole Motion Sensor screen down at
 * model-creation time for those users, instead of showing them the "use Chrome
 * or Edge" message the panel already has. It is now created on the first
 * connect attempt, which is the only moment it can be used anyway.
 *
 * ── Errors never reach the caller ─────────────────────────────────────────────
 * `connect()` resolves even when it fails. Connection outcomes are UI state, not
 * exceptions: the button listener stays synchronous (so the browser still sees a
 * user gesture), and every outcome lands on `connectionStateProperty` /
 * `errorMessageProperty` where the panel can render it. A cancelled device
 * picker is not a failure — it returns to DISCONNECTED with no message.
 */

import { PASCOBLEDevice } from "pasco-ble";
import { BooleanProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import {
  DEFAULT_POLL_INTERVAL_MS,
  MAXIMUM_CONSECUTIVE_FAILURES,
  MOTION_SENSOR_NAME_FILTER,
  POSITION_MEASUREMENT,
  POSITION_RANGE_M,
} from "../../MotionMatchConstants.js";
import MotionMatchNamespace from "../../MotionMatchNamespace.js";
import { ConnectionState, type ConnectionStateValue } from "./ConnectionState.js";
import { PositionSourceType, type PositionSourceTypeValue, type TPositionSource } from "./PositionSource.js";

export type MotionSensorSourceOptions = {
  /** Poll period in milliseconds; overridable from a query parameter for bring-up. */
  readonly pollIntervalMs?: number;
  /**
   * When true, every poll reads the sensor's whole measurement list instead of
   * just Position, and publishes it verbatim on {@link diagnosticsProperty}.
   * Costs extra BLE round trips, so it is off unless someone is debugging.
   */
  readonly diagnosticsEnabledProperty?: TReadOnlyProperty<boolean>;
};

export class MotionSensorSource implements TPositionSource {
  public readonly sourceType: PositionSourceTypeValue = PositionSourceType.MOTION_SENSOR;

  /** Where the sensor last saw the student, in metres. */
  public readonly sensorPositionProperty: NumberProperty;

  public readonly connectionStateProperty: Property<ConnectionStateValue>;

  /** Human-readable failure text, or null when nothing has gone wrong. */
  public readonly errorMessageProperty: Property<string | null>;

  /** Advertised name of the connected device, or null. */
  public readonly deviceNameProperty: Property<string | null>;

  /**
   * What the device says it can measure, captured at connect time. Empty until
   * connected. Shown only with diagnostics on — if this is empty on a connected
   * device, the datasheet lookup failed and no reading will ever arrive.
   */
  public readonly measurementListProperty: Property<string>;

  /**
   * The last raw reading, formatted for display, including the distinction
   * between a null (no answer) and a 0 (an answer of zero — usually nothing
   * within the sensor's 0.15–4 m range to echo off).
   */
  public readonly diagnosticsProperty: Property<string>;

  private readonly availableProperty: BooleanProperty;

  private readonly pollIntervalMs: number;
  private readonly diagnosticsEnabledProperty: TReadOnlyProperty<boolean> | null;
  private readonly handleUnexpectedDisconnect: () => void;

  /** Built on the first connect attempt; null until then, and where BLE is unavailable. */
  private device: PASCOBLEDevice | null = null;

  private pollTimerId: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  private consecutiveFailures = 0;

  public constructor(providedOptions?: MotionSensorSourceOptions) {
    this.pollIntervalMs = providedOptions?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.diagnosticsEnabledProperty = providedOptions?.diagnosticsEnabledProperty ?? null;

    this.sensorPositionProperty = new NumberProperty(0, { range: POSITION_RANGE_M, units: "m" });
    this.connectionStateProperty = new Property<ConnectionStateValue>(ConnectionState.DISCONNECTED);
    this.errorMessageProperty = new Property<string | null>(null);
    this.deviceNameProperty = new Property<string | null>(null);
    this.availableProperty = new BooleanProperty(false);
    this.measurementListProperty = new Property<string>("");
    this.diagnosticsProperty = new Property<string>("");

    // Stored as a field so it can be removed in dispose(); an anonymous closure
    // here would leak this source for the lifetime of the device object.
    this.handleUnexpectedDisconnect = () => {
      this.stopPolling();
      this.availableProperty.value = false;
      this.deviceNameProperty.value = null;
      this.connectionStateProperty.value = ConnectionState.ERROR;
      this.errorMessageProperty.value = "disconnected";
    };
  }

  public get positionProperty(): TReadOnlyProperty<number> {
    return this.sensorPositionProperty;
  }

  public get isAvailableProperty(): TReadOnlyProperty<boolean> {
    return this.availableProperty;
  }

  /**
   * Opens the browser's device picker and connects. Never rejects.
   *
   * Everything before `scan()` is synchronous so the call still counts as
   * happening inside the user gesture that triggered it — Web Bluetooth refuses
   * `requestDevice` otherwise.
   */
  public async connect(): Promise<void> {
    if (this.connectionStateProperty.value === ConnectionState.CONNECTING) {
      return;
    }

    this.connectionStateProperty.value = ConnectionState.CONNECTING;
    this.errorMessageProperty.value = null;

    let device: PASCOBLEDevice;
    try {
      // Constructing the device is itself a Web Bluetooth operation and throws
      // where the API is missing, so it lives inside the try with everything else.
      if (this.device === null) {
        this.device = new PASCOBLEDevice();
        this.device.on("disconnected", this.handleUnexpectedDisconnect);
      }
      device = this.device;
    } catch (error) {
      this.connectionStateProperty.value = ConnectionState.ERROR;
      this.errorMessageProperty.value = error instanceof Error ? error.message : String(error);
      return;
    }

    try {
      const devices = await device.scan(MOTION_SENSOR_NAME_FILTER);

      // pasco-ble maps a dismissed picker to an empty result rather than an
      // error, so this branch is "the student changed their mind", not a fault.
      if (devices.length === 0) {
        this.connectionStateProperty.value = ConnectionState.DISCONNECTED;
        return;
      }

      const chosen = devices[0];
      if (chosen === undefined) {
        this.connectionStateProperty.value = ConnectionState.DISCONNECTED;
        return;
      }

      await device.connect(chosen);
    } catch (error) {
      this.connectionStateProperty.value = ConnectionState.ERROR;
      this.errorMessageProperty.value = error instanceof Error ? error.message : String(error);
      return;
    }

    this.deviceNameProperty.value = device.name;
    this.measurementListProperty.value = device.getMeasurementList().join(", ");
    this.connectionStateProperty.value = ConnectionState.CONNECTED;
    this.availableProperty.value = true;
    this.consecutiveFailures = 0;
    this.startPolling();
  }

  /** Tears the link down deliberately. Never rejects. */
  public async disconnect(): Promise<void> {
    this.stopPolling();
    try {
      await this.device?.disconnect();
    } catch {
      // A disconnect that fails leaves nothing useful to say or do; the state
      // below is what the student sees either way.
    }
    this.availableProperty.value = false;
    this.deviceNameProperty.value = null;
    this.measurementListProperty.value = "";
    this.diagnosticsProperty.value = "";
    this.errorMessageProperty.value = null;
    this.connectionStateProperty.value = ConnectionState.DISCONNECTED;
  }

  private startPolling(): void {
    if (this.pollTimerId !== null) {
      return;
    }
    this.pollTimerId = setInterval(() => {
      this.poll().catch(() => undefined);
    }, this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimerId !== null) {
      clearInterval(this.pollTimerId);
      this.pollTimerId = null;
    }
    this.isPolling = false;
  }

  /**
   * One reading. Skipping a tick because the previous round trip has not
   * returned is harmless — the model samples the latest value, so a late
   * reading costs at most one stale sample rather than corrupting the trace.
   */
  private async poll(): Promise<void> {
    const device = this.device;
    if (this.isPolling || device === null || !device.isConnected()) {
      return;
    }
    this.isPolling = true;

    try {
      let metres: number | null;

      if (this.diagnosticsEnabledProperty?.value === true) {
        // Read everything the device offers, so a zero Position can be told
        // apart from a device that is answering nothing at all.
        const names = device.getMeasurementList();
        const data = await device.readDataList(names);
        this.diagnosticsProperty.value = names
          .map((name) => `${name}=${data[name] === null || data[name] === undefined ? "null" : data[name]}`)
          .join("  ");
        metres = data[POSITION_MEASUREMENT] ?? null;
      } else {
        metres = await device.readData(POSITION_MEASUREMENT);
        this.diagnosticsProperty.value = `${POSITION_MEASUREMENT}=${metres === null ? "null" : metres}`;
      }

      this.consecutiveFailures = 0;
      if (metres !== null && Number.isFinite(metres)) {
        // Out-of-range echoes read as wild distances; clamping keeps the walker
        // on the track and the trace on the chart instead of flinging both.
        this.sensorPositionProperty.value = POSITION_RANGE_M.constrainValue(metres);
      }
    } catch (error) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= MAXIMUM_CONSECUTIVE_FAILURES) {
        this.stopPolling();
        this.availableProperty.value = false;
        this.connectionStateProperty.value = ConnectionState.ERROR;
        this.errorMessageProperty.value = error instanceof Error ? error.message : String(error);
      }
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * No-op. The sensor ranges on its own clock, so a paused or backgrounded sim
   * must not be mistaken for a stationary student.
   */
  public step(_dt: number): void {
    // intentionally empty
  }

  /** Returns to the pre-run state without dropping the connection. */
  public reset(): void {
    this.sensorPositionProperty.reset();
  }

  public dispose(): void {
    this.stopPolling();
    if (this.device !== null) {
      this.device.off("disconnected", this.handleUnexpectedDisconnect);
      // Fire-and-forget: dispose cannot await, and a failed teardown of a link
      // that is going away anyway has nothing useful to report.
      this.device.disconnect().catch(() => undefined);
      this.device = null;
    }
    this.sensorPositionProperty.dispose();
    this.connectionStateProperty.dispose();
    this.errorMessageProperty.dispose();
    this.deviceNameProperty.dispose();
    this.measurementListProperty.dispose();
    this.diagnosticsProperty.dispose();
    this.availableProperty.dispose();
  }
}

MotionMatchNamespace.register("MotionSensorSource", MotionSensorSource);
