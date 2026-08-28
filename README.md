# Motion Match

[![CI](https://github.com/OpenPhysics/MotionMatch/actions/workflows/ci.yml/badge.svg)](https://github.com/OpenPhysics/MotionMatch/actions/workflows/ci.yml)

Match a target position-vs-time or velocity-vs-time graph by moving — with the
mouse, or by walking in front of a PASCO Wireless Motion Sensor over Web
Bluetooth. A SceneryStack reimagining of the classic graph-matching activity:
slope, zero slope, speeding up and slowing down, learned by being the moving
object.

## Features

- **Nine target curves**, lettered A–I after PASCO's own MatchGraph activity
  sheet, so a class can work from the printed worksheet and the sim together.
- **Position and velocity in one toggle.** The velocity target is the analytic
  derivative of the very curve shown in position mode — not a second hand-drawn
  set — so the relationship between the two graphs is the point, not a
  coincidence.
- **A visible scoring rule.** The score is the percentage of your run inside the
  tolerance band, and that band is drawn on the chart, so you can see exactly
  which part of your motion cost you.
- **Two screens, one activity.** Drag a figure with mouse, touch or keyboard;
  then do the same thing with a real **PASCO Wireless Motion Sensor (PS-3219)**
  over Web Bluetooth — no driver, no app, no install.
- **Fully keyboard operable**, with a live screen-reader summary of the curve,
  the graph type, and the state of the run.
- Installable and offline-capable (PWA), with a projector-friendly colour
  profile and English, French and Spanish.

## Quick Start

```bash
npm install
npm run icons     # generate PWA icons on a fresh clone
npm start         # → http://localhost:5173
```

To use a real sensor, open the **Motion Sensor** screen in **Chrome, Edge or
Opera** over HTTPS (or `localhost`), switch the PS-3219 on, and press *Connect
Sensor*. Stand the sensor at waist height with three or four metres of clear
floor in front of it. Firefox and Safari have no Web Bluetooth; the screen says
so instead of offering a button that cannot work.

Add `?showDiagnostics=true` to see the device's measurement list and its raw
readings — useful when bringing hardware up.

## Scripts

| Command | Description |
|---|---|
| `npm start` / `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run build:single` | Single self-contained `dist/index.html` |
| `npm run preview` | Preview the production build |
| `npm run check` | TypeScript across app, scripts and tests |
| `npm run lint` / `npm run fix` | Biome check / auto-fix |
| `npm test` | Vitest unit tests |
| `npm run test:fuzz` | Playwright fuzz smoke (`?fuzz&ea`) |
| `npm run test:fuzz:quick` | 10-second fuzz |
| `npm run icons` | Regenerate PWA icons |
| `npm run clean` | Remove `dist/` |

## Tech Stack

| Tool | Version | Notes |
|---|---|---|
| SceneryStack | ^3.0.0 | Simulation framework; `bamboo` for the chart |
| pasco-ble | ^0.3.65 | PASCO wireless sensors over Web Bluetooth |
| Vite | ^8 | Build tool and dev server |
| TypeScript | ^7 | `erasableSyntaxOnly` — no `enum`, no `namespace` |
| Biome | ^2.5 | Lint + format |
| Vitest | ^4 | Unit tests (`happy-dom`) |
| Playwright | ^1.62 | Fuzz smoke test |
| vite-plugin-pwa | ^1 | Installable / offline |

Hardware: **PASCO Wireless Motion Sensor PS-3219** (0.15–4 m, 1 mm resolution,
Bluetooth 5.2). Web Bluetooth requires a Chromium-based browser and a secure
origin.

## License

GNU Affero General Public License v3.0 or later — see the
[org LICENSE](https://github.com/OpenPhysics/.github/blob/main/LICENSE).

## Contributing

See the [org contributing guide](https://github.com/OpenPhysics/.github/blob/main/CONTRIBUTING.md).
