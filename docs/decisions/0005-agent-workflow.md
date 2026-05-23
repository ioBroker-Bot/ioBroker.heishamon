# ADR-0005: Sub-Agenten für Coding, Review und Recherche

**Status:** Accepted
**Datum:** 2026-05-23

## Kontext

Das Projekt arbeitet mit einem KI-Assistenten (Claude Code). Der Haupt-Assistent hat ein begrenztes Context-Window. Wenn Code lesen, Code schreiben und Code reviewen alles im selben Kontext passieren, verschmutzt das den Hauptthread mit Quellcode-Inhalten und macht den Assistenten in späteren Sessions weniger effektiv.

Außerdem profitiert Code-Qualität davon, wenn Schreiben und Kritisieren von unterschiedlichen Instanzen mit klar definierten Rollen gemacht werden — Trennung erzwingt Disziplin.

## Entscheidung

Drei Arten von Sub-Agenten kommen zum Einsatz:

1. **Coding-Agent** — schreibt oder verändert TypeScript-Code. Prompt-Definition: [../agent-prompts/coding-agent.md](../agent-prompts/coding-agent.md).
2. **Review-Agent** — reviewt Code systematisch nach Schweregraden. Prompt-Definition: [../agent-prompts/review-agent.md](../agent-prompts/review-agent.md).
3. **Explore-Agent** (eingebaut in Claude Code) — read-only-Recherche, Mapping von Symbolen, Doku-Abgleich.

Jeder Agent hat sein eigenes Context-Window. Der Hauptthread sieht nur die zusammengefassten Ergebnisse.

## Begründung

- **Kontext-Hygiene:** Hauptthread bleibt schlank, längere Sessions möglich.
- **Konsistente Qualität:** Coding-Agents starten immer mit denselben Regeln — keine Drift zwischen "frühe Files" und "späte Files".
- **Saubere Trennung:** Wer Code schreibt, ist nicht der Beste, um ihn zu kritisieren. Review-Agent kommt frisch ans Problem.
- **Reviews sind teuer:** Reviews verbrauchen viele Tokens (gesamtes Diff + Regeln + Reasoning). Sie laufen daher **nicht automatisch**, sondern nach Absprache mit dem User.

## Alternativen erwogen

- **Alles im Hauptthread machen** — verworfen, Context-Hygiene leidet, Sessions werden kurz.
- **Reviews automatisch nach jedem Coding-Schritt** — verworfen, zu teuer, der User soll entscheiden, wann ein Review fällig ist.
- **Externer Reviewer (z.B. /ultrareview)** — sinnvoll für größere Meilensteine, nicht für Routine-Reviews innerhalb des Projekts.

## Konsequenzen

- Vor Code-Aufgaben: Coding-Agent spawnen, ihn auf [../agent-prompts/coding-agent.md](../agent-prompts/coding-agent.md) verweisen.
- Vor Reviews: Mit dem User abklären, ob ein Review jetzt sinnvoll ist.
- Vor Recherche-Aufgaben (>2 Files): Explore-Agent statt direkter Tool-Aufrufe.
- Agent-Prompt-Dateien werden gepflegt — wenn Konventionen sich ändern, muss [../agent-prompts/](../agent-prompts/) mitgezogen werden.
