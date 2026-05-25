# heishamon-sim

Panasonic Aquarea Wärmepumpen-**Simulator**. Spielt auf der seriellen Leitung (RS232-Pegel wie an der echten WP; bei langen Strecken via RS232↔RS485-Konverter) die Rolle der Wärmepumpe: empfängt Polls, antwortet mit Telemetrie-Frames, akzeptiert Set-Commands und passt seinen Zustand entsprechend an.

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

Zwei USB-Serial-Adapter am PC (typischerweise RS232; bei Bedarf über RS232↔RS485-Konverter gebrückt). Einer am Simulator, einer am echten HeishaMon-Modul. RS232 wird gekreuzt verkabelt (TX↔RX, GND↔GND); bei RS485 entsprechend A↔A, B↔B. HeishaMon publiziert via MQTT — die Werte sollten mit dem im Simulator gesetzten Zustand übereinstimmen.
