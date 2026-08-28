/**
 * bluetoothSupport.ts
 *
 * Whether this browser can talk to the sensor at all, reduced to something the
 * view can switch on.
 *
 * Detection is delegated to pasco-ble's `checkBrowserSupport()`; only the
 * classification lives here, so the sim can show its own localized message
 * rather than the library's English one.
 *
 * The result is memoized: it cannot change during a session, and the view asks
 * for it every time it rebuilds the sensor panel.
 */

import { checkBrowserSupport } from "pasco-ble";
import MotionMatchNamespace from "../../MotionMatchNamespace.js";

export const BluetoothStatus = {
  /** Web Bluetooth is present and the page is on a secure origin. */
  AVAILABLE: "available",
  /** Not a browser at all — a test runner or a server-side render. */
  NO_BROWSER: "noBrowser",
  /** The API exists but the page is plain HTTP, so it will refuse to open the picker. */
  INSECURE_CONTEXT: "insecureContext",
  /** Firefox, Safari, and anything else without Web Bluetooth. */
  UNSUPPORTED_BROWSER: "unsupportedBrowser",
} as const;

export type BluetoothStatusValue = (typeof BluetoothStatus)[keyof typeof BluetoothStatus];

let cachedStatus: BluetoothStatusValue | null = null;

export function getBluetoothStatus(): BluetoothStatusValue {
  if (cachedStatus !== null) {
    return cachedStatus;
  }

  if (typeof window === "undefined" || typeof navigator === "undefined") {
    cachedStatus = BluetoothStatus.NO_BROWSER;
    return cachedStatus;
  }

  const support = checkBrowserSupport();

  // Order matters: an insecure context is worth reporting separately because it
  // is the one failure the teacher can actually fix, by serving over HTTPS.
  cachedStatus = !support.secureContext
    ? BluetoothStatus.INSECURE_CONTEXT
    : support.supported
      ? BluetoothStatus.AVAILABLE
      : BluetoothStatus.UNSUPPORTED_BROWSER;

  return cachedStatus;
}

export function isBluetoothAvailable(): boolean {
  return getBluetoothStatus() === BluetoothStatus.AVAILABLE;
}

/** Clears the memo. Exists for unit tests, which vary the environment. */
export function clearBluetoothStatusCache(): void {
  cachedStatus = null;
}

MotionMatchNamespace.register("BluetoothStatus", BluetoothStatus);
