/**
 * profiles.ts
 *
 * The nine target curves, lettered A–I after PASCO's own MatchGraph activity
 * sheet (012-14624B) so a class can work from the printed worksheet and the sim
 * interchangeably.
 *
 * All nine are defined over [0, RUN_DURATION_S] and stay within 0.25–1.75 m,
 * keeping the activity within a practical 2 m classroom walking area. The
 * fastest (I) peaks near 0.63 m/s.
 *
 * Equations and the pedagogy behind each shape are in doc/model.md.
 */

import { RUN_DURATION_S } from "../../MotionMatchConstants.js";
import { analyticShape, MotionProfile, piecewiseLinearShape } from "./MotionProfile.js";

/** A — a straight line with positive slope: walk away at a steady pace. */
const profileA = new MotionProfile(
  "a",
  "A",
  analyticShape(
    (t) => 0.25 + 0.15 * t,
    () => 0.15,
  ),
);

/** B — a straight line with negative slope: walk toward the sensor at a steady pace. */
const profileB = new MotionProfile(
  "b",
  "B",
  analyticShape(
    (t) => 1.75 - 0.15 * t,
    () => -0.15,
  ),
);

/** C — a horizontal line: stand still. The velocity target is zero throughout. */
const profileC = new MotionProfile(
  "c",
  "C",
  analyticShape(
    () => 1.0,
    () => 0,
  ),
);

/** D — a shallow ramp then a steep one: walk away slowly, then quickly. */
const profileD = new MotionProfile(
  "d",
  "D",
  piecewiseLinearShape([
    { time: 0, position: 0.25 },
    { time: 6, position: 0.55 },
    { time: RUN_DURATION_S, position: 1.75 },
  ]),
);

/** E — a concave-up curve: start at rest and speed up steadily, away from the sensor. */
const profileE = new MotionProfile(
  "e",
  "E",
  analyticShape(
    (t) => 0.25 + 0.015 * t * t,
    (t) => 0.03 * t,
  ),
);

/** F — flat, ramp, flat: wait, walk away, stop. */
const profileF = new MotionProfile(
  "f",
  "F",
  piecewiseLinearShape([
    { time: 0, position: 0.35 },
    { time: 2, position: 0.35 },
    { time: 8, position: 1.7 },
    { time: RUN_DURATION_S, position: 1.7 },
  ]),
);

/** G — wait, walk away briskly, stop, then drift back slowly. */
const profileG = new MotionProfile(
  "g",
  "G",
  piecewiseLinearShape([
    { time: 0, position: 0.3 },
    { time: 1.5, position: 0.3 },
    { time: 5, position: 1.6 },
    { time: 7, position: 1.6 },
    { time: RUN_DURATION_S, position: 1.0 },
  ]),
);

/**
 * H — an arch: walk away, turn around at the top, come back. The velocity target
 * is the straight line that makes this the clearest demonstration in the set of
 * how a curved position graph becomes a sloped velocity graph.
 */
const profileH = new MotionProfile(
  "h",
  "H",
  analyticShape(
    (t) => 0.3 + 0.056 * t * (RUN_DURATION_S - t),
    (t) => 0.056 * (RUN_DURATION_S - 2 * t),
  ),
);

/** I — a sinusoid of two and a half cycles: walk back and forth, steadily. */
const profileI = new MotionProfile(
  "i",
  "I",
  analyticShape(
    (t) => 1.0 + 0.4 * Math.cos((Math.PI * t) / 2),
    (t) => -0.2 * Math.PI * Math.sin((Math.PI * t) / 2),
  ),
);

/** Every profile, in the order PASCO letters them. */
export const PROFILES: readonly MotionProfile[] = [
  profileA,
  profileB,
  profileC,
  profileD,
  profileE,
  profileF,
  profileG,
  profileH,
  profileI,
];

/** The profile a fresh screen opens on: the simplest one. */
export const DEFAULT_PROFILE: MotionProfile = profileA;
