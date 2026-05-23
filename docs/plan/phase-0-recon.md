# Phase 0 — Recon & Protokoll-Audit

## Ziel

Wir verstehen das Panasonic-CN-CNT-Protokoll so gut, dass wir es eigenständig in TypeScript reimplementieren können. Vorlage ist der HeishaMon-Code, nicht die Doku.

## Aufgaben

### 0.1 Upstream einbinden
- HeishaMon-Quellen in `vendor/heishamon-upstream/` clonen.
- Commit-Hash + Upstream-URL in `vendor/heishamon-upstream/UPSTREAM.md` festhalten, damit die Version reproduzierbar ist.
- Lizenz prüfen und in `vendor/heishamon-upstream/LICENSE-NOTE.md` zusammenfassen (was dürfen wir portieren, unter welchen Bedingungen?).

### 0.2 Code-Map
Identifiziere die relevanten Dateien:
- Frame-Generator / Polling (typisch `commands.cpp/h`)
- Frame-Decoder (typisch `decode.cpp/h`)
- CRC/Checksum-Funktion
- Topic-Tabelle (typisch eine `topics`-Liste in einer Header-Datei)
- Optional-PCB-Antwortgenerator

→ Ergebnis: [docs/protocol/code-map.md](../protocol/code-map.md) mit Dateipfaden und Funktionsnamen.

### 0.3 Frame-Layout
Dokumentiere für jedes Frame, das HeishaMon sendet oder empfängt:
- Header / Magic Bytes
- Längenfeld (falls vorhanden)
- Payload-Layout (Offset → Feld → Typ → Encoding)
- CRC-Position

→ Ergebnis: [docs/protocol/frames.md](../protocol/frames.md).

### 0.4 CRC verifizieren
- Algorithmus aus dem Code extrahieren (vermutlich 8-Bit-Modulo-Summe, kein klassisches CRC).
- An mehreren Beispiel-Frames durchrechnen.
- Pseudocode + Beispielwerte in [docs/protocol/crc.md](../protocol/crc.md).

### 0.5 Datenpunkt-Inventar
- Vollständige Liste aller Datenpunkte, die HeishaMon dekodiert.
- Pro Datenpunkt: Name (= MQTT-Topic-Suffix), Byte-Offset im Frame, Encoding, Wertebereich, Einheit, schreibbar ja/nein.
- Optional-PCB-Felder separat markiert.

→ Ergebnis: [docs/protocol/datapoints.md](../protocol/datapoints.md). Diese Liste ist später die kanonische Referenz für Phase 1 (Decoder) und Phase 3 (ioBroker-Objekte).

### 0.6 Doku/Code-Abgleich
- Doku-Dateien im HeishaMon-Repo (oft `Protocol.md`, `CN-CNT-Pinout.md`, README) gegen den Code prüfen.
- Diff-Tabelle: was steht nur in der Doku, was nur im Code, wo widerspricht es sich?

→ Ergebnis: [docs/protocol/doc-vs-code-diff.md](../protocol/doc-vs-code-diff.md).

## Deliverable

`docs/protocol/` ist gefüllt und enthält genug Information, dass Phase 1 ohne Rückgriff auf den HeishaMon-Code möglich wäre (auch wenn wir den Code als Sanity-Check daneben legen).

## Exit-Kriterium

Wir nehmen einen Beispiel-Frame (Hex-Dump aus dem HeishaMon-Repo oder rekonstruiert aus dem Code), dekodieren ihn auf dem Papier von Hand und kommen auf dieselben Werte, die HeishaMon publizieren würde.

## Nicht-Ziele in dieser Phase

- Kein Code in TypeScript schreiben.
- Keine Hardware anfassen.
- Keine Bibliotheks-Architektur entwerfen (kommt in Phase 1).
