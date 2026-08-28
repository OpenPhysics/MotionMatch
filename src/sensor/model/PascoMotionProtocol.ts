/** Dependency-free PASCO wire protocol, scoped to the PS-3219 motion sensor. */

const UUID_PREFIX = "4a5c000";
const UUID_SUFFIX = "5c1e741f1c00";

export const PASCO_CHARACTERISTIC = {
  SERVICE: 0,
  SEND_COMMAND: 2,
  RECEIVE: 3,
} as const;

export const PASCO_DEVICE_SERVICE_ID = 0;
export const MOTION_SENSOR_SERVICE_ID = 1;
export const MOTION_SENSOR_SAMPLE_BYTES = 2;
export const MOTION_SENSOR_ADVERTISED_NAME = "Motion";
export const SPEED_OF_SOUND_MPS = 344;

const READ_ONE_SAMPLE = 0x05;
const RESULT = 0xc0;
const STATUS_OK = 0x00;

export function pascoUuid(serviceId: number, characteristicId: number): string {
  return `${UUID_PREFIX}${serviceId}-000${characteristicId}-0000-0000-${UUID_SUFFIX}`;
}

export const MOTION_SENSOR_OPTIONAL_SERVICE_UUIDS: readonly string[] = [
  PASCO_DEVICE_SERVICE_ID,
  MOTION_SENSOR_SERVICE_ID,
].map((serviceId) => pascoUuid(serviceId, PASCO_CHARACTERISTIC.SERVICE));

export function toCommandBuffer(bytes: readonly number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

/** Device-service keepalive sent after subscribing to notifications. */
export function keepaliveCommand(): ArrayBuffer {
  return toCommandBuffer([0x00]);
}

/** Channel 0 has one two-byte raw field: ultrasonic round-trip echo time. */
export function readMotionSampleCommand(): ArrayBuffer {
  return toCommandBuffer([READ_ONE_SAMPLE, MOTION_SENSOR_SAMPLE_BYTES]);
}

/** Decode [result, ok, read-one, echo-low, echo-high]. */
export function decodeMotionNotification(data: Uint8Array): number | null {
  if (
    data.length < 3 + MOTION_SENSOR_SAMPLE_BYTES ||
    data[0] !== RESULT ||
    data[1] !== STATUS_OK ||
    data[2] !== READ_ONE_SAMPLE
  ) {
    return null;
  }
  return (data[3] ?? 0) | ((data[4] ?? 0) << 8);
}

export function echoTimeToMetres(echoTimeMicroseconds: number): number {
  return (echoTimeMicroseconds / 1_000_000) * SPEED_OF_SOUND_MPS * 0.5;
}
