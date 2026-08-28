/** Narrow Web Bluetooth client for the PASCO Wireless Motion Sensor PS-3219. */

import {
  decodeMotionNotification,
  keepaliveCommand,
  MOTION_SENSOR_ADVERTISED_NAME,
  MOTION_SENSOR_OPTIONAL_SERVICE_UUIDS,
  MOTION_SENSOR_SERVICE_ID,
  PASCO_CHARACTERISTIC,
  PASCO_DEVICE_SERVICE_ID,
  pascoUuid,
  readMotionSampleCommand,
} from "./PascoMotionProtocol.js";

const READ_TIMEOUT_MS = 2000;

export class DeviceSelectionCancelled extends Error {}

export class BluetoothMotionSensor {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private sensorCommandCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private deviceCommandCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private pendingRead: ((echoTimeMicroseconds: number) => void) | null = null;

  private readonly onUnexpectedDisconnect: () => void;
  private readonly handleDisconnect: () => void;
  private readonly handleNotification: (event: Event) => void;

  public constructor(onUnexpectedDisconnect: () => void) {
    this.onUnexpectedDisconnect = onUnexpectedDisconnect;
    this.handleDisconnect = () => {
      this.clearConnectionState();
      this.onUnexpectedDisconnect();
    };
    this.handleNotification = (event: Event) => {
      const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
      if (!value) {
        return;
      }
      const packet = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      const echoTimeMicroseconds = decodeMotionNotification(packet);
      if (echoTimeMicroseconds !== null && this.pendingRead) {
        const resolve = this.pendingRead;
        this.pendingRead = null;
        resolve(echoTimeMicroseconds);
      }
    };
  }

  public get isConnected(): boolean {
    return this.server?.connected === true;
  }

  public get name(): string | null {
    return this.device?.name ?? null;
  }

  /** Opens the picker, subscribes on device service 0, then wakes the sensor. */
  public async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth is not available in this browser");
    }

    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: MOTION_SENSOR_ADVERTISED_NAME }],
        optionalServices: [...MOTION_SENSOR_OPTIONAL_SERVICE_UUIDS],
      });
    } catch (error) {
      if (error instanceof Error && error.name === "NotFoundError") {
        throw new DeviceSelectionCancelled();
      }
      throw error;
    }

    this.device = device;
    device.addEventListener("gattserverdisconnected", this.handleDisconnect);
    const server = await device.gatt?.connect();
    if (!server) {
      throw new Error("Could not reach the motion sensor's GATT server");
    }
    this.server = server;

    const sensorService = await server.getPrimaryService(
      pascoUuid(MOTION_SENSOR_SERVICE_ID, PASCO_CHARACTERISTIC.SERVICE),
    );
    this.sensorCommandCharacteristic = await sensorService.getCharacteristic(
      pascoUuid(MOTION_SENSOR_SERVICE_ID, PASCO_CHARACTERISTIC.SEND_COMMAND),
    );

    // PASCO's one-shot command goes to sensor service 1, but its result is
    // delivered on device service 0. Listening on service 1 produces silence.
    const deviceService = await server.getPrimaryService(
      pascoUuid(PASCO_DEVICE_SERVICE_ID, PASCO_CHARACTERISTIC.SERVICE),
    );
    this.deviceCommandCharacteristic = await deviceService.getCharacteristic(
      pascoUuid(PASCO_DEVICE_SERVICE_ID, PASCO_CHARACTERISTIC.SEND_COMMAND),
    );
    this.notifyCharacteristic = await deviceService.getCharacteristic(
      pascoUuid(PASCO_DEVICE_SERVICE_ID, PASCO_CHARACTERISTIC.RECEIVE),
    );
    this.notifyCharacteristic.addEventListener("characteristicvaluechanged", this.handleNotification);
    await this.notifyCharacteristic.startNotifications();
    await this.write(this.deviceCommandCharacteristic, keepaliveCommand());
  }

  public async readEchoTime(): Promise<number> {
    if (!(this.sensorCommandCharacteristic && this.isConnected)) {
      throw new Error("Motion sensor is not connected");
    }
    if (this.pendingRead) {
      throw new Error("A motion-sensor read is already in progress");
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const sample = new Promise<number>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        this.pendingRead = null;
        reject(new Error("Timed out waiting for a motion-sensor sample"));
      }, READ_TIMEOUT_MS);
      this.pendingRead = (echoTimeMicroseconds) => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        resolve(echoTimeMicroseconds);
      };
    });

    try {
      await this.write(this.sensorCommandCharacteristic, readMotionSampleCommand());
      return await sample;
    } catch (error) {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      this.pendingRead = null;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    const device = this.device;
    const notify = this.notifyCharacteristic;
    device?.removeEventListener("gattserverdisconnected", this.handleDisconnect);
    notify?.removeEventListener("characteristicvaluechanged", this.handleNotification);
    if (notify && this.isConnected) {
      try {
        await notify.stopNotifications();
      } catch {
        // The device may already be gone.
      }
    }
    if (this.server?.connected) {
      this.server.disconnect();
    }
    this.pendingRead = null;
    this.clearConnectionState();
    this.device = null;
  }

  private async write(characteristic: BluetoothRemoteGATTCharacteristic | null, command: ArrayBuffer): Promise<void> {
    if (!(characteristic && this.isConnected)) {
      throw new Error("Motion sensor is not connected");
    }
    await characteristic.writeValueWithoutResponse(command);
  }

  private clearConnectionState(): void {
    this.server = null;
    this.sensorCommandCharacteristic = null;
    this.deviceCommandCharacteristic = null;
    this.notifyCharacteristic = null;
    this.pendingRead = null;
  }
}
