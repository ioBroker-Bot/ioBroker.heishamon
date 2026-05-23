# Frame-Layouts

Das CN-CNT-Protokoll verwendet eine kleine Anzahl klar abgrenzbarer Frame-Typen. Alle sind binär, fester Länge pro Typ, mit Checksum als letztem Byte ([crc.md](crc.md)).

## Header-Bytes als Frame-Identifikation

Die ersten beiden Bytes identifizieren den Frame-Typ. Beobachtet in [commands.cpp](../../vendor/heishamon-upstream/HeishaMon/commands.cpp) und [chksumChecker.js](../../vendor/heishamon-upstream/Tools/chksumChecker.js):

| Header | Bedeutung | Richtung |
|--------|-----------|----------|
| `0x31 0x05` | Initial-Handshake | Master → WP |
| `0x71 0x6C` | Haupt-Poll (Read-Request) | Master → WP |
| `0x71 0xC8` | Haupt-Antwort (Response) | WP → Master |
| `0xF1 0x6C` | Haupt-Set (Write-Command) | Master → WP |
| `0xF1 0x11` | Optional-PCB-Poll | Master → WP |

Muster: Erstes Byte `0x31`/`0x71`/`0xF1` unterscheidet **Handshake/Read/Write**, zweites Byte unterscheidet **Inhalt/Richtung** (Poll vs. Response: `0x6C` vs. `0xC8`).

Quelle der Header-Bytes im Code:
- [commands.cpp:5–8](../../vendor/heishamon-upstream/HeishaMon/commands.cpp#L5) — die vier Sende-Templates
- [HeishaMon.ino:627](../../vendor/heishamon-upstream/HeishaMon/HeishaMon.ino#L627) — Proxy-Code listet `0x71`, `0x31`, `0xF1` als gültige Header-Bytes

## Frame-Typen im Detail

### 1. Initial-Handshake (Send, einmalig)

- **Größe auf dem Bus:** 7 + 1 = **8 Bytes**
- **Quelle:** [commands.cpp:5 — `initialQuery`](../../vendor/heishamon-upstream/HeishaMon/commands.cpp#L5)
- **Hex:** `31 05 10 01 00 00 00 [CK]`
- **Zweck:** Wird im HeishaMon beim Boot einmal an die WP gesendet. Vermutlich Synchronisation oder Wakeup.
- **Wichtig für uns:** Wahrscheinlich nötig, sonst antwortet die WP nicht auf nachfolgende Polls. In Phase 2 (Simulator) prüfen: muss der Simulator darauf antworten? Welche Form hat die Antwort?

### 2. Haupt-Poll (Read-Request)

- **Größe auf dem Bus:** 110 + 1 = **111 Bytes**
- **Quelle:** [commands.cpp:6 — `panasonicQuery`](../../vendor/heishamon-upstream/HeishaMon/commands.cpp#L6)
- **Hex:** `71 6C 01 10 [106x 0x00] [CK=0x12]`
- **Payload:** Alle Bytes nach dem 4-Byte-Header sind `0x00`. Es gibt also kein "was möchten wir lesen"-Selector — die WP antwortet immer mit dem kompletten Telemetrie-Block.

### 3. Haupt-Antwort (Response)

- **Größe auf dem Bus:** **203 Bytes** (inkl. Checksum, siehe [ProtocolByteDecrypt.md:207](../../vendor/heishamon-upstream/ProtocolByteDecrypt.md#L207))
- **Header:** `71 C8 01 10 ...` (siehe Beispiel "ans" in [chksumChecker.js](../../vendor/heishamon-upstream/Tools/chksumChecker.js))
- **Payload:** 199 Bytes Telemetrie (Byte-Offset 4 bis 202), Checksum bei Offset 202.
- **Inhalt:** 144 Haupt-Datenpunkte + 6 Extra-16-Bit-Power-Werte werden aus diesem Frame dekodiert. Mapping siehe [datapoints.md](datapoints.md) (entsteht im nächsten Phase-0-Schritt).

### 4. Haupt-Set (Write-Command)

- **Größe auf dem Bus:** 110 + 1 = **111 Bytes** (wie Haupt-Poll, aber anderer Header)
- **Quelle:** [commands.cpp:8 — `panasonicSendQuery`](../../vendor/heishamon-upstream/HeishaMon/commands.cpp#L8)
- **Hex (Template):** `F1 6C 01 10 [106x 0x00] [CK]`
- **Funktionsweise:** Set-Commands überschreiben einzelne Payload-Bytes des Templates. Der **erste Byte-Unterschied zum Read-Frame ist nur das Header-Byte `0xF1` statt `0x71`** — der Rest des Layouts ist identisch.
- **Beispiele aus [chksumChecker.js](../../vendor/heishamon-upstream/Tools/chksumChecker.js):**
  - "Quietmode1": Byte 7 = `0x10` (statt 0x00), Checksum entsprechend angepasst
  - "set+5C": Byte 38 = `0x85` (Temperatur + 128 = 5 + 128 = 0x85), Checksum entsprechend
- **Annahme:** Die WP antwortet auch auf Set-Commands mit einem 203-Byte-Frame. **In Phase 1/2 verifizieren.**

### 5. Optional-PCB-Poll

- **Größe auf dem Bus:** 19 + 1 = **20 Bytes**
- **Quelle:** [commands.cpp:7 — `optionalPCBQuery`](../../vendor/heishamon-upstream/HeishaMon/commands.cpp#L7)
- **Hex:** `F1 11 01 50 00 00 40 FF FF E5 FF FF 00 FF EB FF FF 00 00 [CK]`
- **Besonderheit:** Im Gegensatz zu den anderen Frames ist die Payload **nicht** komplett `0x00` — es gibt initiale Werte (`0xFF`, `0xE5`, `0xEB` etc.). Diese repräsentieren Default-Werte für die Optional-PCB-Steuerwerte (SG-Ready, externer Raumthermostat, Smart-Grid-Signale).
- **Funktionsweise:** Wenn HeishaMon sich als Optional-PCB ausgibt, schickt es diesen Frame als "Statusmeldung" — die einzelnen Bytes werden je nach gewünschtem Modus angepasst. Es gibt **keine** Antwort der WP auf diesen Frame (Annahme — in Phase 2 verifizieren).
- **Inhalt:** 7 Optional-PCB-Datenpunkte werden aus den Bytes 4–18 abgeleitet. Mapping in [datapoints.md](datapoints.md).

## ASCII-Layout-Diagramme

```
Haupt-Poll (Read, 111 Bytes total)
+----+----+----+----+--------------------------------+----+
| 71 | 6C | 01 | 10 |       106 Bytes Payload        | CK |
+----+----+----+----+--------------------------------+----+
  0    1    2    3        4 ........... 109          110

Haupt-Antwort (Response, 203 Bytes total)
+----+----+----+----+--------------------------------+----+
| 71 | C8 | 01 | 10 |       198 Bytes Payload        | CK |
+----+----+----+----+--------------------------------+----+
  0    1    2    3        4 ........... 201          202

Haupt-Set (Write, 111 Bytes total)
+----+----+----+----+--------------------------------+----+
| F1 | 6C | 01 | 10 |       106 Bytes Payload        | CK |
+----+----+----+----+--------------------------------+----+
  0    1    2    3        4 ........... 109          110

Optional-PCB (20 Bytes total)
+----+----+----+----+----+----+----+----+--...--+----+
| F1 | 11 | 01 | 50 | 00 | 00 | 40 | FF |  ...  | CK |
+----+----+----+----+----+----+----+----+--...--+----+
  0    1    2    3    4    5    6    7         19
```

## Offene Fragen

1. **Antwort der WP auf Set-Commands?** Wir vermuten 203-Byte-Frame wie auf Polls, müssen in Phase 1 mit einer realen Aufzeichnung verifizieren.
2. **Antwort auf Optional-PCB-Frames?** Wir vermuten keine, aber zu klären.
3. **Initial-Handshake — ist die Antwort darauf relevant?** Eventuell ja, weil die WP sonst nicht "wach" wird.
4. **Timing zwischen Frames** — gibt es ein Minimum-Gap? HeishaMon nutzt `waitTime` (Standard 2s) zwischen Polls, aber das ist ein Soft-Wert.

Diese Fragen klären wir, sobald wir die ersten realen Aufzeichnungen vom Bus haben (frühe Phase 2).

## Implikationen für die TypeScript-Bibliothek

- **Eine** `FrameType`-Union (`'init' | 'read' | 'response' | 'write' | 'optionalPcb'`) statt 5 Klassen.
- **Tabelle** mit `{ frameType → headerBytes, payloadLength, checksumPosition, direction }` als Single Source of Truth.
- Frame-Parser identifiziert den Typ am 2-Byte-Header und wählt die Decoder-Tabelle ([datapoints.md](datapoints.md)) entsprechend aus.
- Set-Command-Encoder ist eine generische Funktion: nimmt Datenpunkt-Name + Wert + Basis-Template, schreibt das Encoding an den Tabellen-Offset und berechnet die Checksum neu.
