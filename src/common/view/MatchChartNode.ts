/**
 * MatchChartNode.ts
 *
 * The graph: a fixed -3–10 s window showing an unscored preparation preview,
 * the target curve, the tolerance band, and the student's recorded trace.
 *
 * ── Why the band is drawn ─────────────────────────────────────────────────────
 * The score is the fraction of samples inside this band, so the band is not
 * decoration — it is the scoring rule made visible. A student who scores 62 can
 * point at the stretch of their trace that left the shaded region. Widening the
 * tolerance in Preferences visibly widens the band, rather than quietly
 * inflating the number.
 *
 * The time axis never scrolls: the whole target is on screen before the run
 * starts, because the student has to know where they are going before they set
 * off.
 */

import { Multilink, type TReadOnlyProperty } from "scenerystack/axon";
import {
  AxisLine,
  ChartRectangle,
  ChartTransform,
  GridLineSet,
  LinePlot,
  TickLabelSet,
  TickMarkSet,
} from "scenerystack/bamboo";
import { Range, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import { Circle, Node, Path, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";
import MotionMatchColors from "../../MotionMatchColors.js";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  COUNTDOWN_S,
  POSITION_RANGE_M,
  POSITION_TICK_SPACING_M,
  RUN_DURATION_S,
  TIME_TICK_SPACING_S,
  VELOCITY_RANGE_MPS,
  VELOCITY_TICK_SPACING_MPS,
} from "../../MotionMatchConstants.js";
import { GraphMode } from "../model/GraphMode.js";
import type { MotionMatchModel } from "../model/MotionMatchModel.js";

/** Pixel insets reserved for the tick labels around the plot rectangle. */
const LEFT_INSET = 44;
const BOTTOM_INSET = 36;
const TOP_INSET = 8;
const RIGHT_INSET = 10;

const TICK_LABEL_FONT = new PhetFont(11);
const AXIS_LABEL_FONT = new PhetFont(13);

/**
 * Points used to draw the target curve and the band. 200 over a 10 s window is
 * one point every 50 ms — the same rate the trace is sampled at, so the target
 * and a perfect trace are drawn with identical fidelity.
 */
const CURVE_SAMPLE_COUNT = 200;

export class MatchChartNode extends Node {
  private readonly model: MotionMatchModel;
  private readonly chartTransform: ChartTransform;
  private readonly targetPlot: LinePlot;
  private readonly tracePlot: LinePlot;
  private readonly bandPath: Path;
  private readonly yTickMarks: TickMarkSet;
  private readonly yTickLabels: TickLabelSet;
  private readonly yGridLines: GridLineSet;
  private readonly disposeMatchChartNode: () => void;

  public constructor(model: MotionMatchModel, showGraphPointsProperty: TReadOnlyProperty<boolean>) {
    super();
    this.model = model;

    const axes = StringManager.getInstance().getAxesStrings();

    const plotWidth = CHART_WIDTH - LEFT_INSET - RIGHT_INSET;
    const plotHeight = CHART_HEIGHT - TOP_INSET - BOTTOM_INSET;

    this.chartTransform = new ChartTransform({
      viewWidth: plotWidth,
      viewHeight: plotHeight,
      modelXRange: new Range(-COUNTDOWN_S, RUN_DURATION_S),
      modelYRange: POSITION_RANGE_M,
      // Bamboo's default puts +y downward in view space; a graph of position
      // needs larger values higher up.
      modelYRangeInverted: false,
    });

    const chartRectangle = new ChartRectangle(this.chartTransform, {
      fill: MotionMatchColors.chartBackgroundColorProperty,
      stroke: MotionMatchColors.chartBorderColorProperty,
      lineWidth: 1,
    });

    // Orientation.VERTICAL spaces marks along y, producing horizontal lines.
    this.yGridLines = new GridLineSet(this.chartTransform, Orientation.VERTICAL, POSITION_TICK_SPACING_M, {
      stroke: MotionMatchColors.chartGridColorProperty,
      lineWidth: 0.5,
    });
    const xGridLines = new GridLineSet(this.chartTransform, Orientation.HORIZONTAL, TIME_TICK_SPACING_S, {
      stroke: MotionMatchColors.chartGridColorProperty,
      lineWidth: 0.5,
    });

    this.yTickMarks = new TickMarkSet(this.chartTransform, Orientation.VERTICAL, POSITION_TICK_SPACING_M, {
      edge: "min",
      stroke: MotionMatchColors.chartBorderColorProperty,
    });
    this.yTickLabels = new TickLabelSet(this.chartTransform, Orientation.VERTICAL, POSITION_TICK_SPACING_M, {
      edge: "min",
      createLabel: (value: number) =>
        new Text(MatchChartNode.formatTick(value), {
          font: TICK_LABEL_FONT,
          fill: MotionMatchColors.textColorProperty,
        }),
    });
    const xTickMarks = new TickMarkSet(this.chartTransform, Orientation.HORIZONTAL, TIME_TICK_SPACING_S, {
      edge: "min",
      stroke: MotionMatchColors.chartBorderColorProperty,
    });
    const xTickLabels = new TickLabelSet(this.chartTransform, Orientation.HORIZONTAL, TIME_TICK_SPACING_S, {
      edge: "min",
      createLabel: (value: number) =>
        new Text(MatchChartNode.formatTick(value), {
          font: TICK_LABEL_FONT,
          fill: MotionMatchColors.textColorProperty,
        }),
    });

    // Only meaningful in velocity mode, where v = 0 sits inside the range and
    // separates "moving away" from "coming back". In position mode the line
    // would land on the bottom edge and say nothing, so it is hidden there.
    const zeroAxis = new AxisLine(this.chartTransform, Orientation.HORIZONTAL, {
      stroke: MotionMatchColors.chartBorderColorProperty,
      lineWidth: 1,
      visible: false,
    });

    this.bandPath = new Path(null, { fill: MotionMatchColors.toleranceBandColorProperty });

    this.targetPlot = new LinePlot(this.chartTransform, [], {
      stroke: MotionMatchColors.targetCurveColorProperty,
      lineWidth: 2.5,
      // Dashed as well as coloured, so the target stays distinguishable from
      // the student's trace without relying on colour.
      lineDash: [8, 5],
    });

    this.tracePlot = new LinePlot(this.chartTransform, [], {
      stroke: MotionMatchColors.traceColorProperty,
      lineWidth: 2.5,
    });

    const graphPoints = new Node({ visibleProperty: showGraphPointsProperty });

    const plotContainer = new Node({
      x: LEFT_INSET,
      y: TOP_INSET,
      children: [
        chartRectangle,
        xGridLines,
        this.yGridLines,
        zeroAxis,
        // Clipped so a trace that runs off the axis stops at the border instead
        // of drawing outside the chart and stretching the surrounding layout.
        new Node({
          clipArea: Shape.bounds(chartRectangle.bounds),
          children: [this.bandPath, this.targetPlot, this.tracePlot, graphPoints],
        }),
        this.yTickMarks,
        this.yTickLabels,
        xTickMarks,
        xTickLabels,
      ],
    });

    const xAxisLabel = new Text(axes.timeStringProperty, {
      font: AXIS_LABEL_FONT,
      fill: MotionMatchColors.textColorProperty,
    });
    const yAxisLabel = new Text(axes.positionStringProperty, {
      font: AXIS_LABEL_FONT,
      fill: MotionMatchColors.textColorProperty,
      rotation: -Math.PI / 2,
    });

    this.children = [plotContainer, xAxisLabel, yAxisLabel];

    // Axis labels follow their own text, which changes with locale and (for y)
    // with the graph mode, so reposition whenever their bounds change.
    const layOutLabels = () => {
      xAxisLabel.centerX = LEFT_INSET + plotWidth / 2;
      xAxisLabel.top = TOP_INSET + plotHeight + 18;
      yAxisLabel.centerY = TOP_INSET + plotHeight / 2;
      yAxisLabel.right = LEFT_INSET - 28;
    };
    xAxisLabel.boundsProperty.link(layOutLabels);
    yAxisLabel.boundsProperty.link(layOutLabels);

    let refreshGraphPoints: () => void = () => {
      // Installed below after the chart-mode listeners are configured.
    };

    // The y axis, the target and the band all follow the mode, and the target
    // also follows the profile. One multilink keeps them from drifting apart.
    const modeMultilink = Multilink.multilink([model.graphModeProperty, model.profileProperty], (mode) => {
      const isVelocity = mode === GraphMode.VELOCITY;
      this.chartTransform.setModelYRange(isVelocity ? VELOCITY_RANGE_MPS : POSITION_RANGE_M);

      const spacing = isVelocity ? VELOCITY_TICK_SPACING_MPS : POSITION_TICK_SPACING_M;
      this.yGridLines.setSpacing(spacing);
      this.yTickMarks.setSpacing(spacing);
      this.yTickLabels.setSpacing(spacing);

      zeroAxis.visible = isVelocity;
      yAxisLabel.stringProperty = isVelocity ? axes.velocityStringProperty : axes.positionStringProperty;

      this.updateTarget();
      this.updateTrace();
      refreshGraphPoints();
    });

    const traceListener = () => {
      this.updateTrace();
      refreshGraphPoints();
    };
    model.traceChangedProperty.link(traceListener);

    refreshGraphPoints = () => {
      graphPoints.removeAllChildren();
      // Match the motion diagram: one point per second (the model samples
      // every 0.05 s).
      const allSamples = [...model.getTraceSamples()];
      const lastSample = allSamples.at(-1);
      if (lastSample !== undefined && lastSample.time < RUN_DURATION_S) {
        allSamples.push({ time: RUN_DURATION_S, value: lastSample.value });
      }
      const samples = allSamples.filter((_sample, index) => index % 20 === 0);
      for (const [index, sample] of samples.entries()) {
        const point = this.chartTransform.modelToViewPosition(new Vector2(sample.time, sample.value));
        const color = `hsl(${(196 + index * 7) % 360}, 78%, 52%)`;
        graphPoints.addChild(
          new Circle(3.5, { center: point, fill: color, stroke: MotionMatchColors.chartBackgroundColorProperty }),
        );
      }
    };
    model.graphModeProperty.link(refreshGraphPoints);

    // Widening the tolerance in Preferences has to widen the band on screen, or
    // the drawn rule and the scoring rule would disagree.
    const toleranceListener = () => this.updateTarget();
    model.positionToleranceProperty?.link(toleranceListener);

    this.disposeMatchChartNode = () => {
      modeMultilink.dispose();
      model.traceChangedProperty.unlink(traceListener);
      model.positionToleranceProperty?.unlink(toleranceListener);
      model.graphModeProperty.unlink(refreshGraphPoints);
      xAxisLabel.boundsProperty.unlink(layOutLabels);
      yAxisLabel.boundsProperty.unlink(layOutLabels);
    };
  }

  /** Rebuilds the dashed target curve and the shaded tolerance band. */
  public updateTarget(): void {
    const target = this.model.getTargetFunction();
    const tolerance = this.model.getTolerance();

    const points: Vector2[] = [];
    const upper: Vector2[] = [];
    const lower: Vector2[] = [];

    for (let i = 0; i <= CURVE_SAMPLE_COUNT; i++) {
      const time = (RUN_DURATION_S * i) / CURVE_SAMPLE_COUNT;
      const value = target(time);
      points.push(new Vector2(time, value));
      upper.push(this.chartTransform.modelToViewPosition(new Vector2(time, value + tolerance)));
      lower.push(this.chartTransform.modelToViewPosition(new Vector2(time, value - tolerance)));
    }

    this.targetPlot.setDataSet(points);

    // The band is one closed ribbon: forward along the upper edge, back along
    // the lower one.
    const shape = new Shape();
    const first = upper[0];
    if (first !== undefined) {
      shape.moveToPoint(first);
      for (let i = 1; i < upper.length; i++) {
        const point = upper[i];
        if (point !== undefined) {
          shape.lineToPoint(point);
        }
      }
      for (let i = lower.length - 1; i >= 0; i--) {
        const point = lower[i];
        if (point !== undefined) {
          shape.lineToPoint(point);
        }
      }
      shape.close();
    }
    this.bandPath.shape = shape;
  }

  /** Redraws the student's trace from the model's current samples. */
  public updateTrace(): void {
    this.tracePlot.setDataSet(
      this.model.getDisplayTraceSamples().map((sample) => new Vector2(sample.time, sample.value)),
    );
  }

  /** Whole numbers without a decimal point, halves with one. */
  private static formatTick(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  public override dispose(): void {
    this.disposeMatchChartNode();
    super.dispose();
  }
}
