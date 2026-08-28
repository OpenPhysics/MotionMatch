/**
 * profileSparkline.ts
 *
 * A thumbnail of a profile's position curve, drawn on its item in the curve
 * chooser.
 *
 * The letters A–I mean nothing until you have used the sim for a while, and the
 * one-line descriptions all start to look alike in a list of nine. The shape is
 * what a student is actually choosing between, so the shape is on the button.
 *
 * Always the *position* curve, even when the student is matching velocity: it
 * is the shape the profile is named for, and switching the thumbnails when the
 * mode toggles would make the list feel like a different list.
 */

import { Shape } from "scenerystack/kite";
import { Path } from "scenerystack/scenery";
import MotionMatchColors from "../../MotionMatchColors.js";
import { POSITION_RANGE_M, RUN_DURATION_S, SPARKLINE_HEIGHT, SPARKLINE_WIDTH } from "../../MotionMatchConstants.js";
import type { MotionProfile } from "../model/MotionProfile.js";

/** Enough points that a sinusoid reads as a sinusoid at thumbnail size. */
const SAMPLE_COUNT = 40;

export function createProfileSparkline(profile: MotionProfile): Path {
  const shape = new Shape();

  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const time = (RUN_DURATION_S * i) / SAMPLE_COUNT;
    const x = (SPARKLINE_WIDTH * i) / SAMPLE_COUNT;
    // Position axis runs bottom-to-top, so invert for view coordinates.
    const fraction = (profile.position(time) - POSITION_RANGE_M.min) / POSITION_RANGE_M.getLength();
    const y = SPARKLINE_HEIGHT * (1 - fraction);
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }

  return new Path(shape, {
    stroke: MotionMatchColors.controlSurfaceTextColorProperty,
    lineWidth: 1.5,
    lineCap: "round",
    lineJoin: "round",
  });
}
