# Konventionen

## Code

- **Sprache:** TypeScript für alle Pakete (Adapter, Bibliothek, Simulator). Strict mode an.
- **Test-Runner:** Vitest (oder Jest — Entscheidung in [../decisions/](../decisions/) festhalten, sobald getroffen).
- **Style:** ESLint + Prettier mit Defaults, keine Custom-Rules ohne Begründung.
- **Module:** ESM, kein CommonJS außer wo ioBroker es erzwingt.
- **Naming:** Datenpunkt-Schlüssel im Adapter und in `heishamon-protocol` sind **identisch zu den HeishaMon-MQTT-Topic-Suffixen** (case-sensitive). Das ist Pflicht, kein Vorschlag.

## Doku

- Alle nicht-flüchtigen Entscheidungen und Pläne als `.md` unter `docs/`.
- Eine `README.md` pro Verzeichnis als Index.
- Architektur-Entscheidungen als nummerierte ADRs unter `docs/decisions/`.
- Plan-Dateien dürfen aktualisiert werden, wenn sich Scope ändert (Historie in git).

## Git

- Branch `main` ist der Stamm.
- Feature-Branches je Phase / je größerer Änderung. Keine harten Vorgaben, solange `main` baubar bleibt.
- Commits in deutscher oder englischer Sprache erlaubt — innerhalb einer Branch konsistent.
- Keine `--no-verify`-Commits ohne explizite Freigabe.

## Vendor-Code

- `vendor/heishamon-upstream/` ist Referenzcode. **Nicht editieren.** Wenn Anpassungen nötig sind, eigene Patches in `vendor/heishamon-upstream/PATCHES.md` dokumentieren oder besser: das Konzept in `packages/` neu schreiben.
- Upstream-Version (Commit-Hash + URL) in `vendor/heishamon-upstream/UPSTREAM.md` festhalten.

## Memory

- Bei wichtigen neuen Erkenntnissen, die über Sessions hinweg gelten sollen, in `docs/memory/` festhalten. Bestehende Dateien updaten statt neue anlegen.
- Was nicht in Memory gehört: Tagesgeschäft, in-progress-State (das gehört in Plan-Dateien oder ist transient).
