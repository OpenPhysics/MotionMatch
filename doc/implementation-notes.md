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

The sim depends on [`pasco-ble`](https://github.com/veillette/pascoTS) rather
than re-implementing the protocol. Unlike the Geiger counter in
`RadioactivityAndStatistics` — interface 1064, supported by neither open library
— the Wireless Motion Sensor is interface **1042** → sensor **2048**, fully
covered, including the echo-time → position equation and the unit tables.

### Three things worth knowing

1. **`new PASCOBLEDevice()` throws where Web Bluetooth is missing.** Firefox,
   Safari, an insecure origin, a headless test browser. It is therefore
   constructed lazily, on the first connect attempt — building it in the model
   constructor took the entire Motion Sensor screen down at creation time for
   those users instead of showing them the "use Chrome or Edge" message the
   panel already has. The fuzz test catches this; keep it passing.

2. **`connect()` never rejects.** Connection outcomes are UI state, not
   exceptions. The button listener stays synchronous so the browser still sees a
   user gesture, and every outcome lands on `connectionStateProperty` /
   `errorMessageProperty`. A dismissed device picker comes back from
   `pasco-ble` as an **empty array**, not a throw, and returns to DISCONNECTED
   with no error — cancelling is not failing.

3. **Polling, not streaming.** `readData` is one BLE round trip. The poll loop
   is re-entrancy guarded and tolerates `MAXIMUM_CONSECUTIVE_FAILURES` dropped
   reads before declaring an error; skipping a tick is harmless because the
   model samples the latest value.

### The `@/` alias workaround — remove when upstream is fixed

`pasco-ble@0.3.65` ships **unresolved `@/…` path aliases in both its published
`dist/*.js` and `dist/*.d.ts`**, and declares no `imports` map to resolve them.
Without help the package cannot be imported at all: Node, esbuild and Rollup all
fail with `Cannot find package '@/utils'`, and TypeScript silently degrades
`PASCOBLEDevice` to a class with no `TypedEventEmitter` base.

Every alias in that package is rooted at its own `dist/`, so the sim maps `@/*`
there in **four** places:

| File | What it does |
|---|---|
| `vite.config.ts` | `resolve.alias` for dev server and build |
| `vitest.config.ts` | the same, for unit tests |
| `tsconfig.json` | `paths`, so `npm run check` resolves the typings |
| `tsconfig.test.json` | the same, for the test project |

This sim never writes `@/` imports of its own, so the alias collides with
nothing. **Delete all four** once pascoTS publishes a build that rewrites its
aliases (tsc-alias, or a bundler). Nothing else depends on it.

The dependency also costs about **210 kB gzipped** over a sibling sim, almost
all of it `mathjs`, which `pasco-ble` uses for its equation parser. If that ever
becomes unacceptable, the fallback is a vendored client on the
`RadioactivityAndStatistics/src/common/hardware/PascoProtocol.ts` model: the
protocol is identical, only the interface/sensor ids and the echo-time
conversion change.

## Things that will bite

- **Web Bluetooth needs a user gesture.** Everything before `scan()` in
  `connect()` is synchronous for that reason. Do not `await` anything ahead of it.
- **Do not accumulate run time in a float.** Sample times come from an integer
  index times the period. An earlier version added 0.05 repeatedly and ended
  runs one sample early; the tests pin this.
- **`dispose()` must be idempotent.** Axon Properties throw when disposed twice,
  and the fleet memory-leak suite disposes twice on purpose. `MotionMatchModel`
  guards with an `isDisposed` flag.
- **`AxisLine` is hidden in position mode.** The position axis runs 0–4 m, so a
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
| `?matchTolerance=` | 0.25 | Half-width of the position match band, in metres (public) |
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
