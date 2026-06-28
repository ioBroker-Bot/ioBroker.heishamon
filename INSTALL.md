# INSTALL — iobroker.heishamon

Step-by-step guide for installing the adapter on an ioBroker instance, focused on the Linux defaults (`/opt/iobroker`, user `iobroker`). For wiring the heat pump, see [README.md](README.md#wiring).

A German version of this guide is available in [INSTALL_de.md](INSTALL_de.md).

## Prerequisites

- ioBroker ≥ 7.0, Node.js ≥ 22.
- The `iobroker` user must be in the `dialout` group so it can access serial devices:
  ```bash
  groups iobroker                     # must contain 'dialout'
  sudo usermod -aG dialout iobroker   # if not — then restart ioBroker
  ```
- The serial device is plugged in and reliably reachable. Note a stable `/dev/serial/by-id/...` path:
  ```bash
  ls -l /dev/serial/by-id/
  ```
  For a Pi GPIO UART the path is static (e.g. `/dev/ttyAMA2`).

## Installation

Install from the official ioBroker repository via the admin UI: **Adapters → search for `heishamon` → install**.

Then create an instance: **Instances → add `heishamon`**.

## Configuration

In the admin UI → Instances → `heishamon.0` → settings:

| Field | Recommendation for the first start |
|---|---|
| Serial port | `/dev/serial/by-id/...` (use the stable path, not `/dev/ttyUSB0`) |
| Baud rate | `9600` (Panasonic CN-CNT default — do not change) |
| Poll interval | `5` seconds |
| Read-only mode | **enable** — blocks every set-command, a safe first start |
| Extra poll | `true` (harmless on older heat pumps) |

Save → the adapter starts automatically.

## Verification

Open the adapter log in the admin UI (**Log** tab, filter for `heishamon`).

Expected picture with a running heat pump:
- `info: wire queue: minSendGapMs=…, capacity=100`
- `info: opened /dev/serial/by-id/… @ 9600 8E1`
- After a few seconds: 157 datapoints under `heishamon.0.main.*` and `heishamon.0.extra.*`.
- `heishamon.0.info.connection = true`, and `info.connectionQuality` climbs towards 100.

Check the object tree in the admin UI: **Objects → heishamon.0** → channels `main`, `extra`, optionally `optional`, plus `info`.

## Update to a new version

Update from the admin UI: **Adapters → `heishamon` → update**. The instance restarts automatically.

## Uninstall

Remove the instance and the adapter from the admin UI: **Instances → delete `heishamon.0`**, then **Adapters → delete `heishamon`**.

## Known pitfalls

- **`EACCES: /dev/ttyUSB0`** — the `iobroker` user is not in `dialout`. After `usermod -aG dialout iobroker`, restart the whole ioBroker service (`sudo systemctl restart iobroker`), not just the instance — group membership only takes effect in a new session.
- **Adapter starts but no datapoints fill in** — check the wiring at the CN-CNT port (cross TX↔RX, connect GND, mind the 5 V TTL levels, see [README.md → Wiring](README.md#wiring)). With a TTL↔RS485 converter also check A/B polarity and termination resistors.
- **Set-commands have no effect** — read-only mode is intentionally active on the first start. Disable it only once the read path runs cleanly.
- **When connected via the CZ-TAW1 bus** — keep the adapter in **read-only mode**, otherwise it causes bus collisions with the Panasonic cloud module.
