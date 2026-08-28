/**
 * MotionMatchColors.ts
 *
 * Defines all dynamic colors for the simulation using ProfileColorProperty.
 *
 * Each color has two profiles:
 *   - "default"   — used in standard (dark) mode
 *   - "projector" — used when the user enables Projector Mode in Preferences
 *
 * SceneryStack switches profiles automatically; no manual toggling is needed.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 * Import MotionMatchColors and pass properties directly to Node's fillProperty or
 * strokeProperty options:
 *
 *   import MotionMatchColors from "../../MotionMatchColors.js";
 *
 *   new Rectangle( 0, 0, 100, 50, {
 *     fillProperty: MotionMatchColors.backgroundColorProperty,
 *   });
 *
 * ── How to add a color ────────────────────────────────────────────────────────
 * Add a new ProfileColorProperty entry to the MotionMatchColors object below.
 * Always provide both "default" and "projector" values.
 */
import { ProfileColorProperty } from "scenerystack/scenery";
import MotionMatchNamespace from "./MotionMatchNamespace.js";

const MotionMatchColors = {
  /**
   * Background color for the simulation screen.
   * Deep navy in default mode; white in projector mode.
   */
  backgroundColorProperty: new ProfileColorProperty(MotionMatchNamespace, "background", {
    default: "#1a1a2e",
    projector: "#ffffff",
  }),

  /**
   * Primary accent color for highlights, selected items, and key UI elements.
   * Sky blue in default mode; dark navy in projector mode.
   */
  accentColorProperty: new ProfileColorProperty(MotionMatchNamespace, "accent", {
    default: "#4fc3f7",
    projector: "#1a1a2e",
  }),

  /**
   * Background fill for control panels and dialogs.
   * Deep blue in default mode; light gray in projector mode.
   */
  panelBackgroundColorProperty: new ProfileColorProperty(MotionMatchNamespace, "panelBackground", {
    default: "#16213e",
    projector: "#f5f5f5",
  }),

  /**
   * Border/stroke color for control panels and dialogs.
   * Teal-navy in default mode; medium gray in projector mode.
   */
  panelBorderColorProperty: new ProfileColorProperty(MotionMatchNamespace, "panelBorder", {
    default: "#0f3460",
    projector: "#999999",
  }),

  /**
   * Text color for labels, readouts, and general UI text.
   * Near-white in default mode; near-black in projector mode.
   */
  textColorProperty: new ProfileColorProperty(MotionMatchNamespace, "text", {
    default: "#e0e0e0",
    projector: "#1a1a1a",
  }),

  // ── Light control surfaces ───────────────────────────────────────────────────
  // White chrome (combo boxes, flat push buttons, editable input fields) stays light
  // in both profiles; its text stays dark. Same values in default and projector mode,
  // but defined here so every color lives in one themeable place.

  /** Fill of light control surfaces: combo-box button/list, editable input fields. */
  controlSurfaceColorProperty: new ProfileColorProperty(MotionMatchNamespace, "controlSurface", {
    default: "#ffffff",
    projector: "#ffffff",
  }),

  /** Fill of a disabled control surface (grayed-out editable input field). */
  controlSurfaceDisabledColorProperty: new ProfileColorProperty(MotionMatchNamespace, "controlSurfaceDisabled", {
    default: "#cccccc",
    projector: "#cccccc",
  }),

  /** Text on light control surfaces: combo items, flat-button labels, field values, preferences. */
  controlSurfaceTextColorProperty: new ProfileColorProperty(MotionMatchNamespace, "controlSurfaceText", {
    default: "#1a1a1a",
    projector: "#1a1a1a",
  }),

  // ── Match chart ──────────────────────────────────────────────────────────────

  /** The target curve the student is trying to match. Drawn dashed as well as coloured. */
  targetCurveColorProperty: new ProfileColorProperty(MotionMatchNamespace, "targetCurve", {
    default: "#ffd54f",
    projector: "#a1690b",
  }),

  /** Fill of the tolerance band drawn around the target curve. */
  toleranceBandColorProperty: new ProfileColorProperty(MotionMatchNamespace, "toleranceBand", {
    default: "rgba(255,213,79,0.16)",
    projector: "rgba(161,105,11,0.14)",
  }),

  /** The student's own recorded trace. */
  traceColorProperty: new ProfileColorProperty(MotionMatchNamespace, "trace", {
    default: "#4fc3f7",
    projector: "#0b5f8a",
  }),

  /** Chart plot-area fill. */
  chartBackgroundColorProperty: new ProfileColorProperty(MotionMatchNamespace, "chartBackground", {
    default: "#0d1b2a",
    projector: "#ffffff",
  }),

  /** Chart grid lines. */
  chartGridColorProperty: new ProfileColorProperty(MotionMatchNamespace, "chartGrid", {
    default: "#2a3f5f",
    projector: "#d5d5d5",
  }),

  /** Chart border, tick marks, and the v = 0 axis line. */
  chartBorderColorProperty: new ProfileColorProperty(MotionMatchNamespace, "chartBorder", {
    default: "#5a7fa8",
    projector: "#666666",
  }),

  // ── Play area ────────────────────────────────────────────────────────────────

  /** The strip the walker moves along. */
  trackColorProperty: new ProfileColorProperty(MotionMatchNamespace, "track", {
    default: "#22314a",
    projector: "#e8e8e8",
  }),

  /** Metre marks along the track. */
  trackMarkColorProperty: new ProfileColorProperty(MotionMatchNamespace, "trackMark", {
    default: "#5a7fa8",
    projector: "#8a8a8a",
  }),

  /** The walker figure. */
  walkerColorProperty: new ProfileColorProperty(MotionMatchNamespace, "walker", {
    default: "#4fc3f7",
    projector: "#0b5f8a",
  }),

  /** Body of the motion sensor drawn at the origin of the track. */
  sensorBodyColorProperty: new ProfileColorProperty(MotionMatchNamespace, "sensorBody", {
    default: "#8899aa",
    projector: "#555555",
  }),

  /** The sensor's ultrasound cone, shown while a run is recording. */
  sensorBeamColorProperty: new ProfileColorProperty(MotionMatchNamespace, "sensorBeam", {
    default: "rgba(79,195,247,0.14)",
    projector: "rgba(11,95,138,0.10)",
  }),

  // ── Connection status ────────────────────────────────────────────────────────
  // The status dot is always paired with a text label; colour never carries the
  // meaning on its own.

  /** Status dot while disconnected. */
  statusDisconnectedColorProperty: new ProfileColorProperty(MotionMatchNamespace, "statusDisconnected", {
    default: "#7a8794",
    projector: "#777777",
  }),

  /** Status dot while a connection is being negotiated. */
  statusConnectingColorProperty: new ProfileColorProperty(MotionMatchNamespace, "statusConnecting", {
    default: "#ffb74d",
    projector: "#b26a00",
  }),

  /** Status dot once the sensor is streaming. */
  statusConnectedColorProperty: new ProfileColorProperty(MotionMatchNamespace, "statusConnected", {
    default: "#66bb6a",
    projector: "#1b7d1f",
  }),

  /** Status dot and message text after a connection error. */
  statusErrorColorProperty: new ProfileColorProperty(MotionMatchNamespace, "statusError", {
    default: "#ef5350",
    projector: "#b71c1c",
  }),
};

export default MotionMatchColors;
