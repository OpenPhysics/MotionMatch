/**
 * profiles.ts
 *
 * The nine target curves, lettered A–I after PASCO's own MatchGraph activity
 * sheet (012-14624B) so a class can work from the printed worksheet and the sim
 * interchangeably.
 *
 * All nine are defined over [0, RUN_DURATION_S] and stay within 0.5–3.5 m, well
 * inside the PS-3219's 0.15–4 m window, so a student never walks into the dead
 * zone or off the far end. The fastest (I) peaks near 1.26 m/s.
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
    (t) => 0.5 + 0.3 * t,
    () => 0.3,
  ),
);

/** B — a straight line with negative slope: walk toward the sensor at a steady pace. */
const profileB = new MotionProfile(
  "b",
  "B",
  analyticShape(
    (t) => 3.5 - 0.3 * t,
    () => -0.3,
  ),
);

/** C — a horizontal line: stand still. The velocity target is zero throughout. */
const profileC = new MotionProfile(
  "c",
  "C",
  analyticShape(
    () => 2.0,
    () => 0,
  ),
);

/** D — a shallow ramp then a steep one: walk away slowly, then quickly. */
const profileD = new MotionProfile(
  "d",
  "D",
  piecewiseLinearShape([
    { time: 0, position: 0.5 },
    { time: 6, position: 1.1 },
    { time: RUN_DURATION_S, position: 3.5 },
  ]),
);

/** E — a concave-up curve: start at rest and speed up steadily, away from the sensor. */
const profileE = new MotionProfile(
  "e",
  "E",
  analyticShape(
    (t) => 0.5 + 0.03 * t * t,
    (t) => 0.06 * t,
  ),
);

/** F — flat, ramp, flat: wait, walk away, stop. */
const profileF = new MotionProfile(
  "f",
  "F",
  piecewiseLinearShape([
    { time: 0, position: 0.7 },
    { time: 2, position: 0.7 },
    { time: 8, position: 3.4 },
    { time: RUN_DURATION_S, position: 3.4 },
  ]),
);

/** G — wait, walk away briskly, stop, then drift back slowly. */
const profileG = new MotionProfile(
  "g",
  "G",
  piecewiseLinearShape([
    { time: 0, position: 0.6 },
    { time: 1.5, position: 0.6 },
    { time: 5, position: 3.2 },
    { time: 7, position: 3.2 },
    { time: RUN_DURATION_S, position: 2.0 },
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
    (t) => 0.6 + 0.112 * t * (RUN_DURATION_S - t),
    (t) => 0.112 * (RUN_DURATION_S - 2 * t),
  ),
);

/** I — a sinusoid of two and a half cycles: walk back and forth, steadily. */
const profileI = new MotionProfile(
  "i",
  "I",
  analyticShape(
    (t) => 2.0 + 0.8 * Math.cos((Math.PI * t) / 2),
    (t) => -0.4 * Math.PI * Math.sin((Math.PI * t) / 2),
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
