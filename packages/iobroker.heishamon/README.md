# iobroker.heishamon

ioBroker-Adapter, der direkt per RS485 mit einer Panasonic Aquarea Wärmepumpe spricht (CN-CNT-Protokoll). Kein HeishaMon-Modul, kein MQTT-Hop.

## Status

Frühe Phase 3. Skeleton vorhanden, Hauptlogik wird gerade aufgebaut.

## Architektur

- [src/main.ts](src/main.ts) — Adapter-Lifecycle (`onReady`, `onStateChange`, `onUnload`)
- [src/object-tree.ts](src/object-tree.ts) — generiert ioBroker-Objekte aus der Datapoint-Tabelle
- [src/poller.ts](src/poller.ts) — Polling-Loop (mainPoll alle N Sekunden, optional extraPoll)
- [src/transport.ts](src/transport.ts) — Serial-Port-Wrapper

Nutzt [`heishamon-protocol`](../heishamon-protocol/) für CRC, Framer, Decoder und Encoder. Die WP-Anbindung ist clean-room reimplementiert, kein HeishaMon-C++-Code wird übernommen.

## Konfiguration (`native`)

| Feld | Default | Bedeutung |
|------|---------|-----------|
| `device` | `/dev/ttyUSB0` | Serial-Device-Pfad |
| `baudRate` | `9600` | Baudrate (Panasonic ist immer 9600 8E1) |
| `pollIntervalSec` | `5` | Sekunden zwischen Polls |
| `extraPollEnabled` | `true` | K/L-Serie-Erweiterung pollen |
| `optionalPcbPollEnabled` | `false` | Optional-PCB-Polls senden (für Smart-Grid etc.) |
| `readOnlyMode` | `false` | Read-only-Modus für Phase-4-Parallelbetrieb |

## Objekttree

Datenpunkte werden als ioBroker-States unter

```
heishamon.0.main.<Datapoint>      (z.B. heishamon.0.main.Outside_Temp)
heishamon.0.extra.<Datapoint>     (XTOPs)
heishamon.0.optional.<Datapoint>  (OPTs)
```

abgelegt. Die Namen sind **identisch** zu den HeishaMon-MQTT-Topic-Suffixen ([ADR-0004](../../docs/decisions/0004-datapoint-naming.md)).
