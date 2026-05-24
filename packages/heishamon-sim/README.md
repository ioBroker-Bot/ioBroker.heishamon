# heishamon-sim

Panasonic Aquarea Wärmepumpen-**Simulator**. Spielt auf der RS485-Leitung die Rolle der Wärmepumpe: empfängt Polls, antwortet mit Telemetrie-Frames, akzeptiert Set-Commands und passt seinen Zustand entsprechend an.

## Wozu

Wir können den ioBroker-Adapter (Phase 3) gegen den Simulator entwickeln, ohne die produktive Heizung anzufassen. Der Simulator selbst wird verifiziert, indem ein **echtes HeishaMon-Modul** mit ihm spricht — wenn das fehlerfrei läuft, ist der Simulator protokollkonform.

Siehe [Phase-2-Plan](../../docs/plan/phase-2-simulator.md) und [Safety-Rules](../../docs/memory/safety-rules.md).

## Module

- [src/state.ts](src/state.ts) — `HeatPumpState`-Typ und Defaults
- [src/response-builder.ts](src/response-builder.ts) — State → 203-Byte-Frame (Bit-Merge bei geteilten Bytes)
- [src/router.ts](src/router.ts) — eingehender Frame → Aktion (Antwort/Mutation/Ignorieren)
- [src/framer.ts](src/framer.ts) — Byte-Stream → komplette Frames
- [src/transport-serial.ts](src/transport-serial.ts) — Adapter auf das `serialport`-Modul
- [src/cli.ts](src/cli.ts) — Command-Line-Entry-Point

## Test-Setup

Zwei USB-RS485-Adapter am PC. Einer am Simulator, einer am echten HeishaMon-Modul. Verkabelt A↔A, B↔B. HeishaMon publiziert via MQTT — die Werte sollten mit dem im Simulator gesetzten Zustand übereinstimmen.
