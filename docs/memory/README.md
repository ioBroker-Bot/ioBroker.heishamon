# Memory

Persistenter Projekt-Kontext: was zu jedem Zeitpunkt über das Projekt, den Benutzer und die getroffenen Konventionen gelten soll. Diese Dateien werden bewusst kurz gehalten und aktuell gepflegt — sie sind keine Historie (dafür gibt es `git log`), sondern der jeweils aktuelle Stand.

## Aktuelle Memories

- [status.md](status.md) — **Aktueller Stand**: Phasen, Tests, offene Lücken (wird bei jedem Meilenstein aktualisiert)
- [project-goal.md](project-goal.md) — Was wir bauen und warum
- [user-profile.md](user-profile.md) — Wer den Adapter entwickelt und betreibt
- [conventions.md](conventions.md) — Code-, Doku- und Workflow-Konventionen
- [safety-rules.md](safety-rules.md) — Was im Umgang mit der produktiven Heizung tabu ist

## Pflegeregeln

- **Aktuell halten:** Wenn ein Fakt sich ändert, Datei updaten — nicht eine neue mit Datum anlegen.
- **Kurz halten:** Eine Seite reicht. Wenn mehr Detail nötig wird, gehört es in `docs/plan/`, `docs/protocol/` oder `docs/decisions/`.
- **Querverweise:** Wenn ein Fakt eine längere Begründung hat, auf den ADR verlinken statt sie hier zu wiederholen.
