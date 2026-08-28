# CLAUDE.md — Motion Match

Sim-specific context for AI assistants. General SceneryStack guidance:
[OpenPhysics/.github/CLAUDE.md](https://github.com/OpenPhysics/.github/blob/main/CLAUDE.md).

## Project

Match a target position-vs-time or velocity-vs-time graph by moving — with the
mouse on the **Simulation** screen, or in front of a PASCO Wireless Motion
Sensor (PS-3219) over Web Bluetooth on the **Motion Sensor** screen. An
independent reimplementation of PASCO's MatchGraph activity.

Architecture and rationale live in [`doc/implementation-notes.md`](doc/implementation-notes.md);
the profiles, the derivative relationship and the scoring rule are in
[`doc/model.md`](doc/model.md). Read both before changing model code.

## Key files

| File | Purpose |
|---|---|
| `src/common/model/MotionMatchModel.ts` | The whole activity: run state machine, fixed-rate sampling, scoring |
| `src/common/model/profiles.ts` | The nine curves A–I |
| `src/common/model/MotionProfile.ts` | Profile shapes + corner smoothing for velocity targets |
| `src/common/model/scoring.ts` | Fraction-in-band score (pure) |
| `src/common/model/motionMath.ts` | Least-squares derivative + windowed differentiator (pure) |
| `src/common/model/PositionSource.ts` | `TPositionSource` — the seam between the two screens |
| `src/common/model/MotionSensorSource.ts` | The PASCO link: lazy device, poll loop, never-rejecting connect |
| `src/common/view/MotionMatchScreenView.ts` | **One** ScreenView, used by both screens |
| `src/common/view/MatchChartNode.ts` | bamboo chart: target, tolerance band, live trace |
| `src/common/view/PlayAreaNode.ts` | Track, sensor, walker + drag / keyboard listeners |
| `src/simulation/`, `src/sensor/` | Thin screen packages; the models are ten lines each |

## The two screens are one view

`SimulationModel` and `MotionSensorModel` differ only in which
`TPositionSource` they construct, and both screens instantiate the same
`MotionMatchScreenView`. Two options carry the entire difference:
`writablePositionProperty` (makes the walker draggable) and `sensorSource`
(adds the connection panel). **Do not fork the view.** A student should
recognise the sensor screen instantly, and sameness by construction is the only
way to guarantee that.

## Things that will bite

- **Web Bluetooth needs a user gesture** — `requestDevice()` must be reached
  directly from the Connect button. Do not add an `await` ahead of it.
- **`connect()` never rejects.** Outcomes land on Properties. A dismissed picker
  throws `DeviceSelectionCancelled` internally and is not shown as an error.
- **Never accumulate run time in a float.** Sample times are `index × period`.
  An earlier version drifted and ended runs a sample early; tests pin it.
- **`dispose()` must stay idempotent** — axon Properties throw on double
  dispose, and the memory-leak suite disposes twice on purpose.
- **`AxisLine` is shown only in velocity mode**; in position mode (0–4 m) it
  would sit on the bottom border and say nothing.
- **`ScreenView` throws if you set `pdomOrder` on itself** — it lives on a
  wrapper `Node`.
- **Preferences dialog is always light** — use `controlSurfaceTextColorProperty`
  there, never `textColorProperty`.
- **`LocalizedString` suffixes every leaf key**: profile `a`'s description is
  `profiles.aStringProperty`. Getting it wrong renders the literal `undefined`.

## Compliance carve-outs

### `package.json` overrides

Inherited from the template; rationale unchanged (`lodash`, `three`,
`brace-expansion` pinned for advisories SceneryStack has not yet re-pinned).
Dependabot ignores those three names.

## Hardware testing

Needs a PS-3219, Chrome/Edge/Opera, and HTTPS or `localhost`. There is no way to
exercise the transport in CI, which is why everything above it is pure and unit
tested.

```bash
npm start   # then open the Motion Sensor screen
```

`?showDiagnostics=true` prints the device's measurement list and the raw value
of every measurement each poll — the way to tell a genuine zero reading
(nothing within 0.15–4 m to echo off) from a device answering nothing at all.
`?pollIntervalMs=` raises the poll period when debugging a flaky link.

## Commands

```bash
npm run lint && npm run check && npm run build && npm test
```

`npm run test:fuzz:quick` after any change to the sensor path — it is the only
check that constructs both screens in a real browser.
