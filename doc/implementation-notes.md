# Implementation notes — Motion Match

Architecture, and the things that will bite.

## Shape of the sim

```
src/
  init.ts assert.ts splash.ts brand.ts main.ts   ← bootstrap chain, do not reorder
  MotionMatchColors.ts MotionMatchConstants.ts MotionMatchNamespace.ts
  i18n/            StringManager.ts + strings_{en,es,fr}.json
  preferences/     model, node, motionMatchQueryParameters.ts
  common/
    model/         profiles, run state machine, sources, scoring
    view/          chart, play area, controls — ONE ScreenView for both screens
  simulation/      SimulationScreen + SimulationModel + summary content
  sensor/          MotionSensorScreen + MotionSensorModel + summary content
```

The two screens are thin. `MotionMatchModel` holds the entire activity;
`SimulationModel` and `MotionSensorModel` are ten-line subclasses that pick a
source, and both screens instantiate the **same** `MotionMatchScreenView`. Two
view options carry the whole difference:

- `writablePositionProperty` — present on the Simulation screen, makes the
  walker draggable.
- `sensorSource` — present on the Motion Sensor screen, adds the connection
  panel and makes the walker follow the hardware.

This is deliberate: a student who has done the mouse version should recognise
the sensor version instantly, and the only way to guarantee that is for it to be
literally the same view.

## The source abstraction

`TPositionSource` is the seam. It answers one question — where is the walker
right now, in metres from the sensor — and the model samples that answer on its
own fixed clock.

This differs from `RadioactivityAndStatistics`'s `TCountSource` on purpose. That
contract exposes a monotonically increasing total so a mismatch between the
sim's clock and the device's cannot lose events; totals can be differenced over
any interval. Position is a continuous signal that is **sampled**, not
accumulated, so latest-value semantics are the right contract here. Copying the
counting trick would have been the obvious mistake.

`step(dt)` is a no-op on the sensor source, and deliberately so rather than
unimplemented: the sensor keeps ranging whether or not the sim is stepping, and
pretending otherwise would make a backgrounded tab look like a stationary
student.

## The PASCO link

The sim implements only the PASCO packets needed by the Wireless Motion Sensor,
following the dependency-free client in `RadioactivityAndStatistics`. The
PS-3219 is interface **1042** with sensor **2048** on channel 0 (GATT service 1).
Its only raw sample is a two-byte little-endian echo time.

### Three things worth knowing

1. **Responses are asymmetric.** The one-shot command is written to service 1,
   but its response arrives on device service 0. Subscribe to service 0 before
   sending the keepalive or reads. Routing that packet only as device metadata
   leaves the sensor decoder empty and turns every sample into a false zero.

2. **`connect()` never rejects to the UI.** Connection outcomes are UI state, not
   exceptions. The button listener stays synchronous so the browser still sees a
   user gesture, and every outcome lands on `connectionStateProperty` /
   `errorMessageProperty`. A dismissed device picker returns to DISCONNECTED
   with no error — cancelling is not failing.

3. **Polling, not streaming.** `readEchoTime` is one BLE round trip. The poll loop
   is re-entrancy guarded and tolerates `MAXIMUM_CONSECUTIVE_FAILURES` dropped
   reads before declaring an error; skipping a tick is harmless because the
   model samples the latest value.

## Things that will bite

- **Web Bluetooth needs a user gesture.** The `requestDevice()` call in
  `connect()` is synchronous for that reason. Do not `await` anything ahead of it.
- **Do not accumulate run time in a float.** Sample times come from an integer
  index times the period. An earlier version added 0.05 repeatedly and ended
  runs one sample early; the tests pin this.
- **`dispose()` must be idempotent.** Axon Properties throw when disposed twice,
  and the fleet memory-leak suite disposes twice on purpose. `MotionMatchModel`
  guards with an `isDisposed` flag.
- **`AxisLine` is hidden in position mode.** The position axis runs 0–2 m, so a
  line at model zero would sit on the bottom border and say nothing. It is shown
  only in velocity mode, where v = 0 separates moving away from coming back.
  (The `RadioactivityAndStatistics` warning about `AxisLine` inflating bounds
  applies to autoscaling charts; this one has a fixed range.)
- **`ScreenView` throws if you set `pdomOrder` on itself.** The traversal order
  lives on a wrapper `Node` child.
- **The Preferences dialog is always light**, whatever colour profile the sim is
  in. Labels there use `controlSurfaceTextColorProperty`, never
  `textColorProperty`.
- **`LocalizedString` suffixes every leaf key.** Profile `a`'s description is
  `profiles.aStringProperty`, not `profiles.a`. Getting this wrong renders the
  literal string `undefined` rather than failing.

## Query parameters

| Parameter | Default | Purpose |
|---|---|---|
| `?matchTolerance=` | 0.125 | Half-width of the position match band, in metres (public) |
| `?showDiagnostics=` | false | Show the device's measurement list and raw readings |
| `?pollIntervalMs=` | 40 | Sensor poll period; raise it when debugging a flaky link |

## Testing

Transports cannot be exercised headless, which is exactly why the pure layers
are covered: `profiles.test.ts` (range, derivative agreement, continuity across
smoothed corners), `scoring.test.ts` (the tolerance boundary, exactly),
`motionMath.test.ts` (the differentiator, including its ends), and
`MotionMatchModel.test.ts` (the run state machine and sample count).

`npm run test:fuzz:quick` is the one check that exercises real construction of
both screens in a browser. It is how the `PASCOBLEDevice` constructor throw was
found; run it after touching anything in the sensor path.
