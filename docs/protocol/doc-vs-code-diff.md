# HeishaMon-Doku vs. Code — Abgleich

Diese Datei vergleicht die Doku-Dateien im HeishaMon-Repo (`MQTT-Topics.md`, `ProtocolByteDecrypt.md`, `ProtocolByteDecrypt-extra.md`, `OptionalPCB.md`) mit dem tatsächlichen Code. Code ist Single Source of Truth, die Doku ist meist konsistent — aber nicht immer vollständig.

## Übereinstimmungen

| Aspekt | Doku | Code | Status |
|--------|------|------|--------|
| Anzahl TOPs (Haupt) | 144 (TOP0–TOP143 in [MQTT-Topics.md](../../vendor/heishamon-upstream/MQTT-Topics.md)) | 144 (`topics[]` in [decode.h](../../vendor/heishamon-upstream/HeishaMon/decode.h)) | ✓ Match |
| Anzahl OPTs | 7 (OPT0–OPT6) | 7 | ✓ Match |
| Checksum-Algorithmus | "sum(all bytes) & 0xFF == 0" ([ProtocolByteDecrypt.md:214](../../vendor/heishamon-upstream/ProtocolByteDecrypt.md#L214)) | Zweierkomplement der Bytesumme ([HeishaMon.ino:603](../../vendor/heishamon-upstream/HeishaMon/HeishaMon.ino#L603)) | ✓ Mathematisch äquivalent |
| Response-Frame-Größe | 203 Bytes ([ProtocolByteDecrypt.md:207](../../vendor/heishamon-upstream/ProtocolByteDecrypt.md#L207)) | 203 (`DATASIZE` in [commands.h](../../vendor/heishamon-upstream/HeishaMon/commands.h)) | ✓ Match |
| Checksum-Position | "Last byte" | Letztes Byte des Frames | ✓ Match |
| Set-Command-Format | dokumentiert in [MQTT-Topics.md](../../vendor/heishamon-upstream/MQTT-Topics.md) als "SET#" | implementiert in [commands.cpp](../../vendor/heishamon-upstream/HeishaMon/commands.cpp) als `set_*`-Funktionen | ✓ Konsistent (Stichproben) |

## Lücken in der Doku

### 1. XTOPs (Extra-16-Bit-Datenpunkte) fehlen in `MQTT-Topics.md`

**Befund:** [`decode.h`](../../vendor/heishamon-upstream/HeishaMon/decode.h) definiert 6 zusätzliche Datenpunkte (XTOP0–XTOP5) für Energieverbrauchs- und Erzeugungswerte mit 16-Bit-Genauigkeit. In [`MQTT-Topics.md`](../../vendor/heishamon-upstream/MQTT-Topics.md) sind diese **nicht aufgeführt** (`grep -c "^XTOP" → 0`).

**Wo sie dokumentiert sind:** [`ProtocolByteDecrypt-extra.md`](../../vendor/heishamon-upstream/ProtocolByteDecrypt-extra.md) beschreibt das Frame-Layout für den Extra-Block, aber ohne die Topic-Namen, die HeishaMon dafür intern benutzt.

**Auswirkung:** Für Phase 1 müssen wir die Namen aus dem Code übernehmen (siehe [datapoints.md](datapoints.md), Tabelle 3) und sicherstellen, dass sie für den ioBroker-Objekttree korrekt verwendet werden.

### 2. "Extra-Query"-Frame ist ein separater Frame-Typ, nicht eine Antwort-Variante

**Befund:** Unsere bisherige [frames.md](frames.md) listet die WP-Antwort als einen einzigen 203-Byte-Frame `71 C8 01 10 ...`. Tatsächlich gibt es einen **zweiten Antwort-Frame** `71 C8 01 21 ...`, der die XTOPs trägt. Aus [ProtocolByteDecrypt-extra.md](../../vendor/heishamon-upstream/ProtocolByteDecrypt-extra.md):

> "This is 0x21 for new data block"

Der Trigger laut [ProtocolByteDecrypt.md:204](../../vendor/heishamon-upstream/ProtocolByteDecrypt.md#L204): wenn TOP[199] der normalen Antwort `>= 0x03` ist, fragt der Master mit einem zusätzlichen Poll den Extra-Block ab (Implementierung in HeishaMon ist im Detail zu prüfen).

**Auswirkung:** [frames.md](frames.md) muss um diesen sechsten Frame-Typ ergänzt werden.

### 3. Initial-Handshake (`0x31 0x05 ...`) ist in der Doku nicht erwähnt

**Befund:** Code hat `initialQuery[7]` in [commands.cpp:5](../../vendor/heishamon-upstream/HeishaMon/commands.cpp#L5), das beim Boot gesendet wird. In `ProtocolByteDecrypt.md` und `MQTT-Topics.md` ist dieser Frame nicht beschrieben.

**Auswirkung:** Wir wissen nicht offiziell, wozu er dient und ob die WP darauf antwortet. Klärung in Phase 1/2 nötig.

## Inkonsistenzen / Vermutete Code-Bugs

### 4. Spezial-Decoder mit Offset 0

**Befund:** TOP1 (Pump_Flow), TOP11/12 (Operations_Hours/Counter), TOP44 (Error), TOP90/91 (Backup-Heater-Hours), TOP92 (Heat_Pump_Model) tragen in `topicBytes[]` den Wert `0` und in `topicFunctions[]` `unknown`. Sie werden in [decode.cpp:158 — `getDataValue()`](../../vendor/heishamon-upstream/HeishaMon/decode.cpp#L158) per Switch auf Sonderfunktionen umgeleitet.

**Doku-Befund:** [MQTT-Topics.md](../../vendor/heishamon-upstream/MQTT-Topics.md) listet die Topics ganz normal, ohne Hinweis auf Spezialbehandlung. Für eine clean-room-Implementierung müssen wir diese Spezialfälle aus dem Code rekonstruieren.

### 5. Schreibbarkeits-Markierung in `MQTT-Topics.md`

**Befund:** `MQTT-Topics.md` enthält Topics in einer durchnummerierten Tabelle (TOP*), Set-Commands aber als separate Tabelle mit `SET*`-IDs. Die Zuordnung ist nicht maschinen-lesbar. Wir haben die Mapping über die `set_*`-Funktionsnamen in [commands.cpp](../../vendor/heishamon-upstream/HeishaMon/commands.cpp) rekonstruiert (59 schreibbare Datenpunkte).

## Action-Items für unsere Doku

- [ ] **[frames.md](frames.md) erweitern**: sechsten Frame-Typ "Extra-Block-Response" (`0x71 0xC8 0x01 0x21`) ergänzen und den Trigger-Mechanismus (TOP[199] ≥ 3) beschreiben
- [ ] **[code-map.md](code-map.md) ergänzen**: Wo wird der Extra-Block-Poll im Code erzeugt? Wo entscheidet HeishaMon, ob er gesendet wird?
- [ ] **[datapoints.md](datapoints.md) klarstellen**: die Byte-Offsets der XTOP-Tabelle sind Offsets im **Extra-Block-Frame**, nicht im normalen Response-Frame. Aktuell ist das nicht eindeutig formuliert.

Diese Punkte sind klein genug, um sie noch in Phase 0 zu schließen (siehe nächste Commits) oder als bekannte Lücken in Phase 1 mitzunehmen.

## Action-Items, die in spätere Phasen gehören

- [ ] **Phase 1:** Spezialdecoder für TOP1, TOP11, TOP12, TOP44, TOP90, TOP91, TOP92 aus [decode.cpp](../../vendor/heishamon-upstream/HeishaMon/decode.cpp) clean-room nachimplementieren
- [ ] **Phase 1/2:** Initial-Handshake-Mechanik klären (sendet die WP eine Antwort? Muss der Simulator darauf antworten?)
- [ ] **Phase 2:** Mit dem Simulator testen, ob die WP auch auf Set-Commands eine 203-Byte-Antwort schickt (in Doku und Code nicht eindeutig)
