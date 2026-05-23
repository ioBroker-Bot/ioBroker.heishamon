# Phasenplan

Das Projekt ist in fünf Phasen gegliedert. Jede Phase hat ein klares Deliverable und ein Exit-Kriterium. Wenn ein Exit-Kriterium nicht erfüllbar ist, halten wir an und überdenken — keine Phase wird übersprungen.

## Übersicht

| Phase | Titel | Deliverable | Datei |
|-------|-------|-------------|-------|
| 0 | Recon & Protokoll-Audit | `docs/protocol/`-Inhalt | [phase-0-recon.md](phase-0-recon.md) |
| 1 | Protokoll-Bibliothek (TS) | `packages/heishamon-protocol/` | [phase-1-protocol-lib.md](phase-1-protocol-lib.md) |
| 2 | WP-Simulator | `packages/heishamon-sim/` | [phase-2-simulator.md](phase-2-simulator.md) |
| 3 | ioBroker-Adapter | `packages/iobroker.heishamon/` | [phase-3-adapter.md](phase-3-adapter.md) |
| 4 | Parallelbetrieb & Cut-Over | Heizung läuft am neuen Adapter | [phase-4-cutover.md](phase-4-cutover.md) |

## Leitprinzipien

1. **Die Heizung ist produktiv.** Niemals destruktive Tests gegen die echte WP, bevor Simulator + Adapter validiert sind.
2. **HeishaMon-MQTT-Topics als kanonische Referenz** für Datenpunktnamen — Migration soll wie ein Bus-Wechsel sein, nicht wie ein Neu-Aufbau.
3. **Code ist Single Source of Truth** für das Protokoll. Die HeishaMon-Doku im Repo läuft erfahrungsgemäß hinter dem Code her und wird in Phase 0 abgeglichen.
4. **Hardware-Unabhängigkeit der Protokoll-Bibliothek**: pure Funktionen, Input/Output sind Buffer. Macht alles offline testbar.
