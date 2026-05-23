# heishamon-protocol

CN-CNT-Protokoll-Bibliothek für Panasonic Aquarea Wärmepumpen. Pure TypeScript, **kein I/O** — die Bibliothek wandelt Buffer ↔ Datenpunkte und ist hardwareunabhängig.

## Verwendung

Dieses Paket wird im Monorepo von zwei Konsumenten genutzt:

- `heishamon-sim` — der Wärmepumpen-Simulator (Phase 2)
- `iobroker.heishamon` — der ioBroker-Adapter (Phase 3)

## Aufbau

Siehe [Phase-1-Plan](../../docs/plan/phase-1-protocol-lib.md). Module:

- `src/crc.ts` — Checksum-Berechnung und -Validierung
- `src/frames.ts` — Frame-Builder (Phase 1.2, ausstehend)
- `src/decoder.ts` — tabellengetriebener Decoder (Phase 1.2, ausstehend)
- `src/encoder.ts` — Set-Command-Encoder (Phase 1.2, ausstehend)
- `src/datapoints.ts` — kanonische Datenpunkttabelle aus [docs/protocol/datapoints.md](../../docs/protocol/datapoints.md) (Phase 1.2, ausstehend)
- `src/index.ts` — Public API

## Tests

```bash
npm test
```

Test-Vektoren stammen aus dem [HeishaMon-Snapshot](../../vendor/heishamon-upstream/Tools/chksumChecker.js) (76 reale Frames mit gültiger Checksum) und werden als JSON-Fixture unter `test/fixtures/` gepflegt.
