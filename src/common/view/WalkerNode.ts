/**
 * WalkerNode.ts
 *
 * The figure on the track. On the Simulation screen the student drags it; on
 * the Motion Sensor screen it follows the sensor and cannot be grabbed.
 *
 * Drawn rather than loaded from an image: the sim ships no art, so there is no
 * asset pipeline and no third-party licence to track, and the figure recolours
 * with the projector profile for free.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import { Circle, Node, Path } from "scenerystack/scenery";
import MotionMatchColors from "../../MotionMatchColors.js";
import { WALKER_HEIGHT } from "../../MotionMatchConstants.js";

/** Proportions of the figure, as fractions of WALKER_HEIGHT. */
const HEAD_RADIUS = 0.13;
const SHOULDER_Y = 0.3;
const HIP_Y = 0.62;
const ARM_SPAN = 0.16;
const LEG_SPAN = 0.15;

export type WalkerNodeOptions = {
  /** Accessible name for the figure. */
  readonly accessibleName: TReadOnlyProperty<string>;
  /** Accessible help text describing how (or whether) it moves. */
  readonly accessibleHelpText: TReadOnlyProperty<string>;
  /** True on the Simulation screen, where the figure is the input device. */
  readonly draggable: boolean;
  /** Hides the figure when there is no position to show it at. */
  readonly visibleProperty?: TReadOnlyProperty<boolean>;
};

export class WalkerNode extends Node {
  public constructor(providedOptions: WalkerNodeOptions) {
    const height = WALKER_HEIGHT;

    const head = new Circle(HEAD_RADIUS * height, {
      fill: MotionMatchColors.walkerColorProperty,
      centerY: HEAD_RADIUS * height,
    });

    // Body, arms and legs as one stroked path: a single Node to recolour, and
    // the joints line up by construction.
    const body = new Shape()
      .moveTo(0, SHOULDER_Y * height - 0.06 * height)
      .lineTo(0, HIP_Y * height)
      // arms
      .moveTo(-ARM_SPAN * height, SHOULDER_Y * height + 0.12 * height)
      .lineTo(0, SHOULDER_Y * height)
      .lineTo(ARM_SPAN * height, SHOULDER_Y * height + 0.12 * height)
      // legs
      .moveTo(-LEG_SPAN * height, height)
      .lineTo(0, HIP_Y * height)
      .lineTo(LEG_SPAN * height, height);

    const limbs = new Path(body, {
      stroke: MotionMatchColors.walkerColorProperty,
      lineWidth: 0.07 * height,
      lineCap: "round",
      lineJoin: "round",
    });

    super({
      children: [head, limbs],
      cursor: providedOptions.draggable ? "ew-resize" : null,
      // A plain Node needs to be told it is interactive; sun controls do this
      // for themselves, this one does not.
      ...(providedOptions.draggable ? { tagName: "div", focusable: true } : {}),
      accessibleName: providedOptions.accessibleName,
      accessibleHelpText: providedOptions.accessibleHelpText,
      ...(providedOptions.visibleProperty ? { visibleProperty: providedOptions.visibleProperty } : {}),
    });
  }
}
