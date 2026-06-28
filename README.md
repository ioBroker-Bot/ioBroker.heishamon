# ioBroker.heishamon

ioBroker adapter that talks the **Panasonic Aquarea CN-CNT** protocol directly over a serial line, without any HeishaMon module or MQTT broker in between. The heat pump's CN-CNT connector uses **5V TTL UART logic levels**. A suitable level shifter is required when connecting it to a 3.3V UART, such as the Raspberry Pi GPIO UART. For long cable runs, an optional TTL/RS485 converter can be added because the protocol is half-duplex. Protocol decoding is based on insights from the [HeishaMon project](https://github.com/Egyras/HeishaMon).


> **Status:** Early release. Protocol library, simulator and adapter logic are complete in-process; field testing against a real heat pump is the next step.

## Supported heat pumps

Panasonic Aquarea air-to-water heat pumps of the **H, J, K and L series**.

## Installation

Install from the official ioBroker repository via the admin UI: open the **Adapters** tab, search for **heishamon**, and click install.

For detailed wiring and OS-level instructions (serial permissions, RS232 wiring, RS485 converter), see [INSTALL.md](INSTALL.md) (German: [INSTALL_de.md](INSTALL_de.md)).

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

## ⚠️ Write-rate considerations

The Panasonic Aquarea controller's internal storage mechanism for settings is not documented. Normal use — manual changes, occasional smart-home automation — is very unlikely to cause wear; the HeishaMon community has years of operational experience without reported failures. However, high-frequency writes (e.g. a PID loop adjusting a setpoint every few seconds) could in theory exhaust an EEPROM cell over time if the controller is not using FRAM, MRAM, or a RAM-with-power-loss-flush design.

**Avoid writing the same datapoint more often than every few minutes** unless you have specific knowledge that your controller revision tolerates it. For closed-loop regulation, prefer a slow outer loop that drives the heat pump's own internal controllers rather than commanding the actuator directly.

## Hardware

- ioBroker host with a serial interface, such as a Raspberry Pi UART, USB-TTL UART adapter, or USB-RS485 adapter with a suitable converter.
- Logic-level shifter is required when connecting a 3.3V UART, such as the Raspberry Pi UART, directly to the heat pump's 5V TTL UART pins.
- Use a 5V-compatible USB-TTL UART adapter if connecting via USB directly.
- For long cable runs, place a TTL/RS485 converter near the heat pump or host and use shielded twisted pair cable.

## Wiring

> ⚠️ **Measure twice, connect once.** Everything here is provided **without any warranty** and used **entirely at your own risk and liability.**

The heat pump mainboard exposes two equivalent connectors that this adapter can use: **CN-CNT** and **CN-NMODE**. Either one works — pick whichever is easier to reach.

![Panasonic Aquarea mainboard showing the CN-CNT and CN-NMODE connectors](docs/images/mainboard-connectors.jpg)

`CN-CNT` is the connector normally used for the **CZ-TAW1 cloud module** or the **Optional PCB**:

- If a **CZ-TAW1** module is connected, run this adapter in **read-only mode** so it only listens and never drives the bus.
- With the **Optional PCB** present there are two bus masters, so collisions can occur — it should generally still work. After a CRC error the adapter waits a randomised time before the next bus access to break collision lock-step (see the response-driven bus notes in the changelog).

Both connectors carry a **5V TTL UART** signal, so a level shifter is required for 3.3V hosts such as the Raspberry Pi GPIO. The signal names below are given **from the heat pump's point of view** — cross them at the adapter end (heat-pump TX → adapter RX, heat-pump RX → adapter TX).

### CN-CNT — JST `B05B-XASK-1` (mating connector `PAP-05V-S`)

| Pin | Signal |
|---|---|
| 1 | +5 V |
| 2 | TX, 5V level (from the heat pump) |
| 3 | RX, 5V level (to the heat pump) |
| 4 | +12 V |
| 5 | GND |

### CN-NMODE — JST PH series (mating connector `PHR-4`, available pre-wired from the usual large online retailers)

| Pin | Signal |
|---|---|
| 1 | GND |
| 2 | RX, 5V level (to the heat pump) |
| 3 | TX, 5V level (from the heat pump) |
| 4 | +5 V |

### Connection variants

- **Heat pump ↔ 5V-level USB-TTL UART converter ↔ PC**
- **Heat pump ↔ RS232 transceiver ↔ USB/RS232 dongle ↔ PC**
- **Heat pump ↔ level shifter (to 3.3V) ↔ UART-capable Raspberry Pi GPIO**
- **Heat pump ↔ UART-to-RS485 converter ↔ long two-wire line, 120 Ω (don't forget the termination resistors!) ↔ UART-to-RS485 converter ↔ level shifter (to 3.3V) ↔ Pi GPIO**

> If you are not familiar with **ground / equalizing currents** and how to handle them, always add **galvanic isolation** — on the USB side this is cheap and easy.

Example — a UART-to-RS485 converter wired to the `CN-NMODE` connector (the heat-pump end of the RS485 long-distance variant):

![UART-to-RS485 converter wired to the CN-CNT connector](docs/images/cn-cnt-rs485-converter.jpg)

## Documentation

Project documentation lives under [docs/](docs/):

- [docs/plan/](docs/plan/) — phase plan and roadmap.
- [docs/protocol/](docs/protocol/) — CN-CNT protocol analysis.
- [docs/decisions/](docs/decisions/) — architecture decision records.

## Credits and upstream licensing

Protocol decoding builds on the work of the [HeishaMon community](https://github.com/Egyras/HeishaMon). The CN-CNT register map and many implementation hints originate there.

At the time of writing, the HeishaMon repository carries **no explicit license file** — no `LICENSE`, no header in the sources, no clear statement in the README. Under US and EU copyright law, this defaults to "all rights reserved", so we cannot copy or directly port the original code. To stay clean:

- The HeishaMon C++ sources serve **only as a reference** for understanding the Panasonic CN-CNT protocol.
- This adapter is a **clean-room TypeScript reimplementation**: we read the upstream sources, distilled the protocol into [docs/protocol/](docs/protocol/), and implemented from that documentation — not from the original code.
- The HeishaMon repository's protocol documentation files (`MQTT-Topics.md`, `OptionalPCB.md`, `ProtocolByteDecrypt.md`) describe an observable physical protocol — that is factual information and not subject to copyright; they are cited as sources where relevant.

The CN-CNT protocol itself is not published by Panasonic; what HeishaMon discovered is empirical observation. Facts are not copyrightable, but the specific C++ implementation of those discoveries is.

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.0.11 (2026-06-21)
* (Tobias Hanss) Object state roles for writable datapoints are now `level` instead of `value` (the `value` role requires `write=false`), fixing the repository checker's object-structure errors (E1011)
* (Tobias Hanss) State objects are now updated on upgrade (`extendObject`) so existing installations pick up the corrected roles
* (Tobias Hanss) Added the recommended i18n translations for the `info.connection` state name (W1001)

### 0.0.10 (2026-06-21)
* (Tobias Hanss) Published from CI with npm provenance (signed build attestation). No change to the adapter itself

### 0.0.9 (2026-06-21)
* (Tobias Hanss) CI: the release workflow's npm-publish step is now idempotent — it skips publishing when the version is already on npm, so a manual publish no longer makes the tagged release run fail. No change to the adapter itself

### 0.0.8 (2026-06-20)
* (Tobias Hanss) Maintenance for ioBroker repository acceptance: adapter-managed timers for clean shutdown, Node.js >=22 required, CI runs the adapter tests on Linux, Windows and macOS. No functional change to the heat-pump communication

### 0.0.7 (2026-05-30)
* (Tobias Hanss) Response-driven half-duplex bus: every send now waits for the heat pump's reply (or a timeout) before the next frame goes out, and retries up to 3 times on timeout or CRC error
* (Tobias Hanss) After a CRC error a randomised backoff precedes the next bus access to avoid lock-step collisions with a second master (Option-PCB)
* (Tobias Hanss) New "Diagnostics" setting toggles the set-command response logging (off by default)

### 0.0.6 (2026-05-30)
* (Tobias Hanss) Diagnostic logging to reverse-engineer the heat pump's SET acknowledgement: logs the sent frame and the heat pump's reply (frame type, timing, hexdump) at info level

### 0.0.5 (2026-05-30)
* (Tobias Hanss) Wire-queue gap is now enforced between every pair of sends, including across idle periods (previously the gap only applied while multiple tasks were already stacked in the queue — so polls and isolated sets bypassed it entirely)
* (Tobias Hanss) Queue is hard-capped at 100 pending entries; overflows are logged at warn level and the dropped send is skipped instead of silently piling up

### 0.0.3 (2026-05-26)
* (Tobias Hanss) Serialize all wire writes through a FIFO queue with a configurable inter-frame gap (default 200 ms). Fixes lost set commands when a script writes several datapoints at once
* (Tobias Hanss) Pump_Duty / Max_Pump_Duty unit removed (raw value 65-254, no physical unit)

### 0.0.2 (2026-05-25)
* (Tobias Hanss) Lower Node.js engine requirement to >= 20 (was 22) so the adapter installs on current ioBroker LTS hosts

### 0.0.1 (2026-05-25)
* (Tobias Hanss) Initial adapter release

[Older changelogs can be found there](CHANGELOG_OLD.md)

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
