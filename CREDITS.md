# Credits — Motion Match

A SceneryStack simulation of the classic graph-matching activity: match a target
position-vs-time or velocity-vs-time graph by moving, either with the mouse or
in front of a PASCO Wireless Motion Sensor.

## Upstream inspiration

The activity and its nine lettered profiles follow PASCO Scientific's free
[MatchGraph!](https://www.pasco.com/products/software/matchgraph) software and
its published activity sheet (`012-14624B`). This is an independent
reimplementation and is not affiliated with, endorsed by, or a product of PASCO
Scientific. MatchGraph! is a trademark of PASCO Scientific.

## Hardware support

Wireless sensor communication uses [`pasco-ble`](https://github.com/veillette/pascoTS),
an independent TypeScript Web Bluetooth library for PASCO wireless sensors,
itself inspired by [PASCO's official Python library](https://github.com/PASCOscientific/pasco_python).

## Artwork

All artwork — the walker, the sensor, the screen icons — is drawn
programmatically from SceneryStack primitives. The sim ships no image assets.

## License

GNU Affero General Public License v3.0 or later — see the
[org LICENSE](https://github.com/OpenPhysics/.github/blob/main/LICENSE).
