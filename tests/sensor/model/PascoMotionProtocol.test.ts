import { describe, expect, it } from "vitest";
import {
  decodeMotionNotification,
  echoTimeToMetres,
  MOTION_SENSOR_OPTIONAL_SERVICE_UUIDS,
  pascoUuid,
  readMotionSampleCommand,
} from "../../../src/sensor/model/PascoMotionProtocol.js";

describe("PASCO motion-sensor protocol", () => {
  it("builds device and sensor GATT UUIDs", () => {
    expect(pascoUuid(0, 3)).toBe("4a5c0000-0003-0000-0000-5c1e741f1c00");
    expect(pascoUuid(1, 2)).toBe("4a5c0001-0002-0000-0000-5c1e741f1c00");
    expect(MOTION_SENSOR_OPTIONAL_SERVICE_UUIDS).toHaveLength(2);
  });

  it("requests the PS-3219 two-byte sample", () => {
    expect(Array.from(new Uint8Array(readMotionSampleCommand()))).toEqual([0x05, 0x02]);
  });

  it("decodes a successful service-0 response little-endian", () => {
    expect(decodeMotionNotification(new Uint8Array([0xc0, 0x00, 0x05, 0x88, 0x13]))).toBe(5000);
  });

  it("rejects unrelated, failed, and short notifications", () => {
    expect(decodeMotionNotification(new Uint8Array([0x03, 0x88, 0x13]))).toBeNull();
    expect(decodeMotionNotification(new Uint8Array([0xc0, 0x01, 0x05, 0x88, 0x13]))).toBeNull();
    expect(decodeMotionNotification(new Uint8Array([0xc0, 0x00, 0x05, 0x88]))).toBeNull();
  });

  it("converts ultrasonic round-trip time to metres", () => {
    expect(echoTimeToMetres(5000)).toBeCloseTo(0.86, 10);
  });
});
