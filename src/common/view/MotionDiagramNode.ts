/** Equal-time position dots that make changes in speed visible spatially. */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Circle, Line, Node, Rectangle, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";
import MotionMatchColors from "../../MotionMatchColors.js";
import { SAMPLE_PERIOD_S } from "../../MotionMatchConstants.js";
import type { MotionMatchModel } from "../model/MotionMatchModel.js";
import { LinearTransform } from "./LinearTransform.js";

const HEIGHT = 58;
const EDGE_INSET = 26;
const DOT_PERIOD_S = 0.5;
const SAMPLES_PER_DOT = Math.round(DOT_PERIOD_S / SAMPLE_PERIOD_S);

export class MotionDiagramNode extends Node {
  private readonly disposeMotionDiagramNode: () => void;

  public constructor(model: MotionMatchModel, width: number, visibleProperty: TReadOnlyProperty<boolean>) {
    super({ visibleProperty: visibleProperty });

    const transform = new LinearTransform(width, EDGE_INSET);
    const dots = new Node();
    const baselineY = 39;

    this.children = [
      new Rectangle(0, 0, width, HEIGHT, 6, 6, { fill: MotionMatchColors.trackColorProperty }),
      new Text(StringManager.getInstance().getMotionDiagramStringProperty(), {
        font: new PhetFont(11),
        fill: MotionMatchColors.textColorProperty,
        left: 10,
        top: 5,
      }),
      new Line(EDGE_INSET, baselineY, width - EDGE_INSET, baselineY, {
        stroke: MotionMatchColors.trackMarkColorProperty,
        lineWidth: 1,
      }),
      dots,
    ];

    let dotCount = 0;
    const updateDots = () => {
      const samples = model.getPositionTraceSamples().filter((_sample, index) => index % SAMPLES_PER_DOT === 0);
      if (samples.length < dotCount) {
        const oldDots = [...dots.children];
        dots.removeAllChildren();
        for (const dot of oldDots) {
          dot.dispose();
        }
        dotCount = 0;
      }
      for (let i = dotCount; i < samples.length; i++) {
        const sample = samples[i];
        if (sample !== undefined) {
          dots.addChild(
            new Circle(4.5, {
              centerX: transform.modelToViewX(sample.value),
              centerY: baselineY,
              fill: MotionMatchColors.traceColorProperty,
              stroke: MotionMatchColors.chartBackgroundColorProperty,
              lineWidth: 1,
            }),
          );
        }
      }
      dotCount = samples.length;
    };
    model.traceChangedProperty.link(updateDots);

    this.disposeMotionDiagramNode = () => {
      model.traceChangedProperty.unlink(updateDots);
    };
  }

  public override dispose(): void {
    this.disposeMotionDiagramNode();
    super.dispose();
  }
}
