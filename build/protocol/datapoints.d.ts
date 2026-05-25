/**
 * HeishaMon datapoint table.
 *
 * This module is a pure data table. It mirrors `docs/protocol/datapoints.md`
 * 1:1 (157 datapoints across three frames). Decoder logic lives elsewhere.
 *
 * Datapoint names are identical to the HeishaMon MQTT topic suffixes
 * (case-sensitive) — this is a hard project convention.
 */
/**
 * Identifies which frame a datapoint originates from.
 *
 * - `'main'`     — main response frame (`0x71 0xC8 ... 0x01 0x10`), 203 bytes.
 * - `'extra'`    — extra-block response (`0x71 0xC8 ... 0x01 0x21`), 203 bytes,
 *                  K/L-series only. XTOP values are little-endian 16-bit
 *                  pairs spanning `byte` and `byte + 1`.
 * - `'optional'` — optional-PCB frame (`0xF1 0x11 ... 0x01 0x50`), 20 bytes.
 */
export type FrameSource = 'main' | 'extra' | 'optional';
/**
 * Decoder function names from HeishaMon's `decode.h`. The union is the set of
 * values that actually appear in `docs/protocol/datapoints.md`.
 *
 * `'unknown'` marks the seven main-frame datapoints whose decoder is a
 * special-case dispatch in HeishaMon (see `getDataValue()` in `decode.cpp`):
 * Pump_Flow, Operations_Hours, Operations_Counter, Error,
 * Room_Heater_Operations_Hours, DHW_Heater_Operations_Hours, Heat_Pump_Model.
 */
export type DecoderKind = 'getBit1' | 'getBit1and2' | 'getBit3and4' | 'getBit3and4and5' | 'getBit5and6' | 'getBit7and8' | 'getRight3bits' | 'getIntMinus1' | 'getIntMinus128' | 'getIntMinus1Div5' | 'getIntMinus1Div50' | 'getIntMinus1Times10' | 'getIntMinus1Times50' | 'getOpMode' | 'getPower' | 'getUintt16' | 'getErrorInfo' | 'getPumpFlow' | 'getValvePID' | 'getFirstByte' | 'getSecondByte' | 'getOptDataValue' | 'getDataValue' | 'unknown';
export interface DataPoint {
    /** Stable identifier from the upstream tables: `TOPnn`, `OPTn`, `XTOPn`. */
    readonly id: string;
    /** Topic suffix used in MQTT and as the ioBroker state key. Case-sensitive. */
    readonly name: string;
    readonly source: FrameSource;
    /** Byte offset within the source frame. For XTOPs the value spans `byte` and `byte + 1`. */
    readonly byte: number;
    readonly decoder: DecoderKind;
    /** True if HeishaMon exposes a `set_*` command for this topic. */
    readonly writable: boolean;
    /** Physical unit ("°C", "Watt", "min", ...). Omitted when the upstream table shows "—". */
    readonly unit?: string;
    /** Short English description (< 80 chars). Omitted when no useful description exists. */
    readonly description?: string;
}
/**
 * Main-frame datapoints (TOP0–TOP143). Byte offsets refer to the 203-byte
 * main response frame, including the 4-byte header. The checksum is at
 * offset 202, so all offsets are < 203.
 *
 * Order matches `docs/protocol/datapoints.md`, table 1.
 */
export declare const MAIN_DATAPOINTS: readonly DataPoint[];
/**
 * Optional-PCB datapoints (OPT0–OPT6).
 *
 * These represent the control outputs HeishaMon writes when emulating the
 * optional PCB; they are not commands the heat pump accepts. All OPTs are
 * therefore read-only from the adapter's perspective.
 *
 * The `byte` offsets refer to the 20-byte optional-PCB frame; the decoder
 * is uniformly `getOptDataValue` since the upstream code extracts these
 * fields via bit masks inside `getOptDataValue()` rather than per-byte
 * decoders.
 */
export declare const OPTIONAL_DATAPOINTS: readonly DataPoint[];
/**
 * Extra-block datapoints (XTOP0–XTOP5) — K/L-series only.
 *
 * Each value is a little-endian 16-bit unsigned integer spanning `byte` and
 * `byte + 1` in the 203-byte extra-block response frame.
 */
export declare const EXTRA_DATAPOINTS: readonly DataPoint[];
/**
 * Union of all datapoint tables, in section order: main, optional, extra.
 * Use this as the default iteration source unless you specifically need a
 * single frame's datapoints.
 */
export declare const ALL_DATAPOINTS: readonly DataPoint[];
/**
 * Look up a datapoint by its HeishaMon MQTT topic suffix (case-sensitive).
 *
 * @returns the matching `DataPoint`, or `undefined` if no datapoint has that name.
 */
export declare function findByName(name: string): DataPoint | undefined;
//# sourceMappingURL=datapoints.d.ts.map