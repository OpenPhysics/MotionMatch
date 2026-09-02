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

### The range setting, and where the command came from

The PS-3219 has a software-selectable receiver range. PASCO's own datasheet
(`datasheets.py` in `PASCOscientific/pasco_python`, sensor 2048) declares it as
an internal constant:

```xml
<Measurement ID="100" NameTag="MotionRange" Type="Constant" Internal="1"
             Value="2" Values="MotionShort:1:MotionLong:2" IsRange="1"/>
```

Short raises the receiver's gain for nearby targets; long trades that away for
distant echoes. The device powers up on long (`Value="2"`), and PASCO recommends
short whenever the target is close — carts on a track, and by the same argument
this sim, whose position axis stops at 2 m.

The command is in none of PASCO's libraries. `pasco_python` sends only
`GCMD_READ_ONE_SAMPLE` (0x05), `GCMD_XFER_BURST_RAM` (0x0E) and
`GCMD_CUSTOM_CMD` (0x37), and reads measurement 100 out of its datasheet rather
than off the device. It was recovered instead from the web build of SPARKvue
(`sparkvue.pasco.com`), whose Angular layer is only a Web Bluetooth transport —
every packet is built in `wasm/spark.wasm`, which ships with its name section
and DWARF intact. Three functions carry the whole answer:

- `BLEInterface::SetCurrentRange(channel, ordinal, index)` calls
  `PascoBLEDriver::SetRange(channel, ordinal, index + 1)` — the wire index is
  **one-based**.
- `PascoSensor::FindRangeMeasurement(n)` walks the sensor's measurements and
  counts only those flagged `IsRange="1"`, so `ordinal` is a position in that
  filtered list, **not** a measurement ID. The PS-3219 has exactly one, so it is
  always 0.
- `PascoBLEDriver::SetRange` assembles `[0x28, 0x00, ordinal, index]`, sends it
  on channel + 1 — sensor service 1, the same characteristic the 0x05 read goes
  to — and blocks up to 1000 ms for an ordinary `0xC0 0x00 0x28` result packet.
  Its own failure log names the opcode: `ch=%d, gcmd=%d, size=%d, needResp=%d`
  with gcmd = 40.

So short range is `28 00 00 01` and long is `28 00 00 02`, and the reply arrives
on device service 0 with the same asymmetry as a sample read.

**This was read out of a binary, not captured off the wire.** `?sensorRange=`
therefore defaults to `long`, which is what the device does anyway, so the
default path sends nothing new. Confirm `short` against real hardware across the
full 0–2 m axis before making it the default.

### The rest of the command set, and why we use none of it

`PascoBLEDriver::GetGenericCmdName` in the same binary is a plain lookup —
`if (cmd <= 0x58) return names[cmd]` over a pointer table — so the whole opcode
space is recoverable by name. The ones that bear on this sim:

| Opcode | Name | Framing |
|---|---|---|
| `0x01` | `SET_SAMPLE_PERIOD` | `[01, uint32 LE µs, b, b]` to the sensor service |
| `0x02` | `SET_SAMPLE_SIZE` | per sensor service |
| `0x05` | `READ_ONE_SAMPLE` | what this sim uses |
| `0x06` | `START_SAMPLING` | `[06, uint16 LE ms per channel…]` to device service 0 |
| `0x07` | `STOP_SAMPLING` | `[07]` to device service 0 |
| `0x28` | `SET_RANGE` | above |

The units are not guesses: `BLEInterface::PreStartSampling` multiplies the
period in seconds by `0x1.e848p+19` (1e6) before `SetSampleConfig`, and
`BLEInterface::StartSampling` multiplies by `0x1.f4p+9` (1000) and masks to
11 bits before `StartSampling`. So 20 Hz is `50000` µs and `50` ms respectively.

**A sample rate is not a knob on polling.** It configures the device's own
sampler, which produces nothing until `START_SAMPLING` runs; `READ_ONE_SAMPLE`
is unaffected. Asking for a rate therefore means switching to streaming, and
`?sensorSampleRateHz=` does exactly that on a transport that supports it.

Captured USB traffic gives the whole shape:

```
IN  2  01 04 1a ce 06          service 1, characteristic 4, sequence 0x1a, echo
OUT 3  01 05 00 00 00 00 1f    characteristic 5, acknowledging through 0x1f
```

Samples carry a five-bit sequence that wraps at 0x20, which is why a result
(`0xC0`) or an event (`0x85`) can never be mistaken for one. The device stops
sending unless the host acknowledges every eighth packet — the capture
acknowledges at 0x1f and again at 0x07, and `pasco_python` uses the same
interval. `UsbMotionSensor.drainStream` reads, dispatches, and acknowledges;
`MotionSensorSource` feeds each sample through the same `acceptReading` the poll
loop uses, so clamping, diagnostics and failure counting are shared.

Streaming buys firmware-paced sampling with no round-trip jitter. It costs the
guarantee that a dropped read is harmless, so polling stays the default: leave
`?sensorSampleRateHz=` at 0 and the sim behaves exactly as it always has.
Bluetooth has no streaming path here — its characteristics 4 and 5 are never
discovered — so a rate is ignored there and polling continues.

### USB is a real transport for this sensor

The manual is explicit — "a combination wireless and USB sensor … can also
connect to a computer with a USB cable" — and the Bluetooth LED stays dark when
it is plugged into a USB port rather than a charger.

SPARKvue reaches it over WebUSB, and `USBBLEDevice` in the wasm shows the
protocol above is unchanged; only the framing around it differs:

- Filter `{ vendorId: 0x0945 }` (PASCO), then `open()`,
  `selectConfiguration(1)`, `claimInterface(0)`.
- Write: `[serviceId, characteristicId, …packet]` on **OUT endpoint 3**, payload
  capped at 62 bytes so the transfer fits 64.
- Read: `[serviceId | 0x80, characteristicId, byteCount]` on the same endpoint,
  answer collected from IN endpoint 3. The high bit is what marks a read.
- `Connect()` and `EnableNotifications()` both just `return true` — there is no
  GATT subscribe to do; everything arrives on the IN endpoint.

A PS-3219 enumerates as `Pasco / Pasco USB Bridge`, `0945:0002`, confirmed on
hardware:

```json
{"deviceClass":0,"configurationValue":1,"interfaces":[{"interfaceNumber":0,
 "interfaceClass":255,"interfaceSubclass":255,"interfaceProtocol":0,
 "endpoints":[{"endpointNumber":2,"direction":"in","type":"bulk","packetSize":64},
              {"endpointNumber":3,"direction":"out","type":"bulk","packetSize":64}]}]}
```

Class 255 is vendor-specific, so WebUSB will claim it — a protected class such
as HID would have made the browser route impossible. Note the endpoints are
**not** symmetric: OUT is 3, which is what SPARKvue hard-codes, but IN is 2.
`UsbMotionSensor` reads both out of the descriptor for that reason, and takes
the transfer size from the IN endpoint's `packetSize` rather than assuming 64.

**Claiming the interface is not enough.** Until a vendor control transfer
arrives, both endpoints accept writes and answer nothing whatsoever — which
looks exactly like a framing bug and is not one. SPARKvue reads three vendor
descriptors and then writes one enable:

```
CTRL IN  req 0xED                       → 12 04
CTRL IN  req 0xA0 val 0x1FC idx 0x1000  → 1e 89 02 ca
CTRL IN  req 0xF2                       → "UsbBridge Jun 23 2022 18:54:04"
CTRL OUT req 0xFB val 0    idx 0x3500   ← the enable
```

Only the enable is required; SPARKvue logs a transfer error on one of the reads
every time and carries on, so `wakeBridge` tolerates their failure too.

After that a command is written and the IN endpoint is simply read — there is no
read request in captured traffic, despite `USBBLEDevice::RecvData` being able to
build one. Events arrive on the same endpoint unprompted and interleaved
(`00 03 85 96 0f 62 00 04`), so a read loop must skip anything that is not a
result packet rather than treat the first transfer as its answer.

Two practical traps. The sensor would not enumerate at all through a front-panel
USB header — the manual asks for a direct port or a *powered* hub, and a rear
port fixed it. And when transfers do go wrong, `chrome://device-log` reports
`The request was aborted (0x4D3)` followed by `A device attached to the system
is not functioning (0x1F)` and a removal, after which the device stops appearing
in the picker until it is replugged. Hence `?usbBringUp=probe`, which claims the
interface, reports the descriptors and sends nothing, and hence the stall
handling: a halted endpoint is cleared and reported rather than pushed at again.

`serviceId` and `characteristicId` are the same numbers `PASCO_CHARACTERISTIC`
already carries, so `PascoMotionProtocol.ts` is reused as-is and only
`BluetoothMotionSensor` gains a sibling. For a classroom that is attractive
— no pairing, no battery, and the sensor is tethered to the computer rather than
the student — but it is a second transport to maintain and test, and WebUSB on
Windows needs the device bound to WinUSB.

### Why 20 Hz leaves the sensor room

Maximum distance falls as the rate rises, because an echo has to return before
the next ping leaves. The PS-3219 manual quotes 1.72 m at 100 Hz, 0.86 m at
200 Hz and 0.69 m at 250 Hz (`MaxRate="250Hz"`) — all of them `c/2f` with
c = 344 m/s. At `SAMPLE_RATE_HZ` = 20 that ceiling is 8.6 m, which is where the
datasheet's `Maximum="8"` for position comes from, and four times the 2 m the
axis needs. `SENSOR_MINIMUM_RANGE_M` = 0.15 is the other end of the same
mechanism: about 0.85 ms of transducer dead time after the outgoing burst.
(The datasheet's `Minimum="0.015"` is off by a factor of ten; the manual, the
knowledge base and the dead time all agree on 0.15 m.)

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
| `?sensorRange=` | long | Receiver range asked for at connect: `short` or `long` |
| `?sensorTransport=` | bluetooth | `usb` reaches the sensor over WebUSB instead |
| `?sensorSampleRateHz=` | 0 | Stream at this rate instead of polling; 0 polls. USB only |
| `?usbBringUp=` | off | `probe` reports USB descriptors and sends nothing; `all` unfilters the picker |

## Testing

Transports cannot be exercised headless, which is exactly why the pure layers
are covered: `profiles.test.ts` (range, derivative agreement, continuity across
smoothed corners), `scoring.test.ts` (the tolerance boundary, exactly),
`motionMath.test.ts` (the differentiator, including its ends), and
`MotionMatchModel.test.ts` (the run state machine and sample count).

`npm run test:fuzz:quick` is the one check that exercises real construction of
both screens in a browser. It is how the `PASCOBLEDevice` constructor throw was
found; run it after touching anything in the sensor path.
