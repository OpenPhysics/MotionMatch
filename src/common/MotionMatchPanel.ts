/**
 * MotionMatchPanel.ts
 *
 * A pre-themed Panel that automatically uses MotionMatchColors for background and
 * border. Use this for all control panels and info boxes in the sim so that
 * default / projector mode switching is handled automatically.
 *
 * ── Basic usage ───────────────────────────────────────────────────────────────
 *
 *   import { MotionMatchPanel } from "../../common/MotionMatchPanel.js";
 *   import { VBox, Text } from "scenerystack/scenery";
 *
 *   const content = new VBox({
 *     children: [ new Text("label"), slider ],
 *     spacing: 8,
 *   });
 *   const panel = new MotionMatchPanel(content);
 *
 * ── Overriding defaults ───────────────────────────────────────────────────────
 *
 *   // Wider margins, sharper corners, custom stroke
 *   const panel = new MotionMatchPanel(content, { xMargin: 20, cornerRadius: 0 });
 *
 *   // Transparent background (decorative border only)
 *   const panel = new MotionMatchPanel(content, { fill: "transparent" });
 */

import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { Node } from "scenerystack/scenery";
import { Panel, type PanelOptions } from "scenerystack/sun";
import MotionMatchColors from "../MotionMatchColors.js";
import { PANEL_CORNER_RADIUS } from "../MotionMatchConstants.js";

export type MotionMatchPanelOptions = PanelOptions;

export class MotionMatchPanel extends Panel {
  public constructor(content: Node, providedOptions?: MotionMatchPanelOptions) {
    const options = optionize<MotionMatchPanelOptions, EmptySelfOptions, PanelOptions>()(
      {
        fill: MotionMatchColors.panelBackgroundColorProperty,
        stroke: MotionMatchColors.panelBorderColorProperty,
        cornerRadius: PANEL_CORNER_RADIUS,
        xMargin: 12,
        yMargin: 10,
      },
      providedOptions,
    );
    super(content, options);
  }
}
