# Phasenplan

Das Projekt ist in fünf Phasen gegliedert. Jede Phase hat ein klares Deliverable und ein Exit-Kriterium. Wenn ein Exit-Kriterium nicht erfüllbar ist, halten wir an und überdenken — keine Phase wird übersprungen.

## Übersicht

> **Hinweis:** Die Mono-Repo-Struktur (`packages/heishamon-protocol/`, `packages/heishamon-sim/`, `packages/iobroker.heishamon/`) wurde am 2026-05-25 (Commit `c281d4f`) aufgelöst. Heute lebt der Protokoll-Code unter [`src/protocol/`](../../src/protocol/), der Simulator unter [`tools/simulator/`](../../tools/simulator/), der Adapter direkt im Repo-Root. Die nachstehenden Phasen-Deliverables wurden entsprechend wegmigriert; die Links in den Phase-Dateien zeigen noch auf die historischen Pfade.

| Phase | Titel | Status | Deliverable | Datei |
|-------|-------|--------|-------------|-------|
| 0 | Recon & Protokoll-Audit | ✅ abgeschlossen | [`docs/protocol/`](../protocol/) gefüllt | [phase-0-recon.md](phase-0-recon.md) |
| 1 | Protokoll-Bibliothek (TS) | ✅ abgeschlossen | [`src/protocol/`](../../src/protocol/), heute Teil des Adapter-Builds | [phase-1-protocol-lib.md](phase-1-protocol-lib.md) |
| 2 | WP-Simulator | ✅ abgeschlossen | [`tools/simulator/`](../../tools/simulator/), Hardware-Test gegen echtes HeishaMon erfolgreich | [phase-2-simulator.md](phase-2-simulator.md) |
| 3 | ioBroker-Adapter | ✅ abgeschlossen | Adapter ist auf [npm](https://www.npmjs.com/package/iobroker.heishamon) publiziert, läuft live an einer echten Aquarea-WP | [phase-3-adapter.md](phase-3-adapter.md) |
| 4 | Parallelbetrieb & Cut-Over | ✅ Read-only-Modus eingebaut | Read-only-Modus im Adapter implementiert; der individuelle Cut-Over passiert auf jeder Installation einmal | [phase-4-cutover.md](phase-4-cutover.md) |
| 5 | ioBroker-Repo-Aufnahme | 🟡 läuft | PR gegen [`iobroker/ioBroker.repositories`](https://github.com/iobroker/ioBroker.repositories) steht aus | — |

## Phase 1 — Offene Punkte für später

Aus der Implementierung dokumentierte Lücken (jeweils dokumentiert in den entsprechenden Commit-Messages und im Code):

- **`Sterilization_State` Encoder** ist als `notImplemented` markiert. HeishaMons `set_force_sterilization` schreibt byte 8 als One-Shot-Trigger (Wert 4), während der Decoder den Status aus byte 117 liest. Das Mapping ist asymmetrisch und sollte erst geklärt werden, bevor wir hier raten. Zu prüfen mit echter Aufzeichnung in Phase 2.
- **Multi-Byte-Set-Commands** (`set_curves`-JSON-Variante in HeishaMon, die alle 16 Kurven-Bytes in einem Frame setzt). Aktuell setzt unser Encoder pro Aufruf nur ein Curve-Byte. Falls Performance bei vielen Kurven-Änderungen relevant wird: später bündeln.
- **Optional-PCB-Encoder** (14 set_* Funktionen für Pool/Buffer/Z1-Room-Temp etc., die HeishaMon nutzt, wenn es sich als optionales PCB ausgibt) — gehört in den Simulator (Phase 2).
- **Set-Command-Antwort-Verhalten der WP** — sendet sie eine 203-Byte-Antwort? Mit Simulator in Phase 2 verifizieren.

## Leitprinzipien

1. **Die Heizung ist produktiv.** Niemals destruktive Tests gegen die echte WP, bevor Simulator + Adapter validiert sind.
2. **HeishaMon-MQTT-Topics als kanonische Referenz** für Datenpunktnamen — Migration soll wie ein Bus-Wechsel sein, nicht wie ein Neu-Aufbau.
3. **Code ist Single Source of Truth** für das Protokoll. Die HeishaMon-Doku im Repo läuft erfahrungsgemäß hinter dem Code her und wird in Phase 0 abgeglichen.
4. **Hardware-Unabhängigkeit der Protokoll-Bibliothek**: pure Funktionen, Input/Output sind Buffer. Macht alles offline testbar.
