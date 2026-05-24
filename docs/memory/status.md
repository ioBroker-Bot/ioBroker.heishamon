# Aktueller Stand

Snapshot Ende der Session vom 2026-05-24. Wird bei jedem größeren Meilenstein aktualisiert. Für tagesaktuelle Details: `git log --oneline | head -20` und `docs/plan/README.md`.

## Phasen

| Phase | Stand |
|---|---|
| 0 — Recon & Protokoll-Audit | ✅ fertig — `docs/protocol/` gefüllt (code-map, frames, crc, datapoints, doc-vs-code-diff) |
| 1 — `heishamon-protocol` Library | ✅ fertig — 330 Tests, 6 Module |
| 2 — `heishamon-sim` Simulator | 🟡 in-process komplett — 176 Tests; **Hardware-Test gegen echtes HeishaMon-Modul erfolgreich** (User-Report: "100% korrekte Kommunikation") |
| 3 — `iobroker.heishamon` Adapter | 🟡 in-process komplett — 30 Tests; Install in ioBroker + Test gegen Simulator offen |
| 4 — Parallelbetrieb & Cut-Over | offen |

**Test-Summe: 536 grün** über alle drei Pakete.

## Was als nächstes ansteht

1. **Adapter in ioBroker installieren** — Anleitung (`INSTALL.md`) steht noch aus. Pragmatisch: `iobroker url <path-to-package>` oder lokales Tarball.
2. **Adapter gegen Simulator testen** — Vorerst lokal verkabelt (zwei USB-RS485) oder per `socat` virtuell. Erwartung: alle 157 Datapoints füllen sich im Object-Tree, Set-Commands aus ioBroker landen im Simulator-State.
3. **Phase 4** — Parallelbetrieb mit echter Heizung im Read-Only-Modus (im Adapter eingebaut), Datenpunkte-Vergleich mit produktivem HeishaMon, dann Cut-Over.

## Bekannte Lücken / Followups (klein)

- **`Sterilization_State` Encoder** ist `notImplemented` — HeishaMons `set_force_sterilization` schreibt byte 8 als One-Shot-Trigger (Wert 4), während der Decoder den Status aus byte 117 liest. Asymmetrisches Mapping, sollte mit echter WP-Aufzeichnung geklärt werden.
- **`optionalPcbPollEnabled` Config-Flag** im Adapter existiert, aber Poller alterniert noch nicht zwischen drei Frame-Typen — nur main/extra.
- **Initial-Handshake-Antwort** der WP ist nicht beobachtet. Simulator ignoriert den Frame, das hat im Hardware-Test funktioniert.
- **Set-Command-Response der WP** ist nicht beobachtet. Simulator antwortet nicht, HeishaMon-Pattern ist fire-and-forget.
- **Multi-Byte `set_curves`-Bundle** wird nicht unterstützt — Encoder schreibt pro Aufruf nur ein Curve-Byte. Performance-Optimierung für später.
- **Optional-PCB-Encoder** (14 `set_*`-Funktionen für Pool/Buffer/Z1-Room-Temps etc.) ist nicht implementiert — gehört in den Simulator bzw. in einen späteren Adapter-Modus, in dem der Adapter selbst die PCB-Rolle emuliert.

## Letzte Commits (Phase 3, von neu nach alt)

```
97de304  Phase 3 in-process komplett: Status-Updates
5cea6a3  Phase 3.4: Admin-UI jsonConfig.json + i18n (en/de)
9a77789  Phase 3.3b: main.ts — Adapter-Lifecycle
77e0b31  Phase 3.3a: transport.ts + poller.ts + state-applier.ts
1d665c9  Phase 3.1+3.2: Skeleton + object-tree
f3fd1dc  Refactor: Framer von heishamon-sim nach heishamon-protocol
```
