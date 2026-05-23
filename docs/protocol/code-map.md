# Code-Map: HeishaMon → relevante Quellen für unser Protokoll-Layer

Diese Datei zeigt, **wo** im HeishaMon-Snapshot ([vendor/heishamon-upstream/](../../vendor/heishamon-upstream/)) die Bestandteile des CN-CNT-Protokolls implementiert sind. Sie dient als Navigationshilfe für die anderen Phase-0-Dokumente (`frames.md`, `crc.md`, `datapoints.md`).

Hinweis: Wir portieren keinen Code 1:1 (siehe [LICENSE-NOTE.md](../../vendor/heishamon-upstream/LICENSE-NOTE.md)). Diese Datei beschreibt nur den Aufbau.

## Relevante Dateien

| Datei | Zweck | LOC |
|-------|-------|-----|
| [HeishaMon.ino](../../vendor/heishamon-upstream/HeishaMon/HeishaMon.ino) | Main-Loop, UART-Setup, Send/Receive, Checksum | ~2100 |
| [commands.h](../../vendor/heishamon-upstream/HeishaMon/commands.h) | Frame-Größen-Konstanten, Set-Command-Signaturen | ~200 |
| [commands.cpp](../../vendor/heishamon-upstream/HeishaMon/commands.cpp) | Polling-Frame-Templates (Byte-Arrays), Set-Command-Funktionen | ~1283 |
| [decode.h](../../vendor/heishamon-upstream/HeishaMon/decode.h) | **Datenpunkt-Tabellen** (Names, Offsets, Decoder-Funktionen) | ~730 |
| [decode.cpp](../../vendor/heishamon-upstream/HeishaMon/decode.cpp) | Decoder-Implementierungen, Frame-Iteration | ~400 |

Nicht relevant für unser Protokoll-Layer (aber im Repo): `rules.cpp`, `webfunctions.cpp`, `dallas.cpp`, `s0.cpp`, `HeishaOT.cpp`, alles in `src/`.

## 1. Frame-Sending / Polling

- Sende-Funktion: [HeishaMon.ino:916 — `send_command()`](../../vendor/heishamon-upstream/HeishaMon/HeishaMon.ino#L916). Berechnet die Checksum über das Frame-Array und schreibt **Array + Checksum-Byte** als zwei Schreibvorgänge auf die UART.

Drei Polling-Templates, alle in [commands.cpp](../../vendor/heishamon-upstream/HeishaMon/commands.cpp):

| Template | Größe | Verwendung |
|----------|-------|------------|
| `initialQuery` | 7 Bytes | Einmalig beim Boot zur Initialisierung |
| `panasonicQuery` | 110 Bytes (+ 1 Byte Checksum) | Haupt-Polling und Basis für alle Set-Commands |
| `optionalPCBQuery` | 19 Bytes (+ 1 Byte Checksum) | Optional-PCB-Polling |

Header der Haupt-Frames:
- Haupt-Poll/Set: erste zwei Bytes `0x71 0x6C`, dann Command-Byte `0x01`, dann Subcommand
- Optional-PCB-Poll: erste zwei Bytes `0xF1 0x11`

## 2. Frame-Receiving / Decoding

- Decode-Einstieg: [decode.cpp:292 — `decode_heatpump_data()`](../../vendor/heishamon-upstream/HeishaMon/decode.cpp#L292). Iteriert über alle Topics, ruft pro Topic die zugehörige Decoder-Funktion auf und publiziert per MQTT (das wird in unserem Adapter durch "in den ioBroker-Objekttree schreiben" ersetzt).
- Per-Topic-Decode: [decode.cpp:158 — `getDataValue()`](../../vendor/heishamon-upstream/HeishaMon/decode.cpp#L158)

Datenpunkt-Tabellen in [decode.h](../../vendor/heishamon-upstream/HeishaMon/decode.h) — **das ist die wichtigste Datei für Phase 0**:

- [decode.h:78–223](../../vendor/heishamon-upstream/HeishaMon/decode.h#L78) — `topics[]`: 144 Namen für Haupt-Frame-Datenpunkte (TOP0–TOP143)
- [decode.h:225–370](../../vendor/heishamon-upstream/HeishaMon/decode.h#L225) — `topicBytes[]`: Byte-Offsets dieser 144 Topics im 203-Byte-Antwort-Frame
- [decode.h:384–529](../../vendor/heishamon-upstream/HeishaMon/decode.h#L384) — `topicFunctions[]`: Decoder-Funktion pro Topic (z.B. `getIntMinus128`, `getPower`, Bit-Extraktoren)
- Weiter unten in derselben Datei: `optTopics[]` (7 Optional-PCB-Datenpunkte, OPT0–OPT6) und `xtopics[]` (6 Extra-16-Bit-Datenpunkte, XTOP0–XTOP5)

Datenpunkt-Inventar (Stand Snapshot 2026-05-20):

| Quelle | Anzahl |
|--------|--------|
| Haupt-Frame | 144 |
| Optional-PCB | 7 |
| Extra (16-Bit-Power-Werte) | 6 |
| **Gesamt** | **157** |

## 3. Checksum

- Implementierung: [HeishaMon.ino:603 — `calcChecksum()`](../../vendor/heishamon-upstream/HeishaMon/HeishaMon.ino#L603)
- Validierung beim Empfang: [HeishaMon.ino:617 — `isValidReceiveChecksum()`](../../vendor/heishamon-upstream/HeishaMon/HeishaMon.ino#L617)

Algorithmus (verbale Beschreibung — Implementierungs-Details in [crc.md](crc.md)):
1. 8-Bit-Summe aller Frame-Bytes bilden (Modulo 256, normaler Byte-Overflow).
2. Ergebnis bitweise mit `0xFF` XOR-verknüpfen.
3. `1` addieren (8-Bit, mit Overflow).

Das ist effektiv das **Zweierkomplement der Bytesumme**. Ein gültiger Frame plus seine Checksum summieren modulo 256 zu Null.

Position der Checksum: **direkt hinter** dem Frame-Array, nicht innerhalb. Beim Senden zwei separate Writes. Beim Empfang ist die Antwort 203 Bytes inkl. Checksum-Byte am Ende.

## 4. Set-Commands

- Es gibt **keine** zentrale "build-set-command"-Funktion. Stattdessen ~44 spezialisierte Funktionen in [commands.cpp](../../vendor/heishamon-upstream/HeishaMon/commands.cpp), eine pro steuerbarem Parameter.
- Muster pro Funktion:
  1. Globalen `panasonicSendQuery`-Puffer als Basis verwenden (Kopie der `panasonicQuery`)
  2. Ein oder mehrere spezifische Byte-Offsets je nach Parameter überschreiben
  3. Länge zurückgeben

Beispiele:
- [commands.cpp:47 — `set_heatpump_state()`](../../vendor/heishamon-upstream/HeishaMon/commands.cpp#L47)
- [commands.cpp:112 — `set_quiet_mode()`](../../vendor/heishamon-upstream/HeishaMon/commands.cpp#L112) — Byte 7 = `(mode + 1) * 8`
- [commands.cpp:132 — `set_z1_heat_request_temperature()`](../../vendor/heishamon-upstream/HeishaMon/commands.cpp#L132) — Byte 38 = Temperatur + 128
- [commands.cpp:402 — `set_operation_mode()`](../../vendor/heishamon-upstream/HeishaMon/commands.cpp#L402) — Byte 6 = Mode-Code per Switch-Case

**Wichtig:** Set-Commands haben **dasselbe Frame-Format** wie der Haupt-Poll (110 Bytes + Checksum). Sie unterscheiden sich nur durch geänderte Payload-Bytes. Kein separater Frame-Typ.

Für unsere TypeScript-Implementierung impliziert das einen **tabellengetriebenen** Encoder: eine Tabelle mit `{ datapointName → byteOffset → encodingFn }` und eine generische `encodeSetCommand(datapoint, value)`-Funktion, statt 44 Einzelfunktionen.

## 5. Polling-Loop und UART-Setup

Main-Loop: ab [HeishaMon.ino:1986](../../vendor/heishamon-upstream/HeishaMon/HeishaMon.ino#L1986).

Timings:
- Haupt-Poll: alle `heishamonSettings.waitTime` Sekunden (Standard ~2 s, konfigurierbar)
- Optional-PCB-Poll: alle 1000 ms (Konstante [`OPTIONALPCBQUERYTIME`](../../vendor/heishamon-upstream/HeishaMon/commands.h#L14))
- Optional-PCB-State persistieren (im HeishaMon zu Flash): alle 300 s (`OPTIONALPCBSAVETIME`) — für uns irrelevant, Persistenz macht ioBroker selbst

Receive-Verhalten: [HeishaMon.ino:693 — `readSerial()`](../../vendor/heishamon-upstream/HeishaMon/HeishaMon.ino#L693). Wartet auf 203-Byte-Response, Timeout [`SERIALTIMEOUT`](../../vendor/heishamon-upstream/HeishaMon/HeishaMon.ino#L58) = 2000 ms.

UART-Konfiguration: [HeishaMon.ino:1537 — `switchSerial()`](../../vendor/heishamon-upstream/HeishaMon/HeishaMon.ino#L1537).
- **Baudrate: 9600 bps**
- **Format: 8 Datenbits, Even Parity, 1 Stopbit (`8E1`)**
- (ESP-spezifische Pin-Mappings sind für uns irrelevant — auf dem Pi nehmen wir den Linux-Devicepfad.)

## Implikationen für unsere TypeScript-Bibliothek

Die Code-Map zeigt, dass das Protokoll-Layer in TS deutlich kompakter werden kann als HeishaMons C++:

- **Eine** Send-Funktion (statt 44 Set-Command-Funktionen): tabellengetrieben.
- **Eine** Decode-Funktion: gleiche Tabelle, andere Richtung.
- **Eine** Tabelle pro Frame-Typ (Main + Optional-PCB) — die ist das Herzstück und kommt in [`datapoints.md`](datapoints.md).
- Pure Funktionen, keine globalen Puffer.

Diese Tabelle bauen wir in Phase 0 (`datapoints.md`) und in Phase 1 als `packages/heishamon-protocol/src/datapoints.ts`.
