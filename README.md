# ioBroker.heishamon

ioBroker adapter that talks the **Panasonic Aquarea CN-CNT** protocol directly over a serial line, without any HeishaMon module or MQTT broker in between. The heat pump's CN-CNT connector uses **RS232 voltage levels**; an optional RS232/RS485 converter can be added for long cable runs because the protocol is half-duplex. Protocol decoding is based on insights from the [HeishaMon project](https://github.com/Egyras/HeishaMon).

> **Status:** Early release. Protocol library, simulator and adapter logic are complete in-process; field testing against a real heat pump is the next step.

## Installation

In the ioBroker admin UI: **Adapters → install from custom URL** (or, once published, from the official ioBroker repository) → `ioBroker.heishamon`.

For detailed wiring and OS-level instructions (serial permissions, RS232 wiring, RS485 converter), see [INSTALL.md](INSTALL.md).

## Configuration

| Setting | Default | Description |
|---|---|---|
| `device` | `/dev/ttyUSB0` | Path to the serial device the adapter opens. Must be readable by the ioBroker process. |
| `baudRate` | `9600` | Panasonic Aquarea uses 9600 8E1 — do not change unless you use a custom transceiver. |
| `pollIntervalSec` | `5` | How often the adapter polls the heat pump (seconds). |
| `extraPollEnabled` | `true` | Polls the additional energy data block (K/L series). Harmless on older models. |
| `readOnlyMode` | `false` | Passive listening only: do not send any polls or set commands, only decode frames from another master on the bus. |

## Features

- **Direct serial communication** with Panasonic Aquarea heat pumps over the CN-CNT port. No HeishaMon hardware or MQTT broker required.
- **157 datapoints** exposed as ioBroker states with proper roles, types and units.
- **Set commands** for all writable parameters supported by the CN-CNT protocol.
- **Read-only mode** for safe parallel operation alongside an existing HeishaMon installation (Phase-4 cut-over).
- **Connection-quality statistics** (frames in/out, CRC errors, timeouts) under the `info.*` channel.
- **Optional extra data block** for K/L series heat pumps (6 extra energy datapoints).

## Hardware

- ioBroker host with a serial port (Raspberry Pi UART, USB-RS232 adapter, or USB-RS485 adapter with a converter).
- RS232 level-shifter (e.g. MAX3232) is required when connecting the Pi UART directly to the heat pump.
- For long cable runs, place an RS232/RS485 converter near the host and use shielded twisted pair to the heat pump.

## Documentation

Project documentation lives under [docs/](docs/):

- [docs/plan/](docs/plan/) — phase plan and roadmap.
- [docs/protocol/](docs/protocol/) — CN-CNT protocol analysis.
- [docs/decisions/](docs/decisions/) — architecture decision records.

## Credits

Protocol decoding builds on the work of the [HeishaMon community](https://github.com/Egyras/HeishaMon). The CN-CNT register map and many implementation hints originate there. This adapter is a clean-room TypeScript reimplementation; see [vendor/heishamon-upstream/LICENSE-NOTE.md](vendor/heishamon-upstream/LICENSE-NOTE.md) for details.

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.0.1 (2026-05-25)
* (Tobias Hanss) Initial adapter release

## License

MIT License

Copyright (c) 2026 Tobias Hanss <tobias.hanss@atcetera.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE DEALINGS IN THE SOFTWARE.
