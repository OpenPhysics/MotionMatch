/**
 * SensorPanel.ts
 *
 * The Motion Sensor screen's connection control: status, Connect / Disconnect, and
 * whatever went wrong.
 *
 * ── Two rules carried over from RadioactivityAndStatistics ────────────────────
 * 1. The status is a coloured dot **and** a text label. Colour alone never
 *    carries the meaning.
 * 2. When Web Bluetooth is unavailable there is **no** Connect button, rather
 *    than a disabled one — with a sentence saying why and what to do instead.
 *    A greyed-out button invites clicking and explains nothing.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { DerivedProperty, PatternStringProperty } from "scenerystack/axon";
import { Circle, HBox, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { RectangularPushButton } from "scenerystack/sun";
import { FLAT_PANEL_PUSH_BUTTON_OPTIONS, LIGHT_SURFACE_TEXT_FILL } from "../../common/MotionMatchButtonOptions.js";
import { MotionMatchPanel } from "../../common/MotionMatchPanel.js";
import type { SensorA11yStrings } from "../../i18n/StringManager.js";
import { StringManager } from "../../i18n/StringManager.js";
import MotionMatchColors from "../../MotionMatchColors.js";
import { CONTROL_PANEL_WIDTH } from "../../MotionMatchConstants.js";
import { BluetoothStatus, getBluetoothStatus } from "../model/bluetoothSupport.js";
import { ConnectionState } from "../model/ConnectionState.js";
import type { MotionSensorSource } from "../model/MotionSensorSource.js";

const LABEL_FONT = new PhetFont(13);
const MESSAGE_FONT = new PhetFont(12);

export type SensorPanelOptions = {
  readonly source: MotionSensorSource;
  readonly a11y: SensorA11yStrings;
  /** Whether to show the raw reading; from Preferences → Simulation. */
  readonly showDiagnosticsProperty: TReadOnlyProperty<boolean>;
};

export class SensorPanel extends MotionMatchPanel {
  /** Null when Web Bluetooth is unavailable, so there is nothing to focus. */
  public readonly connectButton: RectangularPushButton | null;
  public readonly disconnectButton: RectangularPushButton;

  private readonly disposeSensorPanel: () => void;

  public constructor(providedOptions: SensorPanelOptions) {
    const source = providedOptions.source;
    const a11y = providedOptions.a11y;
    const strings = StringManager.getInstance();
    const sensorStrings = strings.getSensorStrings();

    const status = getBluetoothStatus();
    const bluetoothAvailable = status === BluetoothStatus.AVAILABLE;

    const statusTextProperty = new DerivedProperty(
      [
        source.connectionStateProperty,
        sensorStrings.statusDisconnectedStringProperty,
        sensorStrings.statusConnectingStringProperty,
        sensorStrings.statusConnectedStringProperty,
        sensorStrings.statusErrorStringProperty,
      ],
      (state, disconnected, connecting, connected, errored) => {
        switch (state) {
          case ConnectionState.CONNECTING:
            return connecting;
          case ConnectionState.CONNECTED:
            return connected;
          case ConnectionState.ERROR:
            return errored;
          default:
            return disconnected;
        }
      },
    );

    const statusColorProperty = new DerivedProperty([source.connectionStateProperty], (state) => {
      switch (state) {
        case ConnectionState.CONNECTING:
          return MotionMatchColors.statusConnectingColorProperty.value;
        case ConnectionState.CONNECTED:
          return MotionMatchColors.statusConnectedColorProperty.value;
        case ConnectionState.ERROR:
          return MotionMatchColors.statusErrorColorProperty.value;
        default:
          return MotionMatchColors.statusDisconnectedColorProperty.value;
      }
    });

    const statusDot = new Circle(5, { fill: statusColorProperty });
    const statusRow = new HBox({
      spacing: 8,
      children: [
        statusDot,
        new Text(statusTextProperty, {
          font: LABEL_FONT,
          fill: MotionMatchColors.textColorProperty,
          maxWidth: CONTROL_PANEL_WIDTH - 60,
        }),
      ],
    });

    const isDisconnectedProperty = new DerivedProperty(
      [source.connectionStateProperty],
      (state) => state !== ConnectionState.CONNECTED,
    );
    const isConnectedProperty = new DerivedProperty(
      [source.connectionStateProperty],
      (state) => state === ConnectionState.CONNECTED,
    );

    const connectButton = bluetoothAvailable
      ? new RectangularPushButton({
          ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
          content: new Text(sensorStrings.connectStringProperty, {
            font: LABEL_FONT,
            fill: LIGHT_SURFACE_TEXT_FILL,
          }),
          // Deliberately not async: the browser must still see this call stack
          // as part of the user gesture, and connect() reports failure through
          // Properties rather than by rejecting.
          listener: () => {
            source.connect().catch(() => undefined);
          },
          accessibleName: a11y.controls.connectButtonStringProperty,
          visibleProperty: isDisconnectedProperty,
        })
      : null;

    const disconnectButton = new RectangularPushButton({
      ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
      content: new Text(sensorStrings.disconnectStringProperty, {
        font: LABEL_FONT,
        fill: LIGHT_SURFACE_TEXT_FILL,
      }),
      listener: () => {
        source.disconnect().catch(() => undefined);
      },
      accessibleName: a11y.controls.disconnectButtonStringProperty,
      visibleProperty: isConnectedProperty,
    });

    const deviceNameProperty = new DerivedProperty([source.deviceNameProperty], (name) => name ?? "");
    const hasDeviceNameProperty = new DerivedProperty([source.deviceNameProperty], (name) => name !== null);
    const deviceNameText = new Text(deviceNameProperty, {
      font: MESSAGE_FONT,
      fill: MotionMatchColors.textColorProperty,
      visibleProperty: hasDeviceNameProperty,
      maxWidth: CONTROL_PANEL_WIDTH - 40,
    });

    // The library's own error text is English and often a raw DOMException
    // message; the one failure students actually hit — the sensor going away —
    // gets a localized sentence instead.
    const errorTextProperty = new DerivedProperty(
      [source.errorMessageProperty, sensorStrings.lostConnectionStringProperty],
      (message, lost) => (message === null ? "" : message === "disconnected" ? lost : message),
    );
    const hasErrorProperty = new DerivedProperty([source.errorMessageProperty], (message) => message !== null);
    const errorText = new Text(errorTextProperty, {
      font: MESSAGE_FONT,
      fill: MotionMatchColors.statusErrorColorProperty,
      visibleProperty: hasErrorProperty,
      maxWidth: CONTROL_PANEL_WIDTH - 40,
    });

    const unavailableText = new Text(
      status === BluetoothStatus.INSECURE_CONTEXT
        ? sensorStrings.unavailableInsecureStringProperty
        : sensorStrings.unavailableBrowserStringProperty,
      {
        font: MESSAGE_FONT,
        fill: MotionMatchColors.textColorProperty,
        visible: !bluetoothAvailable,
        maxWidth: CONTROL_PANEL_WIDTH - 40,
      },
    );

    const rawPositionProperty = new PatternStringProperty(sensorStrings.rawPositionPatternStringProperty, {
      position: new DerivedProperty([source.sensorPositionProperty], (metres) => metres.toFixed(3)),
    });
    const diagnosticsText = new Text(rawPositionProperty, {
      font: MESSAGE_FONT,
      fill: MotionMatchColors.textColorProperty,
      visibleProperty: providedOptions.showDiagnosticsProperty,
      maxWidth: CONTROL_PANEL_WIDTH - 40,
    });

    // Verbatim device output, for telling a real zero reading (nothing in front
    // of the sensor) apart from a device that is answering nothing at all.
    const measurementListText = new Text(source.measurementListProperty, {
      font: MESSAGE_FONT,
      fill: MotionMatchColors.textColorProperty,
      visibleProperty: providedOptions.showDiagnosticsProperty,
      maxWidth: CONTROL_PANEL_WIDTH - 40,
    });
    const rawReadingText = new Text(source.diagnosticsProperty, {
      font: MESSAGE_FONT,
      fill: MotionMatchColors.textColorProperty,
      visibleProperty: providedOptions.showDiagnosticsProperty,
      maxWidth: CONTROL_PANEL_WIDTH - 40,
    });

    super(
      new VBox({
        align: "left",
        spacing: 8,
        preferredWidth: CONTROL_PANEL_WIDTH - 24,
        stretch: true,
        children: [
          statusRow,
          deviceNameText,
          ...(connectButton === null ? [] : [connectButton]),
          disconnectButton,
          unavailableText,
          errorText,
          diagnosticsText,
          measurementListText,
          rawReadingText,
        ],
      }),
      { minWidth: CONTROL_PANEL_WIDTH },
    );

    this.connectButton = connectButton;
    this.disconnectButton = disconnectButton;

    this.disposeSensorPanel = () => {
      for (const property of [
        statusTextProperty,
        statusColorProperty,
        isDisconnectedProperty,
        isConnectedProperty,
        deviceNameProperty,
        hasDeviceNameProperty,
        errorTextProperty,
        hasErrorProperty,
        rawPositionProperty,
      ]) {
        property.dispose();
      }
    };
  }

  public override dispose(): void {
    this.disposeSensorPanel();
    super.dispose();
  }
}
