/**
 * StringManager.ts
 *
 * Centralizes all localized string access for the simulation.
 *
 * Strings are loaded from JSON files per locale and wrapped in reactive
 * Property objects by SceneryStack. When the user switches language in the
 * Preferences dialog, all StringProperties update automatically.
 *
 * ── How to add a locale ───────────────────────────────────────────────────────
 * 1. Create src/i18n/strings_XX.json with the same keys as strings_en.json
 * 2. Import it below and add `XX: stringsXX` to the locale map
 * 3. Add "XX" to `availableLocales` in src/init.ts
 *
 * ── How to add a string ───────────────────────────────────────────────────────
 * 1. Add the key + English value to strings_en.json
 * 2. Add the same key + translated value to ALL other locale files
 *    (TypeScript will show an error here if any locale is missing a key)
 * 3. Expose the new StringProperty via a new getter method below
 */

import type { ReadOnlyProperty } from "scenerystack/axon";
import { LocalizedString } from "scenerystack/chipper";
import stringsEn from "./strings_en.json";
import stringsEs from "./strings_es.json";
import stringsFr from "./strings_fr.json";

// ── Compile-time key-parity check ─────────────────────────────────────────────
// English is the canonical shape; every other locale must match it exactly.
// TypeScript errors here if any locale file is missing (or adds) a key relative to
// English. Add one `satisfies` line per new locale so the check stays exhaustive.
// biome-ignore lint/complexity/noVoid: intentional compile-time type assertion
void (stringsFr satisfies typeof stringsEn);
// biome-ignore lint/complexity/noVoid: intentional compile-time type assertion
void (stringsEn satisfies typeof stringsFr);
// biome-ignore lint/complexity/noVoid: intentional compile-time type assertion
void (stringsEs satisfies typeof stringsEn);
// biome-ignore lint/complexity/noVoid: intentional compile-time type assertion
void (stringsEn satisfies typeof stringsEs);

// ── Build the reactive string property tree ───────────────────────────────────
const stringProperties = LocalizedString.getNestedStringProperties({
  en: stringsEn,
  fr: stringsFr,
  es: stringsEs,
});

/**
 * The a11y shape both screens share, and the only shape the shared ScreenView
 * needs. The Motion Sensor screen's block is a strict superset of the
 * Simulation screen's — same summary regions, same figure and control names,
 * plus connect/disconnect — so one type serves the shared view and each screen
 * reaches for its own extras separately.
 *
 * Keep in sync with the `a11y` key in `strings_en.json`; a rename that is not
 * mirrored here fails at the getter return rather than silently at runtime.
 */
export type ScreenA11yStrings = {
  readonly screenSummary: {
    readonly playAreaStringProperty: ReadOnlyProperty<string>;
    readonly controlAreaStringProperty: ReadOnlyProperty<string>;
    readonly interactionHintStringProperty: ReadOnlyProperty<string>;
  };
  readonly currentDetails: {
    readonly readyStringProperty: ReadOnlyProperty<string>;
    readonly countdownStringProperty: ReadOnlyProperty<string>;
    readonly recordingStringProperty: ReadOnlyProperty<string>;
    readonly scoredStringProperty: ReadOnlyProperty<string>;
    readonly waitingForSensorStringProperty: ReadOnlyProperty<string>;
  };
  readonly controls: {
    readonly walkerStringProperty: ReadOnlyProperty<string>;
    readonly walkerHelpStringProperty: ReadOnlyProperty<string>;
    readonly profileComboBoxStringProperty: ReadOnlyProperty<string>;
    readonly profileComboBoxHelpStringProperty: ReadOnlyProperty<string>;
    readonly graphModeRadioStringProperty: ReadOnlyProperty<string>;
    readonly startButtonStringProperty: ReadOnlyProperty<string>;
    readonly stopButtonStringProperty: ReadOnlyProperty<string>;
    readonly tryAgainButtonStringProperty: ReadOnlyProperty<string>;
  };
};

/** The Motion Sensor screen's block: the shared shape plus the link controls. */
export type SensorA11yStrings = ScreenA11yStrings & {
  readonly controls: {
    readonly connectButtonStringProperty: ReadOnlyProperty<string>;
    readonly disconnectButtonStringProperty: ReadOnlyProperty<string>;
  };
};

/**
 * StringManager is a singleton that provides typed access to all localized
 * strings. Use `StringManager.getInstance()` everywhere — never construct it
 * directly.
 */
export class StringManager {
  private static instance: StringManager | null = null;

  private constructor() {
    // Private — obtain via getInstance()
  }

  public static getInstance(): StringManager {
    if (StringManager.instance === null) {
      StringManager.instance = new StringManager();
    }
    return StringManager.instance;
  }

  /** The simulation title shown in the navigation bar and browser tab. */
  public getTitleStringProperty(): ReadOnlyProperty<string> {
    return stringProperties.titleStringProperty;
  }

  /** Screen name StringProperties used when constructing Screen instances. */
  public getScreenNames(): {
    readonly simulationStringProperty: ReadOnlyProperty<string>;
    readonly sensorStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      simulationStringProperty: stringProperties.screens.simulationStringProperty,
      sensorStringProperty: stringProperties.screens.sensorStringProperty,
    };
  }

  /** One-line description of each of the nine curves, keyed by profile id. */
  public getProfileDescriptions() {
    return stringProperties.profiles;
  }

  /** "{{letter}} — {{description}}", the label on a curve's combo-box item. */
  public getProfileLabelPatternProperty(): ReadOnlyProperty<string> {
    return stringProperties.profileLabelPatternStringProperty;
  }

  /** Heading above the curve chooser. */
  public getChooseCurveStringProperty(): ReadOnlyProperty<string> {
    return stringProperties.chooseCurveStringProperty;
  }

  /** Label for the optional equal-time-dot motion diagram. */
  public getMotionDiagramStringProperty(): ReadOnlyProperty<string> {
    return stringProperties.motionDiagramStringProperty;
  }

  /** Label for the per-screen motion-diagram checkbox. */
  public getShowMotionDiagramStringProperty(): ReadOnlyProperty<string> {
    return stringProperties.showMotionDiagramStringProperty;
  }

  /** Label for optional sample points overlaid on the graph. */
  public getShowGraphPointsStringProperty(): ReadOnlyProperty<string> {
    return stringProperties.showGraphPointsStringProperty;
  }

  /** Label for optional velocity arrows on motion-diagram points. */
  public getShowVelocityVectorsStringProperty(): ReadOnlyProperty<string> {
    return stringProperties.showVelocityVectorsStringProperty;
  }

  /** Labels for the Position / Velocity toggle. */
  public getGraphModeStrings() {
    return stringProperties.graphMode;
  }

  /** Axis titles, including units. */
  public getAxesStrings() {
    return stringProperties.axes;
  }

  /** Chart legend labels. */
  public getLegendStrings() {
    return stringProperties.legend;
  }

  /** Run-control labels and the score readout pattern. */
  public getRunStrings() {
    return stringProperties.run;
  }

  /** Connection status, buttons, and unavailable-browser messages. */
  public getSensorStrings() {
    return stringProperties.sensor;
  }

  /** Accessibility strings for the Simulation screen. */
  public getSimulationA11yStrings(): ScreenA11yStrings {
    return stringProperties.a11y.simulation;
  }

  /** Accessibility strings for the Motion Sensor screen. */
  public getMotionSensorA11yStrings(): SensorA11yStrings {
    return stringProperties.a11y.sensor;
  }

  /** Simulation-specific preference labels shown in Preferences → Simulation. */
  public getPreferences() {
    return stringProperties.preferences;
  }
}
