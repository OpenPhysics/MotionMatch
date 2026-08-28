/**
 * MotionMatchKeyboardHelpContent.ts
 *
 * The navigation-bar "?" dialog, shared by both screens.
 *
 * The walker is the sim's primary input on the Simulation screen, so the
 * move-the-walker section comes first; the standard Basic Actions section
 * covers Tab, buttons, and the combo box. Standard sections carry their own
 * translations, so this adds no new strings.
 */

import {
  BasicActionsKeyboardHelpSection,
  ComboBoxKeyboardHelpSection,
  MoveDraggableItemsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";

export class MotionMatchKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    super(
      [new MoveDraggableItemsKeyboardHelpSection(), new ComboBoxKeyboardHelpSection()],
      [new BasicActionsKeyboardHelpSection()],
    );
  }
}
