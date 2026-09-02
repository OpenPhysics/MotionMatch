/**
 * MotionSensorSource.ts
 *
 * The Motion Sensor screen's source: a PASCO Wireless Motion Sensor (PS-3219)
 * reached directly over Web Bluetooth or WebUSB using its small PASCO wire
 * protocol.
 *
 * ── Either transport, polled or streamed ──────────────────────────────────────
 * Web Bluetooth and WebUSB carry the same PASCO packets, so `connect()` takes
 * the transport as an argument and everything below this class is shared.
 * Sampling begins only when a run starts and stops when it ends, silencing the
 * ultrasonic transducer in between while leaving the connection ready. One
 * `readEchoTime` is one round trip; where the transport can carry a stream the
 * device keeps time itself instead and pushes samples — see `startSampling`.
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
  DEFAULT_SENSOR_SAMPLE_RATE_HZ,
  MAXIMUM_CONSECUTIVE_FAILURES,
  POSITION_MEASUREMENT,
  POSITION_RANGE_M,
} from "../../MotionMatchConstants.js";
import MotionMatchNamespace from "../../MotionMatchNamespace.js";
import { BluetoothMotionSensor } from "../../sensor/model/BluetoothMotionSensor.js";
import { DeviceSelectionCancelled, type TMotionSensorDevice } from "../../sensor/model/MotionSensorDevice.js";
import { echoTimeToMetres, type MotionRangeValue } from "../../sensor/model/PascoMotionProtocol.js";
import { UsbMotionSensor } from "../../sensor/model/UsbMotionSensor.js";
import { ConnectionState, type ConnectionStateValue } from "./ConnectionState.js";
import { PositionSourceType, type PositionSourceTypeValue, type TPositionSource } from "./PositionSource.js";

/** The two ways a PS-3219 can be reached from a browser. */
export const SensorTransport = {
  BLUETOOTH: "bluetooth",
  USB: "usb",
} as const;

export type SensorTransportValue = (typeof SensorTransport)[keyof typeof SensorTransport];

/**
 * How long a stream may say nothing before the run gives up on it and polls
 * instead. Long enough to cover a slow first sample at the lowest rate the
 * preference allows, short enough that a run of ten seconds still gets a trace.
 */
const STREAM_SILENCE_TIMEOUT_MS = 1000;

export type MotionSensorSourceOptions = {
  /**
   * How often to take a reading, in hertz — the poll rate, or the rate the
   * device is asked to keep when it is streaming. Live, because it is a
   * preference: a change mid-run re-times sampling rather than waiting for the
   * next connection.
   */
  readonly sampleRateProperty?: TReadOnlyProperty<number>;
  /**
   * Receiver range to ask the device for once connected, or null to leave it on
   * whatever it powered up with.
   */
  readonly range?: MotionRangeValue | null;
  /**
   * Let a transport that can carry a stream put the device on its own clock.
   * False polls everywhere; transports without a stream poll regardless.
   */
  readonly streamingEnabled?: boolean;
  /** USB bring-up switches; ignored on Bluetooth. */
  readonly usbProbeOnly?: boolean;
  readonly usbAcceptAllDevices?: boolean;
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

  private readonly sampleRateProperty: TReadOnlyProperty<number>;
  /** Non-null only when no rate was supplied, and therefore ours to dispose. */
  private readonly ownedSampleRateProperty: NumberProperty | null;
  private readonly range: MotionRangeValue | null;
  private readonly streamingEnabled: boolean;
  private readonly usbProbeOnly: boolean;
  private readonly usbAcceptAllDevices: boolean;
  private readonly diagnosticsEnabledProperty: TReadOnlyProperty<boolean> | null;
  private readonly handleUnexpectedDisconnect: () => void;
  private readonly handleSampleRateChange: () => void;

  private device: TMotionSensorDevice | null = null;

  private pollTimerId: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  private isStreaming = false;
  /** Whether a run has asked for readings, whichever mechanism is serving it. */
  private samplingRequested = false;
  private streamWatchdogId: ReturnType<typeof setTimeout> | null = null;
  private samplesSinceStreamStart = 0;
  /** Invalidates an asynchronous read if sampling stops while it is in flight. */
  private pollingGeneration = 0;
  private consecutiveFailures = 0;
  private diagnosticsStartTimeMs = 0;

  public constructor(providedOptions?: MotionSensorSourceOptions) {
    const providedSampleRateProperty = providedOptions?.sampleRateProperty;
    this.ownedSampleRateProperty = providedSampleRateProperty
      ? null
      : new NumberProperty(DEFAULT_SENSOR_SAMPLE_RATE_HZ, { units: "Hz" });
    // Non-null by construction: exactly one of the two above exists.
    this.sampleRateProperty = providedSampleRateProperty ?? (this.ownedSampleRateProperty as NumberProperty);
    this.range = providedOptions?.range ?? null;
    this.streamingEnabled = providedOptions?.streamingEnabled !== false;
    this.usbProbeOnly = providedOptions?.usbProbeOnly === true;
    this.usbAcceptAllDevices = providedOptions?.usbAcceptAllDevices === true;
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

    // A rate the student can change while a run is in flight has to take effect
    // in that run; re-timing is a stop and a start, both of which are cheap and
    // idempotent, and the trace keeps its own clock either way.
    this.handleSampleRateChange = () => {
      if (this.samplingRequested) {
        this.stopSampling();
        this.startSampling();
      }
    };
    this.sampleRateProperty.lazyLink(this.handleSampleRateChange);
  }

  public get positionProperty(): TReadOnlyProperty<number> {
    return this.sensorPositionProperty;
  }

  public get isAvailableProperty(): TReadOnlyProperty<boolean> {
    return this.availableProperty;
  }

  /**
   * Opens the browser's device picker for the given transport and connects.
   * Never rejects.
   *
   * The transport is an argument rather than a constructor option because the
   * panel offers both and the student picks one at the moment of connecting.
   * The device picker is invoked before the first await so the browser still
   * recognizes the Connect button's user gesture.
   */
  public async connect(transport: SensorTransportValue = SensorTransport.BLUETOOTH): Promise<void> {
    if (this.connectionStateProperty.value === ConnectionState.CONNECTING) {
      return;
    }

    this.connectionStateProperty.value = ConnectionState.CONNECTING;
    this.errorMessageProperty.value = null;

    const device: TMotionSensorDevice =
      transport === SensorTransport.USB
        ? new UsbMotionSensor(this.handleUnexpectedDisconnect, {
            probeOnly: this.usbProbeOnly,
            acceptAllDevices: this.usbAcceptAllDevices,
            logDetails: this.diagnosticsEnabledProperty?.value === true,
          })
        : new BluetoothMotionSensor(this.handleUnexpectedDisconnect);
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

    if (this.usbProbeOnly) {
      // The whole point of a probe is that the device is left untouched.
      this.diagnosticsProperty.value = device.diagnosticText ?? "probe complete";
      return;
    }

    // Neither settings command is worth failing a connection over: the sensor
    // measures fine on its power-up defaults, and one that ignores a command
    // simply keeps them. Diagnostics say so; the student sees nothing.
    if (this.range !== null) {
      try {
        await device.setRange(this.range);
      } catch {
        this.diagnosticsProperty.value = "range unchanged";
      }
    }
    // The sample period is not sent here: it is an argument to starting the
    // stream, and a run is what starts one. See `startSampling`.
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

  /** The sample period the preference asks for, in milliseconds. */
  private get samplePeriodMs(): number {
    return 1000 / this.sampleRateProperty.value;
  }

  public startSampling(): void {
    if (this.samplingRequested || this.usbProbeOnly) {
      return;
    }
    this.samplingRequested = true;
    this.diagnosticsStartTimeMs = performance.now();

    // Streaming lets the device keep time, which removes the round-trip jitter
    // a poll cannot avoid. It needs a transport that can carry the stream;
    // anything else polls, which always works.
    const device = this.device;
    if (this.streamingEnabled && device?.startStreaming) {
      this.isStreaming = true;
      this.samplesSinceStreamStart = 0;
      // A device can accept the start command and then push nothing — the one
      // failure a stream cannot report, because there is no round trip left to
      // fail. Without this the run would record a flat trace and say why
      // nowhere, so silence is given a deadline and answered by polling.
      this.streamWatchdogId = setTimeout(() => {
        this.streamWatchdogId = null;
        if (this.samplingRequested && this.isStreaming && this.samplesSinceStreamStart === 0) {
          this.diagnosticsProperty.value = "stream silent; polling instead";
          this.isStreaming = false;
          device.stopStreaming?.().catch(() => undefined);
          this.startPolling();
        }
      }, STREAM_SILENCE_TIMEOUT_MS);
      device
        .startStreaming(this.samplePeriodMs, (echoTimeMicroseconds) => {
          this.acceptReading(echoTimeMicroseconds);
        })
        .catch((error: unknown) => {
          // A device that will not stream still answers single reads, so the
          // run carries on polling rather than recording nothing at all. Unless
          // the run ended while the refusal was in flight, in which case the
          // request is gone and starting a timer now would outlive it.
          this.isStreaming = false;
          this.diagnosticsProperty.value = `streaming refused: ${error instanceof Error ? error.message : error}`;
          if (this.samplingRequested) {
            this.startPolling();
          }
        });
      return;
    }

    this.startPolling();
  }

  private startPolling(): void {
    if (this.pollTimerId !== null) {
      return;
    }
    const generation = ++this.pollingGeneration;
    this.poll(generation).catch(() => undefined);
    this.pollTimerId = setInterval(() => {
      this.poll(generation).catch(() => undefined);
    }, this.samplePeriodMs);
  }

  public stopSampling(): void {
    this.samplingRequested = false;
    this.pollingGeneration += 1;
    if (this.streamWatchdogId !== null) {
      clearTimeout(this.streamWatchdogId);
      this.streamWatchdogId = null;
    }
    if (this.pollTimerId !== null) {
      clearInterval(this.pollTimerId);
      this.pollTimerId = null;
    }
    this.isPolling = false;
    this.isStreaming = false;
    // Asked for unconditionally, not just when this class believes it is
    // streaming. A streaming device keeps its own clock: if the stop is missed
    // it goes on ranging for as long as it has power, which is the one failure
    // here that outlives the run. `stopStreaming` knows whether it is owed.
    this.device?.stopStreaming?.().catch(() => undefined);
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
      this.acceptReading(echoTimeMicroseconds);
    } catch (error) {
      if (generation !== this.pollingGeneration) {
        return;
      }
      this.consecutiveFailures += 1;
      if (this.diagnosticsEnabledProperty?.value === true) {
        // biome-ignore lint/suspicious/noConsole: Explicit hardware bring-up diagnostics.
        console.warn("[MotionMatch sensor] read failed", error, device.diagnosticText ?? "");
      }
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

  /** One reading, however it arrived — polled round trip or pushed by the device. */
  private acceptReading(echoTimeMicroseconds: number): void {
    const metres = echoTimeToMetres(echoTimeMicroseconds);
    this.diagnosticsProperty.value = `${POSITION_MEASUREMENT}=${metres}`;

    if (this.diagnosticsEnabledProperty?.value === true) {
      const elapsedSeconds = (performance.now() - this.diagnosticsStartTimeMs) / 1000;
      // biome-ignore lint/suspicious/noConsole: Explicit hardware bring-up diagnostics.
      console.info(`[MotionMatch sensor +${elapsedSeconds.toFixed(3)} s]`, {
        EchoTimeMicroseconds: echoTimeMicroseconds,
        Position: metres,
        ...(this.device?.diagnosticText ? { RawTransfer: this.device.diagnosticText } : {}),
      });
    }

    this.consecutiveFailures = 0;
    this.samplesSinceStreamStart += 1;
    if (Number.isFinite(metres)) {
      // Out-of-range echoes read as wild distances; clamping keeps the walker
      // on the track and the trace on the chart instead of flinging both.
      this.sensorPositionProperty.value = POSITION_RANGE_M.constrainValue(metres);
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
    if (this.sampleRateProperty.hasListener(this.handleSampleRateChange)) {
      this.sampleRateProperty.unlink(this.handleSampleRateChange);
    }
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
    this.ownedSampleRateProperty?.dispose();
  }
}

MotionMatchNamespace.register("MotionSensorSource", MotionSensorSource);
