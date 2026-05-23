# Architecture Decision Records (ADRs)

Bedeutsame, nicht-triviale Entscheidungen werden hier als nummerierte ADRs festgehalten.

## Format

Jede ADR hat den Namen `NNNN-kurztitel.md` und folgendes Layout:

```markdown
# ADR-NNNN: Titel

**Status:** Accepted | Superseded by ADR-XXXX | Rejected
**Datum:** YYYY-MM-DD

## Kontext
Worum geht es, welches Problem steht an.

## Entscheidung
Was wir machen.

## Begründung
Warum genau das und nicht die Alternativen.

## Alternativen erwogen
- Variante A — verworfen, weil ...
- Variante B — verworfen, weil ...

## Konsequenzen
Was sich daraus ergibt, welche Folgekosten/-vorteile entstehen.
```

## Pflegeregeln

- ADRs werden **nicht editiert**, sondern superseded. Wenn eine Entscheidung revidiert wird:
  1. Neue ADR mit neuer Nummer schreiben.
  2. Im Status der alten ADR: `Superseded by ADR-XXXX`.
- Nummerierung ist fortlaufend, nicht thematisch gruppiert.

## Aktuelle ADRs

- [0001-language-typescript.md](0001-language-typescript.md) — TypeScript als Implementierungssprache
- [0002-monorepo-structure.md](0002-monorepo-structure.md) — npm-Workspaces mit `packages/`
- [0003-simulator-first.md](0003-simulator-first.md) — Simulator vor Adapter-Entwicklung
- [0004-datapoint-naming.md](0004-datapoint-naming.md) — HeishaMon-MQTT-Topic-Namen als Kanon
- [0005-agent-workflow.md](0005-agent-workflow.md) — Coding-/Review-/Explore-Agents als Standardwerkzeuge
- [0006-vitest.md](0006-vitest.md) — Vitest als Test-Runner
