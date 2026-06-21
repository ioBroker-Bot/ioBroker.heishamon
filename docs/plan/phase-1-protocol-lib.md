# Phase 1 — Protokoll-Bibliothek (`heishamon-protocol`)

> **ARCHIV.** Phase 1 ist abgeschlossen. Die Bibliothek wurde am 2026-05-25 (Commit `c281d4f`) aus dem damaligen Workspace `packages/heishamon-protocol/` in den Adapter integriert und lebt heute unter [`src/protocol/`](../../src/protocol/). Pfade weiter unten zeigen noch auf die historische Mono-Repo-Struktur.

## Ziel

Reine TypeScript-Bibliothek, die Buffer ↔ Datenpunkte konvertiert. Keine Hardware-Abhängigkeit, vollständig offline testbar.

## Voraussetzung

Phase 0 abgeschlossen, `docs/protocol/` ist die kanonische Referenz.

## Aufgaben

### 1.1 Monorepo-Setup
- npm-Workspaces unter `packages/`.
- Erstes Paket: `packages/heishamon-protocol/`.
- TypeScript strict mode, ESLint, Vitest (oder Jest) als Test-Runner.
- CI-Stub (GitHub Actions oder einfach lokales `npm test`-Script).

### 1.2 Module
- `src/crc.ts` — Checksum-Berechnung. Pure Funktion `crc(buf: Buffer): number`.
- `src/frames.ts` — Frame-Builder für die verschiedenen Polling- und Set-Frames.
- `src/decoder.ts` — Tabellen-getriebener Decoder. Nimmt einen Antwort-Frame, gibt `Record<string, value>` zurück. **Kein** if-Wasserfall für 200 Felder; die Tabelle aus Phase 0 wird zur Datenstruktur.
- `src/encoder.ts` — Set-Command-Builder (Ziel-Temperatur ändern, Modus wechseln etc.).
- `src/datapoints.ts` — exportierte kanonische Datenpunktliste mit Metadaten (Name, Typ, Einheit, Range, RW).
- `src/index.ts` — Public API.

### 1.3 Tests
- Unit-Tests für CRC mit bekannten Werten.
- Round-trip-Tests: bekannter Frame → Decoder → erwartete Werte; bekannte Werte → Encoder → erwarteter Frame.
- Property-basierte Tests für Wertebereiche (optional).

### 1.4 Naming-Konvention
- Datenpunkt-Schlüssel **exakt identisch** zu HeishaMon-MQTT-Topics (ohne Topic-Präfix). Das ist die Grundlage für nahtlose Adapter-Migration.

## Deliverable

`packages/heishamon-protocol/` mit:
- Vollständigen Decodern für Haupt- + Optional-PCB-Frames
- Vollständigen Encodern für Set-Commands
- ≥ 90% Testabdeckung auf der Frame-Logik

## Exit-Kriterium

Alle in Phase 0 erfassten Datenpunkte werden korrekt aus einem aufgezeichneten Beispiel-Frame extrahiert. CI grün.

## Nicht-Ziele

- Kein `serialport`, keine I/O.
- Keine ioBroker-Anbindung.
- Keine Auto-Reconnect-Logik (gehört in Phase 2/3).
