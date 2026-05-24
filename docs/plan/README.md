# Phasenplan

Das Projekt ist in fünf Phasen gegliedert. Jede Phase hat ein klares Deliverable und ein Exit-Kriterium. Wenn ein Exit-Kriterium nicht erfüllbar ist, halten wir an und überdenken — keine Phase wird übersprungen.

## Übersicht

| Phase | Titel | Status | Deliverable | Datei |
|-------|-------|--------|-------------|-------|
| 0 | Recon & Protokoll-Audit | ✅ abgeschlossen | [`docs/protocol/`](../protocol/) gefüllt | [phase-0-recon.md](phase-0-recon.md) |
| 1 | Protokoll-Bibliothek (TS) | ✅ abgeschlossen | [`packages/heishamon-protocol/`](../../packages/heishamon-protocol/), 316 Tests | [phase-1-protocol-lib.md](phase-1-protocol-lib.md) |
| 2 | WP-Simulator | 🟡 in-process komplett, Hardware-Test ausstehend | [`packages/heishamon-sim/`](../../packages/heishamon-sim/), 190 Tests | [phase-2-simulator.md](phase-2-simulator.md) |
| 3 | ioBroker-Adapter | offen | `packages/iobroker.heishamon/` | [phase-3-adapter.md](phase-3-adapter.md) |
| 4 | Parallelbetrieb & Cut-Over | offen | Heizung läuft am neuen Adapter | [phase-4-cutover.md](phase-4-cutover.md) |

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
