/**
 * MotionMatchConstants.ts
 *
 * Central repository for every named numeric constant used across the
 * simulation. Bare numbers that carry semantic meaning (sizes, margins,
 * physics defaults, ranges) belong here rather than inline in model or view
 * code, so they are named, documented, and changed in one place.
 *
 * Conventions
 * ───────────
 *  - Physics / model values use SI units (metres, seconds, kilograms, …);
 *    note the unit in a comment on each value.
 *  - Layout / chrome values are in screen pixels.
 *  - Colour strings live in MotionMatchColors.ts, not here.
 *  - Computed expressions (e.g. `2 * Math.PI`) may stay inline.
 */

import { Range } from "scenerystack/dot";
import MotionMatchNamespace from "./MotionMatchNamespace.js";

// ── Layout / chrome (screen pixels) ───────────────────────────────────────────

/** Margin between the screen edge and edge-anchored controls (e.g. Reset All). */
export const SCREEN_VIEW_MARGIN = 20;

/** Corner radius shared by control panels and dialogs. */
export const PANEL_CORNER_RADIUS = 6;

/** Plot area of the match chart, excluding axis labels and tick labels. */
export const CHART_WIDTH = 560;
export const CHART_HEIGHT = 300;

/** Width and height of the sparkline drawn on each profile's combo-box item. */
export const SPARKLINE_WIDTH = 46;
export const SPARKLINE_HEIGHT = 26;

/** Width of the control column on the right of both screens. */
export const CONTROL_PANEL_WIDTH = 384;

/** Height of the walking track strip in the play area. */
export const TRACK_HEIGHT = 108;

/** Height of the walker figure, in pixels. */
export const WALKER_HEIGHT = 72;

// ── The run (SI units) ────────────────────────────────────────────────────────

/**
 * Length of one matching run, in seconds. Also the full width of the chart's
 * time axis — the window is fixed, never scrolling, so the student can see the
 * whole target curve before they start.
 */
export const RUN_DURATION_S = 10;

/**
 * Seconds of 3-2-1 countdown between pressing Start and the first recorded
 * sample, matching MatchGraph's own lead-in.
 */
export const COUNTDOWN_S = 3;

/**
 * Trace sampling rate, in hertz. The model samples the active source on its own
 * fixed clock at this rate, so a run has the same number of points and the same
 * spacing whether it came from the pointer or from the sensor.
 */
export const SAMPLE_RATE_HZ = 20;

/** Derived from {@link SAMPLE_RATE_HZ}; the model's fixed timestep during a run. */
export const SAMPLE_PERIOD_S = 1 / SAMPLE_RATE_HZ;

/**
 * Number of samples in the centered window used to differentiate the position
 * trace into velocity. Must be odd. At 20 Hz, 5 samples spans ±0.1 s — short
 * enough to follow a real turnaround, long enough to suppress sensor jitter.
 */
export const DERIVATIVE_WINDOW_SAMPLES = 5;

// ── Axes (SI units) ───────────────────────────────────────────────────────────

/**
 * Position axis. The upper bound is the PS-3219's maximum range; every profile
 * stays inside 0.5–3.5 m so a student never walks into the 0.15 m dead zone or
 * off the far end.
 */
export const POSITION_RANGE_M = new Range(0, 4);

/** Velocity axis. The fastest profile peaks near 1.26 m/s, so ±1.5 covers all nine. */
export const VELOCITY_RANGE_MPS = new Range(-1.5, 1.5);

/** Closest distance the PASCO Wireless Motion Sensor (PS-3219) can resolve, in metres. */
export const SENSOR_MINIMUM_RANGE_M = 0.15;

/** Tick spacing on the two axes. */
export const TIME_TICK_SPACING_S = 1;
export const POSITION_TICK_SPACING_M = 0.5;
export const VELOCITY_TICK_SPACING_MPS = 0.5;

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Half-width of the position match band, in metres. A sample counts as matched
 * when it lies within this distance of the target curve.
 */
export const DEFAULT_POSITION_TOLERANCE_M = 0.25;

/**
 * Half-width of the velocity match band, in m/s. Wider than the position band
 * in proportional terms because velocity is differentiated from the position
 * trace and therefore noisier.
 */
export const DEFAULT_VELOCITY_TOLERANCE_MPS = 0.3;

/** Bounds accepted for the match-tolerance preference, in metres. */
export const POSITION_TOLERANCE_RANGE_M = new Range(0.1, 0.6);

// ── Profiles ──────────────────────────────────────────────────────────────────

/**
 * Width of the smoothstep blend applied across a velocity discontinuity, in
 * seconds. Profiles D, F and G are piecewise-linear in position, so their exact
 * derivative is a step; blending makes the velocity target continuous and
 * physically walkable. See doc/model.md.
 */
export const CORNER_SMOOTHING_S = 0.4;

// ── Sensor ────────────────────────────────────────────────────────────────────

/**
 * How often the Motion Sensor screen asks the device for a position, in
 * milliseconds. Faster than {@link SAMPLE_PERIOD_S} so a fresh reading is always
 * waiting when the model's fixed clock takes its sample.
 */
export const DEFAULT_POLL_INTERVAL_MS = 40;

/**
 * Consecutive failed reads tolerated before the source declares an error. A
 * single dropped BLE round trip is normal; ten in a row is not.
 */
export const MAXIMUM_CONSECUTIVE_FAILURES = 10;

/** Name prefix used to filter the Web Bluetooth device picker. */
export const MOTION_SENSOR_NAME_FILTER = "Motion";

/** Human-readable name of the position derived from the raw echo-time sample. */
export const POSITION_MEASUREMENT = "Position";

MotionMatchNamespace.register("MotionMatchConstants", {
  SCREEN_VIEW_MARGIN,
  PANEL_CORNER_RADIUS,
  CHART_WIDTH,
  CHART_HEIGHT,
  RUN_DURATION_S,
  COUNTDOWN_S,
  SAMPLE_RATE_HZ,
  SAMPLE_PERIOD_S,
  POSITION_RANGE_M,
  VELOCITY_RANGE_MPS,
  DEFAULT_POSITION_TOLERANCE_M,
  DEFAULT_VELOCITY_TOLERANCE_MPS,
  CORNER_SMOOTHING_S,
});
