/**
 * MotionSensorSource.ts
 *
 * The Motion Sensor screen's source: a PASCO Wireless Motion Sensor (PS-3219)
 * reached directly through Web Bluetooth using its small PASCO wire protocol.
 *
 * ── Polling, not streaming ────────────────────────────────────────────────────
 * One `readEchoTime` is one BLE round trip. Polling begins only when a run is
 * started and stops when that run ends, silencing the ultrasonic transducer
 * between attempts while leaving the Bluetooth connection ready.
 *
 * ── Errors never reach the caller ─────────────────────────────────────────────
 * `connect()` resolves even when it fails. Connection outcomes are UI state, not
 * exceptions: the button listener stays synchronous (so the browser still sees a
 * user gesture), and every outcome lands on `connectionStateProperty` /
 * `errorMessageProperty` where the panel can render it. A cancelled device
 * picker is not a failure — it returns to DISCONNECTED with no message.
 */

import { BooleanProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import {
  DEFAULT_POLL_INTERVAL_MS,
  MAXIMUM_CONSECUTIVE_FAILURES,
  POSITION_MEASUREMENT,
  POSITION_RANGE_M,
} from "../../MotionMatchConstants.js";
import MotionMatchNamespace from "../../MotionMatchNamespace.js";
import { BluetoothMotionSensor, DeviceSelectionCancelled } from "../../sensor/model/BluetoothMotionSensor.js";
import { echoTimeToMetres } from "../../sensor/model/PascoMotionProtocol.js";
import { ConnectionState, type ConnectionStateValue } from "./ConnectionState.js";
import { PositionSourceType, type PositionSourceTypeValue, type TPositionSource } from "./PositionSource.js";

export type MotionSensorSourceOptions = {
  /** Poll period in milliseconds; overridable from a query parameter for bring-up. */
  readonly pollIntervalMs?: number;
  /**
   * When true, publishes the raw echo time and calculated position.
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

  private device: BluetoothMotionSensor | null = null;

  private pollTimerId: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  /** Invalidates an asynchronous read if sampling stops while it is in flight. */
  private pollingGeneration = 0;
  private consecutiveFailures = 0;
  private diagnosticsStartTimeMs = 0;

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
    this.handleUnexpectedDisconnect = () => {
      this.stopSampling();
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
   * The device picker is invoked before the first await so the browser still
   * recognizes the Connect button's user gesture.
   */
  public async connect(): Promise<void> {
    if (this.connectionStateProperty.value === ConnectionState.CONNECTING) {
      return;
    }

    this.connectionStateProperty.value = ConnectionState.CONNECTING;
    this.errorMessageProperty.value = null;

    const device = new BluetoothMotionSensor(this.handleUnexpectedDisconnect);
    this.device = device;

    try {
      await device.connect();
    } catch (error) {
      await device.disconnect();
      this.device = null;
      if (error instanceof DeviceSelectionCancelled) {
        this.connectionStateProperty.value = ConnectionState.DISCONNECTED;
        return;
      }
      this.connectionStateProperty.value = ConnectionState.ERROR;
      this.errorMessageProperty.value = error instanceof Error ? error.message : String(error);
      return;
    }

    this.deviceNameProperty.value = device.name;
    this.measurementListProperty.value = POSITION_MEASUREMENT;
    this.connectionStateProperty.value = ConnectionState.CONNECTED;
    this.availableProperty.value = true;
    this.consecutiveFailures = 0;
    this.diagnosticsStartTimeMs = performance.now();
  }

  /** Tears the link down deliberately. Never rejects. */
  public async disconnect(): Promise<void> {
    this.stopSampling();
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

  public startSampling(): void {
    if (this.pollTimerId !== null) {
      return;
    }
    const generation = ++this.pollingGeneration;
    this.diagnosticsStartTimeMs = performance.now();
    this.poll(generation).catch(() => undefined);
    this.pollTimerId = setInterval(() => {
      this.poll(generation).catch(() => undefined);
    }, this.pollIntervalMs);
  }

  public stopSampling(): void {
    this.pollingGeneration += 1;
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
  private async poll(generation: number): Promise<void> {
    const device = this.device;
    if (this.isPolling || device === null || !device.isConnected) {
      return;
    }
    this.isPolling = true;

    try {
      const echoTimeMicroseconds = await device.readEchoTime();
      if (generation !== this.pollingGeneration) {
        return;
      }
      const metres = echoTimeToMetres(echoTimeMicroseconds);
      this.diagnosticsProperty.value = `${POSITION_MEASUREMENT}=${metres}`;

      if (this.diagnosticsEnabledProperty?.value === true) {
        const elapsedSeconds = (performance.now() - this.diagnosticsStartTimeMs) / 1000;
        // biome-ignore lint/suspicious/noConsole: Explicit hardware bring-up diagnostics.
        console.info(`[MotionMatch sensor +${elapsedSeconds.toFixed(3)} s]`, {
          EchoTimeMicroseconds: echoTimeMicroseconds,
          Position: metres,
        });
      }

      this.consecutiveFailures = 0;
      if (Number.isFinite(metres)) {
        // Out-of-range echoes read as wild distances; clamping keeps the walker
        // on the track and the trace on the chart instead of flinging both.
        this.sensorPositionProperty.value = POSITION_RANGE_M.constrainValue(metres);
      }
    } catch (error) {
      if (generation !== this.pollingGeneration) {
        return;
      }
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= MAXIMUM_CONSECUTIVE_FAILURES) {
        this.stopSampling();
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
    this.stopSampling();
    this.sensorPositionProperty.reset();
  }

  public dispose(): void {
    this.stopSampling();
    if (this.device !== null) {
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
