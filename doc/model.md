# Model — Motion Match

What the sim computes, and why it computes it that way.

## The activity

A student is shown one of nine motion graphs and tries to reproduce it — by
dragging a figure with the mouse, or by walking in front of a PASCO Wireless
Motion Sensor. Their own motion is drawn on the same axes as the target, and
scored against it.

The physics content is entirely in the reading of the graphs: what a slope
means, what a zero slope means, and how a position graph and a velocity graph of
the same motion relate. Nothing is integrated and nothing is simulated — the
student *is* the moving object.

## The nine profiles

The curves are lettered A–I after PASCO's MatchGraph activity sheet
(`012-14624B`), so a class can work from the printed worksheet and the sim
interchangeably. Each runs for **10 s** on a **0–4 m** position axis, with the
sensor at the origin.

| Id | x(t), metres | Motion |
|---|---|---|
| A | `0.5 + 0.30 t` | constant speed away |
| B | `3.5 − 0.30 t` | constant speed toward |
| C | `2.0` | stand still |
| D | `0.5 + 0.10 t` (t ≤ 6); `1.1 + 0.60 (t−6)` | slow away, then fast away |
| E | `0.5 + 0.03 t²` | start at rest, speed up |
| F | `0.7` (t ≤ 2); `0.7 + 0.45 (t−2)` (t ≤ 8); `3.4` | wait, walk away, stop |
| G | `0.6` (t ≤ 1.5); ramp to `3.2` at t = 5; `3.2` (t ≤ 7); down to `2.0` at t = 10 | wait, hurry away, stop, drift back |
| H | `0.6 + 0.112 t (10 − t)` | away, turn around, come back |
| I | `2.0 + 0.8 cos(π t / 2)` | back and forth, 2½ cycles |

All nine stay inside 0.5–3.5 m, comfortably within the PS-3219's 0.15–4 m
window, so a student never walks into the dead zone or off the far end. The
fastest (I) peaks at 0.4π ≈ 1.26 m/s, so a ±1.5 m/s velocity axis covers the
whole set.

### Velocity targets are derivatives, not a second set of curves

Each profile is defined **once**, as a position function together with its
analytic derivative. Switching the graph toggle to Velocity shows `dx/dt` of the
very curve that was on screen a moment ago. That is the pedagogical point of the
toggle: if the two were drawn independently, a student could learn to match both
without ever noticing they describe the same motion.

### Corner smoothing

D, F and G are piecewise-linear in position, so their exact derivative is a step
function — a vertical line on the chart, and a speed change no student can walk.

Each such corner is blended with a smoothstep `3u² − 2u³` over
`CORNER_SMOOTHING_S = 0.4 s`, applied to **velocity only**. Position is left
exactly as drawn: the blend would move it by under 2 cm on a 4 m axis, which is
invisible and far inside the match tolerance, and keeping position exact means
the two modes read as the same curve. Corners in these profiles are at least
1.5 s apart, so at most one blend is ever active.

Corners are declared in the profile definition rather than detected numerically,
so smoothing never has to guess where a discontinuity is.

## Sampling and the derived velocity

A run is sampled at **20 Hz** on a fixed-timestep accumulator, not on raw frame
`dt`. Two consequences that matter:

- A run has the same number of samples at the same instants whether it came from
  a 144 Hz display or from a sensor answering every 40 ms, so scores are
  comparable across screens and machines.
- Sample times are computed as `index × 0.05 s`, never accumulated. Repeatedly
  adding 0.05 drifts — three seconds of it sums to 2.9999999999999996 — and a
  run that ended one sample early would quietly change the score.

Velocity is always differentiated **host-side** from the position trace, with a
centered least-squares window of 5 samples (±0.1 s), even on the sensor screen
where the device reports its own velocity. The device uses a different window,
so using it would make the two screens score differently for the same motion;
and reading one measurement per BLE round trip instead of three keeps the poll
rate up. Near the ends the window slides inward rather than shrinking, so every
sample gets a slope from the same number of points — a shrinking window would
make the first and last samples much noisier than the rest, which is exactly
where a turnaround often is.

## Scoring

**Score = the percentage of recorded samples lying within the tolerance band of
the target**, rounded to a whole number.

Default tolerances are **±0.25 m** for position and **±0.30 m/s** for velocity;
velocity is wider in proportional terms because it is differentiated from the
position trace and therefore noisier. The position tolerance is adjustable in
Preferences and via `?matchTolerance=`.

### Why fraction-in-band and not RMS error

RMS error is the better statistic and the worse teacher. It has no on-screen
counterpart, so the number arrives as a verdict from a hidden formula; and one
bad moment dominates it, which tells a student their whole run was poor when it
was one stumble.

The band is drawn on the chart. A student who scores 62 can point at the stretch
of their trace that left the shaded region and say *that* is what cost them.
Widening the tolerance in Preferences visibly widens the band rather than
quietly inflating the number.

A run stopped early is scored on what was actually recorded, so stopping shows
its cost rather than hiding it. An empty run scores 0 rather than throwing.

### What is not scored

Nothing is stored. There is no name, no leaderboard, no history: the score
appears when a run ends and is gone as soon as the student changes curve,
switches mode, or presses Try Again. A score on screen always describes the
curve currently drawn.

## Hardware

The **PASCO Wireless Motion Sensor (PS-3219)** measures 0.15–4 m by ultrasound
at up to 250 Hz, with 1 mm resolution. It reports a raw echo time in
microseconds; position is `echo / 10⁶ × 344 m/s ÷ 2`, computed host-side by
`pasco-ble`. The sim polls `Position` every 40 ms — faster than it samples, so a
fresh reading is always waiting.

A reading of exactly 0 means no echo returned: there was nothing within
0.15–4 m in front of the sensor to reflect off. This is a measurement result,
not a fault, which is why the sim clamps rather than rejects it.
