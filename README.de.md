# ioBroker.heishamon (deutsche Übersicht)

ioBroker-Adapter, der direkt seriell mit einer **Panasonic Aquarea** Wärmepumpe spricht — ohne den Umweg über MQTT. Die WP-Seite arbeitet mit **RS232-Pegel** am CN-CNT-Port; für längere Kabelstrecken kann optional ein RS232↔RS485-Konverter eingesetzt werden, da das Protokoll halbduplex ist. Protokoll-Code basiert auf dem [HeishaMon-Projekt](https://github.com/Egyras/HeishaMon).

## Status

Frühe Konzeptphase. Siehe [docs/plan/README.md](docs/plan/README.md) für den Phasenplan.

## Hardware

- ioBroker auf Raspberry Pi 4
- RS232-Pegelwandler (z. B. MAX3232) am UART, oder USB-RS232-Adapter — optional über RS232↔RS485-Konverter, wenn das Kabel zur WP lang werden muss
- DE-Pin wird vom Kernel-UART-Treiber gemanagt (eigener Treiber, bereits vorhanden)

## Phasen

| Phase | Inhalt | Status |
|-------|--------|--------|
| 0 | Protokoll-Audit & Reverse-Engineering der HeishaMon-Quellen | abgeschlossen — siehe [docs/protocol/](docs/protocol/) |
| 1 | TypeScript-Bibliothek `heishamon-protocol` | abgeschlossen — 316 Tests |
| 2 | Wärmepumpen-Simulator | in-process komplett, Hardware-Test gegen echtes HeishaMon ausstehend |
| 3 | ioBroker-Adapter | in-process komplett, Install in ioBroker + Test gegen Simulator offen |
| 4 | Read-Only-Parallelbetrieb & Cut-Over | offen |

Details: [docs/plan/](docs/plan/)
