# ADR-0001: TypeScript als Implementierungssprache

**Status:** Accepted
**Datum:** 2026-05-23

## Kontext

Der Adapter muss in ioBroker laufen (Node.js). Die Wahl steht zwischen plain JavaScript und TypeScript für Adapter, Protokoll-Bibliothek und Simulator.

## Entscheidung

Alle Pakete (Adapter, `heishamon-protocol`, `heishamon-sim`) werden in TypeScript mit `strict: true` geschrieben.

## Begründung

- Das Protokoll hat ~200 Datenpunkte mit unterschiedlichen Encodings — Typsicherheit hilft, beim Refactoring nichts zu übersehen.
- Aktueller Standard für neue ioBroker-Adapter, das Template (`@iobroker/create-adapter`) bietet eine ausgereifte TS-Variante.
- Bessere IDE-Unterstützung beim Arbeiten an einer ungewohnten Codebasis.

## Alternativen erwogen

- **Plain JavaScript** — weniger Boilerplate, aber bei Frame-Layouts und Datenpunkttabellen ist die Typprüfung ein echter Wert. Verworfen.

## Konsequenzen

- Build-Step nötig (`tsc`).
- ESM-only-Konflikte mit älteren ioBroker-Abhängigkeiten möglich — wird beim Adapter-Setup geprüft.
