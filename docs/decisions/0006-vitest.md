# ADR-0006: Vitest als Test-Runner

**Status:** Accepted
**Datum:** 2026-05-23

## Kontext

Phase 1 startet die TypeScript-Bibliothek. Wir brauchen einen Test-Runner. Die Bibliothek hat hauptsächlich pure Funktionen (Frame-Encoding/-Decoding, Checksum) — Unit-Tests dominieren, Integration kommt erst in Phase 2/3.

## Entscheidung

Vitest als Test-Runner für alle Pakete im Monorepo.

## Begründung

- **Native ESM-Unterstützung** — passt zu unserer ESM-First-Konvention ([conventions.md](../memory/conventions.md)).
- **TypeScript out-of-the-box** — kein zusätzliches Setup mit `ts-jest`/Babel.
- **Schneller** als Jest, besonders im Watch-Modus.
- **Kompatible API** zu Jest (`describe`, `it`, `expect`) — Wissen aus dem JS-Ökosystem überträgt sich.
- **Coverage** über `@vitest/coverage-v8` ohne extra Konfig.

## Alternativen erwogen

- **Jest** — Standard, aber ESM-Setup ist umständlich, langsamer.
- **Node.js native test runner** (`node:test`) — leichtgewichtig, aber Snapshot-/Mock-Werkzeuge sind dünner; bei tabellengetriebenen Tests weniger ergonomisch.
- **Mocha** — kein Built-in-Assertions, mehr Boilerplate.

## Konsequenzen

- Eine Vitest-Konfig pro Paket (oder eine zentrale im Root). Wir starten paket-lokal.
- Tests liegen neben dem Code als `*.test.ts` oder in einem `test/`-Unterordner — Entscheidung paketweise.
- Coverage-Reporter wird bei Bedarf aktiviert, nicht standardmäßig.
