# HeishaMon Upstream

Dieses Verzeichnis enthält einen Snapshot des HeishaMon-Repos als **Referenzcode**. Nicht direkt editieren.

## Quelle

- Repo:       https://github.com/heishamon/HeishaMon
- Default-Branch: `main`
- Snapshot-Commit: `7b031e8f3a16711d9fd1805b7549ec11c9dacf7c` (Merge pull request #893 from IgorYbema/main, 2026-05-20)
- Clone-Datum: 2026-05-23

## Aktualisieren

Wenn ein Update gewünscht ist:

```bash
cd vendor/heishamon-upstream
git fetch origin
git checkout origin/main
git log -1 --pretty=format:'%H %ai %s'
```

Den neuen Commit-Hash dann hier oben eintragen.

## Inhalt

Wichtige Quellen für Phase 0:

- `HeishaMon/commands.cpp` / `commands.h` — Frame-Builder, Set-Commands, Optional-PCB-Antworten
- `HeishaMon/decode.cpp` / `decode.h` — Frame-Decoder, Datenpunktextraktion
- `HeishaMon/rules.cpp` / `rules.h` — Regel-Engine (für uns nicht relevant)
- `HeishaMon/dallas.cpp`, `s0.cpp` — 1-Wire / S0-Erweiterungen (Out of Scope)

Wichtige Docs für Phase 0:

- `MQTT-Topics.md` — kanonische Topic-Liste, Basis für Datenpunktnamen
- `OptionalPCB.md` — Optional-PCB-Frame-Format
- `ProtocolByteDecrypt.md` / `ProtocolByteDecrypt-extra.md` — Frame-Layout-Doku

## Siehe auch

- [LICENSE-NOTE.md](LICENSE-NOTE.md) — wichtiger Hinweis zur fehlenden expliziten Lizenz
