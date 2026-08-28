/**
 * LinearTransform.ts
 *
 * Maps the one dimension this sim has — distance from the sensor, in metres —
 * onto track pixels.
 *
 * ModelViewTransform2 would work, but it carries a 2-D affine matrix for a
 * problem with a single axis; a scale and an offset say what is actually going
 * on and keep the drag arithmetic readable.
 */

import { POSITION_RANGE_M } from "../../MotionMatchConstants.js";

export class LinearTransform {
  /** Track pixels per metre. */
  public readonly pixelsPerMetre: number;

  private readonly originX: number;

  /**
   * @param trackWidth - width of the track in pixels
   * @param edgeInset - pixels reserved at each end so the figure stays on track
   *                    is still fully drawn inside the track
   */
  public constructor(trackWidth: number, edgeInset = 0) {
    this.pixelsPerMetre = (trackWidth - 2 * edgeInset) / POSITION_RANGE_M.getLength();
    this.originX = edgeInset;
  }

  public modelToViewX(metres: number): number {
    return this.originX + (metres - POSITION_RANGE_M.min) * this.pixelsPerMetre;
  }

  public viewToModelX(viewX: number): number {
    return POSITION_RANGE_M.min + (viewX - this.originX) / this.pixelsPerMetre;
  }
}
