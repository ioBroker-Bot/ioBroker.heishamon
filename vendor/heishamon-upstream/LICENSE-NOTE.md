# Lizenz-Hinweis zu HeishaMon

## Befund

Im HeishaMon-Repo (Stand Snapshot 2026-05-23) konnte **keine explizite Lizenz-Datei** gefunden werden:

- Kein `LICENSE`, `LICENCE`, `COPYING` o.ä. im Repo-Root.
- Keine Lizenz-Header in den Quellen.
- Kein klarer Lizenzhinweis im README.

Nach US-/EU-Urheberrecht bedeutet das: **alle Rechte beim Autor**. Ohne explizite Erlaubnis dürfen wir Code **nicht** 1:1 kopieren oder direkt portieren.

## Was bedeutet das für uns

- Der Code dient **ausschließlich als Referenz** zum Verstehen des Protokolls.
- Unsere TypeScript-Implementierung in `packages/heishamon-protocol/` wird **clean-room** geschrieben: Wir lesen die HeishaMon-Quellen, dokumentieren das Protokoll in `docs/protocol/`, und implementieren dann aus der Doku heraus.
- Keine direkten Kopien von Code-Snippets in unsere Pakete.
- Doku-Dateien im HeishaMon-Repo (`MQTT-Topics.md`, `OptionalPCB.md`, `ProtocolByteDecrypt.md`) sind **Beschreibungen des Protokolls** und damit Tatsacheninformation, kein urheberrechtlich geschützter Code — sie können als Quelle zitiert werden.

## Empfohlenes Vorgehen

1. Frage in einem GitHub-Issue beim HeishaMon-Projekt höflich nach einer Lizenz-Klarstellung (z.B. MIT, GPL-v3). Das hilft auch der Community.
2. Bis dahin: clean-room-Ansatz wie oben beschrieben.

## Hintergrund

Das CN-CNT-Protokoll ist von Panasonic nicht öffentlich dokumentiert. Was die HeishaMon-Community herausgefunden hat, ist eine Beobachtung der Realität — Tatsachen sind nicht urheberrechtlich schützbar. Die konkrete Implementierung dieser Erkenntnisse in C++ ist dagegen ein urheberrechtlich geschütztes Werk.
