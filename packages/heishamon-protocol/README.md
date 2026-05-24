# heishamon-protocol

CN-CNT-Protokoll-Bibliothek für Panasonic Aquarea Wärmepumpen. Pure TypeScript, **kein I/O** — die Bibliothek wandelt Buffer ↔ Datenpunkte und ist hardwareunabhängig.

## Verwendung

Dieses Paket wird im Monorepo von zwei Konsumenten genutzt:

- `heishamon-sim` — der Wärmepumpen-Simulator (Phase 2)
- `iobroker.heishamon` — der ioBroker-Adapter (Phase 3)

## Aufbau

Siehe [Phase-1-Plan](../../docs/plan/phase-1-protocol-lib.md). Module:

- [src/crc.ts](src/crc.ts) — `computeChecksum`, `verifyFrame` (Zweierkomplement der Bytesumme)
- [src/datapoints.ts](src/datapoints.ts) — kanonische Datenpunkttabelle (144 main + 7 optional + 6 extra = 157)
- [src/decoders.ts](src/decoders.ts) — 22 reine Decoder-Primitive + 7 main-Spezialfälle + 7 OPT-Bit-Extraktoren
- [src/decoder.ts](src/decoder.ts) — `decodeMainFrame`, `decodeExtraFrame`, `decodeOptionalFrame`
- [src/frames.ts](src/frames.ts) — `FrameType`, `identifyFrame`, `createTemplate`, `buildFrame`
- [src/encoder.ts](src/encoder.ts) — `encodeSetCommand(name, value)` für 58 von 59 schreibbaren Topics
- [src/index.ts](src/index.ts) — Public API

## Status

Phase 1 abgeschlossen. **316 Tests grün.** Bekannte Lücken sind im [Phasenplan](../../docs/plan/README.md) dokumentiert.

## Tests

```bash
npm test
```

Test-Vektoren stammen aus dem [HeishaMon-Snapshot](../../vendor/heishamon-upstream/Tools/chksumChecker.js) (76 reale Frames mit gültiger Checksum) und werden als JSON-Fixture unter `test/fixtures/` gepflegt.
