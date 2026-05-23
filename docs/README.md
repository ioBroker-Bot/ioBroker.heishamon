# Dokumentation

Hierarchischer Einstieg in alle Projektdokumente.

## Bereiche

- **[plan/](plan/)** — Phasenplan. Was machen wir wann, mit welchen Exit-Kriterien.
- **[memory/](memory/)** — Was dauerhaft über Sessions hinweg gelten soll: Projektziele, User-Profil, Konventionen.
- **[decisions/](decisions/)** — Architecture Decision Records. Eine ADR je relevanter Entscheidung, nummeriert.
- **[agent-prompts/](agent-prompts/)** — Rollen-Definitionen für Coding- und Review-Sub-Agenten.
- **[protocol/](protocol/)** — Ergebnisse der Protokoll-Analyse aus Phase 0 (Frame-Layout, CRC, Datenpunktliste).

## Schreibkonventionen

- Eine .md-Datei pro abgrenzbares Thema. Lieber mehr kleine als wenige große.
- Jedes Verzeichnis hat eine `README.md` als Index.
- Querverweise als relative Markdown-Links.
- ADRs werden nicht editiert, sondern superseded — siehe [decisions/README.md](decisions/README.md).
- Plan-Dateien dürfen aktualisiert werden, wenn sich Scope ändert. Historie steht in git.
