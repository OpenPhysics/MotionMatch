/**
 * ProfileControl.ts
 *
 * PASCO's "Choose Curve" control: which of the nine curves is the target, and
 * whether the student is matching position or velocity.
 *
 * These two choices are the sim's entire toolbar. Everything else PASCO's
 * MatchGraph offers — named users, saved high scores, exports — is deliberately
 * absent, so nothing sits between a student and the next attempt.
 */

import { DerivedProperty, PatternStringProperty, type Property, type TReadOnlyProperty } from "scenerystack/axon";
import { HBox, type Node, Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { ABSwitch, ComboBox } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { LIGHT_SURFACE_TEXT_FILL, MOTION_MATCH_COMBO_BOX_OPTIONS } from "../../common/MotionMatchButtonOptions.js";
import { MotionMatchPanel } from "../../common/MotionMatchPanel.js";
import { StringManager } from "../../i18n/StringManager.js";
import MotionMatchColors from "../../MotionMatchColors.js";
import { CONTROL_PANEL_WIDTH } from "../../MotionMatchConstants.js";
import { GraphMode, type GraphModeValue } from "../model/GraphMode.js";
import type { MotionProfile } from "../model/MotionProfile.js";
import { PROFILES } from "../model/profiles.js";
import { createProfileSparkline } from "./profileSparkline.js";

const LABEL_FONT = new PhetFont(13);

export type ProfileControlOptions = {
  readonly profileProperty: Property<MotionProfile>;
  readonly graphModeProperty: Property<GraphModeValue>;
  /** Node the combo box's popup list is added to — normally the ScreenView. */
  readonly listParent: Node;
  readonly comboBoxAccessibleName: TReadOnlyProperty<string>;
  readonly comboBoxAccessibleHelpText: TReadOnlyProperty<string>;
  readonly graphModeAccessibleName: TReadOnlyProperty<string>;
  readonly showMotionDescriptionsProperty: TReadOnlyProperty<boolean>;
};

export class ProfileControl extends MotionMatchPanel {
  /** Exposed so the ScreenView can order them in the PDOM. */
  public readonly comboBox: ComboBox<MotionProfile>;
  public readonly graphModeToggle: ABSwitch<GraphModeValue>;

  private readonly disposeProfileControl: () => void;

  public constructor(providedOptions: ProfileControlOptions) {
    const strings = StringManager.getInstance();
    const descriptions = strings.getProfileDescriptions();
    const modeStrings = strings.getGraphModeStrings();
    const labelPattern = strings.getProfileLabelPatternProperty();

    // One PatternStringProperty per curve, disposed with the control.
    const itemLabelProperties: { dispose(): void }[] = [];

    const comboBox = new ComboBox(
      providedOptions.profileProperty,
      PROFILES.map((profile) => {
        // LocalizedString suffixes every leaf key, so profile "a" is `aStringProperty`.
        const descriptionProperty = descriptions[`${profile.id}StringProperty` as keyof typeof descriptions];
        const labelProperty = new PatternStringProperty(labelPattern, {
          letter: profile.letter,
          description: descriptionProperty,
        });
        const visibleLabelProperty = new DerivedProperty(
          [labelProperty, providedOptions.showMotionDescriptionsProperty],
          (label, showDescriptions) => (showDescriptions ? label : profile.letter),
        );
        itemLabelProperties.push(labelProperty, visibleLabelProperty);

        return {
          value: profile,
          createNode: () =>
            new HBox({
              spacing: 10,
              children: [
                createProfileSparkline(profile),
                new Text(visibleLabelProperty, { font: LABEL_FONT, fill: LIGHT_SURFACE_TEXT_FILL, maxWidth: 240 }),
              ],
            }),
        };
      }),
      providedOptions.listParent,
      {
        ...MOTION_MATCH_COMBO_BOX_OPTIONS,
        accessibleName: providedOptions.comboBoxAccessibleName,
        accessibleHelpText: providedOptions.comboBoxAccessibleHelpText,
      },
    );

    const positionLabel = new Text(modeStrings.positionStringProperty, {
      font: LABEL_FONT,
      fill: MotionMatchColors.textColorProperty,
      maxWidth: 150,
    });
    const velocityLabel = new Text(modeStrings.velocityStringProperty, {
      font: LABEL_FONT,
      fill: MotionMatchColors.textColorProperty,
      maxWidth: 150,
    });
    const graphModeToggle = new ABSwitch(
      providedOptions.graphModeProperty,
      GraphMode.POSITION,
      positionLabel,
      GraphMode.VELOCITY,
      velocityLabel,
      {
        spacing: 10,
        accessibleHelpText: providedOptions.graphModeAccessibleName,
        tandem: Tandem.OPT_OUT,
      },
    );

    const title = new Text(strings.getChooseCurveStringProperty(), {
      font: new PhetFont({ size: 14, weight: "bold" }),
      fill: MotionMatchColors.textColorProperty,
      maxWidth: CONTROL_PANEL_WIDTH - 40,
    });

    super(
      new VBox({
        align: "left",
        spacing: 10,
        preferredWidth: CONTROL_PANEL_WIDTH - 24,
        stretch: true,
        children: [title, comboBox, graphModeToggle],
      }),
      { minWidth: CONTROL_PANEL_WIDTH },
    );

    this.comboBox = comboBox;
    this.graphModeToggle = graphModeToggle;

    this.disposeProfileControl = () => {
      for (const property of itemLabelProperties) {
        property.dispose();
      }
    };
  }

  public override dispose(): void {
    this.disposeProfileControl();
    super.dispose();
  }
}
