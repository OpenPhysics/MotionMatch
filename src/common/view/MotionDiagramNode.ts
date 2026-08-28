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

  public constructor(
    model: MotionMatchModel,
    width: number,
    visibleProperty: TReadOnlyProperty<boolean>,
    showLabelsProperty: TReadOnlyProperty<boolean>,
  ) {
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
    let updateFrame: number | null = null;
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
          const dotX = transform.modelToViewX(sample.value);
          const dotAndLabel = new Node({
            children: [
              new Circle(4.5, {
                centerX: dotX,
                centerY: baselineY,
                // A gradual hue shift makes the passage of time visible even
                // when labels are hidden.
                fill: `hsl(${(196 + i * 7) % 360}, 78%, 52%)`,
                stroke: MotionMatchColors.chartBackgroundColorProperty,
                lineWidth: 1,
              }),
              new Text(`${Number(sample.time.toFixed(1))} s`, {
                font: new PhetFont(9),
                fill: MotionMatchColors.textColorProperty,
                centerX: dotX,
                bottom: baselineY - 6,
                visibleProperty: showLabelsProperty,
              }),
            ],
          });
          dots.addChild(dotAndLabel);
        }
      }
      dotCount = samples.length;
    };
    // Adding/removing scenery nodes can trigger bounds and visibility
    // notifications. Do that on the next animation frame instead of from
    // inside the model's traceChangedProperty notification, where synchronous
    // scene-graph work can cause a nested simulation step and reenter the
    // BooleanProperty notification.
    const scheduleUpdateDots = () => {
      if (updateFrame === null) {
        updateFrame = requestAnimationFrame(() => {
          updateFrame = null;
          updateDots();
        });
      }
    };
    model.traceChangedProperty.lazyLink(scheduleUpdateDots);
    updateDots();

    this.disposeMotionDiagramNode = () => {
      model.traceChangedProperty.unlink(scheduleUpdateDots);
      if (updateFrame !== null) {
        cancelAnimationFrame(updateFrame);
      }
    };
  }

  public override dispose(): void {
    this.disposeMotionDiagramNode();
    super.dispose();
  }
}
