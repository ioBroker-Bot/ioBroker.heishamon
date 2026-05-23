# Checksum-Algorithmus

Das CN-CNT-Protokoll verwendet **keine** klassische CRC-16/CRC-32, sondern eine simple 8-Bit-Checksum. Sie schützt nur gegen einfachste Übertragungsfehler — ist aber das, was Panasonic in der echten Hardware nutzt, also implementieren wir es identisch.

## Validierungsregel (aus der HeishaMon-Doku)

Aus [ProtocolByteDecrypt.md:214](../../vendor/heishamon-upstream/ProtocolByteDecrypt.md#L214):

> Panasonic query, answer and commands are using 8-bit Checksum to verify serial data (`sum(all bytes) & 0xFF == 0`). Last byte is checksum value.

Das heißt: die Bytesumme **inklusive Checksum-Byte** muss modulo 256 gleich Null sein. Equivalent: das Checksum-Byte ist der Wert, der die Summe der Payload-Bytes auf das nächste Vielfache von 256 ergänzt — also das **Zweierkomplement der Payload-Bytesumme**.

## Generierungs-Algorithmus

Aus dem HeishaMon-Code, [HeishaMon.ino:603 — `calcChecksum`](../../vendor/heishamon-upstream/HeishaMon/HeishaMon.ino#L603):

1. Summiere alle Payload-Bytes des Frames in einer 8-Bit-Variable (normaler Byte-Overflow, kein Modulo nötig).
2. Bitweise XOR mit `0xFF` (Einerkomplement).
3. Addiere `1` (mit Byte-Overflow, also +1 modulo 256).

Mathematisch identisch zu: **`checksum = (0 - sum_of_payload_bytes) mod 256`** (Zweierkomplement).

## Validierungs-Algorithmus

Aus [HeishaMon.ino:612 — `isValidReceiveChecksum`](../../vendor/heishamon-upstream/HeishaMon/HeishaMon.ino#L612):

1. Summiere **alle Bytes inklusive Checksum-Byte** in einer 8-Bit-Variable.
2. Wenn das Ergebnis `0x00` ist, ist die Checksum gültig.

## Position der Checksum im Frame

**Letztes Byte** des Frames (siehe HeishaMon-Doku oben und [ProtocolByteDecrypt.md:207](../../vendor/heishamon-upstream/ProtocolByteDecrypt.md#L207) — Byte 202 des 203-Byte-Antwort-Frames ist die Checksum).

Verwirrend im HeishaMon-Code: die C++-Polling-Arrays (`panasonicQuery` mit 110 Bytes, `optionalPCBQuery` mit 19 Bytes) enthalten die Checksum **nicht** — sie wird im `send_command()` zur Laufzeit berechnet und als zweites `write()` direkt angehängt. Auf dem Draht ist die Checksum aber dennoch das letzte Byte des Frames — also Frame-Länge auf dem Bus = Array-Länge + 1 für Send-Frames.

Für **Antwort-Frames** ist das anders: dort steht die Checksum bei Offset `length - 1` des empfangenen Buffers (203-Byte-Buffer → Checksum bei Index 202).

## Verifizierungsbeispiele

### Mini-Frame (synthetisch)

Sanity-Check mit nur dem Header: `[0x71, 0x6C, 0x01, 0x10]`.

1. Summe: `0x71 + 0x6C + 0x01 + 0x10 = 0xEE`
2. XOR `0xFF`: `0xEE ^ 0xFF = 0x11`
3. `+ 1`: `0x11 + 1 = 0x12`

Validierung: `0x71 + 0x6C + 0x01 + 0x10 + 0x12 = 0x100`, modulo 256 = `0x00`. ✓

### Realer Frame aus dem HeishaMon-Repo

Aus [Tools/chksumChecker.js](../../vendor/heishamon-upstream/Tools/chksumChecker.js) — der "qry"-Eintrag, das echte Haupt-Polling-Frame (111 Bytes inkl. Checksum):

```
71 6c 01 10 00 00 00 00 00 00 00 00 ... (97x 0x00) ... 12
```

Manuelle Summe: `0x71 + 0x6C + 0x01 + 0x10 = 0xEE`, dazu 105 Null-Bytes, dann `0x12` Checksum.
Gesamtsumme: `0xEE + 0x12 = 0x100`, modulo 256 = `0x00`. ✓

### Testvektor-Pool

`Tools/chksumChecker.js` enthält **76 echte Frames** (Polls, Antworten, Set-Commands) mit gültigen Checksums. Genau das, was wir in Phase 1 als Test-Suite für `crc.ts` brauchen — als Fixture-Datei übernehmen (Hex-Strings sind Tatsachen, kein urheberrechtlich geschützter Code) und automatisiert durchrechnen.

## Pseudocode für die TypeScript-Implementierung

```
function checksum(bytes: Buffer): number
    let sum = 0
    for each byte in bytes
        sum = (sum + byte) modulo 256
    return (256 - sum) modulo 256

function isValidFrame(frame: Buffer): boolean
    let sum = 0
    for each byte in frame  // including last (checksum) byte
        sum = (sum + byte) modulo 256
    return sum === 0
```

Die `(0 - x) mod 256`-Variante ist mathematisch identisch zu `(x ^ 0xFF) + 1`, aber lesbarer. In TS macht das Bit-Trickserei nichts schneller (V8 optimiert das gleich).

## Implementierungs-Hinweise für Phase 1

- Eine einzige Datei `src/crc.ts` mit zwei exportierten Funktionen: `computeChecksum(payload: Buffer): number` und `verifyFrame(frame: Buffer): boolean`.
- Beide arbeiten auf `Buffer | Uint8Array`, sind pure Funktionen, ohne Seiteneffekte.
- Unit-Tests:
  - Bekannte Hex-Frames aus dem HeishaMon-Repo (z.B. aus `Tools/chksumChecker.js` — der enthält offenbar eine Referenz-Implementierung, die wir gegenrechnen können)
  - Edge-Case: leerer Buffer → Checksum = 0
  - Edge-Case: Buffer mit Summe = 0 → Checksum = 0
  - Round-trip: `verifyFrame(concat(payload, checksum(payload))) === true`
