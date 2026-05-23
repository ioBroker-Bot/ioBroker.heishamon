# Agent-Prompts

Diese Dateien definieren die Rollen für die Sub-Agenten, die in diesem Projekt zum Einsatz kommen. Sie werden vom Haupt-Assistenten beim Aufruf eines Agents als verbindlicher Kontext mitgegeben.

## Verfügbare Rollen

- [coding-agent.md](coding-agent.md) — schreibt oder erweitert TypeScript-Code
- [review-agent.md](review-agent.md) — reviewt bestehenden Code systematisch

## Warum eigene Agents

- **Eigene Context-Windows:** Recherche- und Code-Inhalte verschmutzen nicht den Hauptkontext.
- **Klar abgegrenzte Rollen:** Ein Coding-Agent schreibt, ein Review-Agent kritisiert. Trennung erzwingt Disziplin.
- **Konsistente Code-Qualität:** Jeder Coding-Agent startet mit denselben Regeln.

## Aufruf-Pattern

Der Haupt-Assistent ruft Agents typischerweise so auf:

> "Lies zuerst `docs/agent-prompts/coding-agent.md` — das sind deine verbindlichen Regeln.
> Aufgabe: [konkrete Aufgabe]
> Relevante Dateien: [Pfade]
> Erwartetes Ergebnis: [Beschreibung]"

Siehe [../decisions/0005-agent-workflow.md](../decisions/0005-agent-workflow.md) für den Hintergrund.

## Reviews

Reviews sind token-intensiv. Sie werden **nur nach expliziter Absprache mit dem User** angestoßen, nicht automatisch nach jeder Code-Änderung.
