/**
 * Pure decoder primitives for HeishaMon CN-CNT response frames.
 *
 * Each primitive maps one (frame, offset) tuple to a decoded `number` (or
 * `string` for the seven special-case main-frame datapoints). All functions
 * are pure — no I/O, no shared state.
 *
 * Numeric outputs are returned as floats (no rounding) so consumers can
 * format with the precision they need. HeishaMon's reference implementation
 * rounds Div5/Div50/ValvePID values when stringifying; we deliberately do
 * not, since the canonical project type is `number`.
 *
 * Contract: callers MUST pre-validate that `frame` is long enough for the
 * offsets touched by a given primitive. The `decode*Frame` dispatchers in
 * `decoder.ts` enforce this with a single length check before iterating, so
 * the non-null assertions on `frame[i]` below are safe inside that path.
 */
/**
 * Decoded value as produced by a primitive decoder. All numeric topics use
 * `number`; the seven special-case main-frame topics produce strings
 * (`Error`, `Heat_Pump_Model`, etc.) or numbers depending on the topic.
 */
export type DecodedValue = number | string;
/** Top bit, no offset. Used by `Liquid_Type`. */
export declare function getBit1(frame: Uint8Array, offset: number): number;
/** Top two bits, minus 1. */
export declare function getBit1and2(frame: Uint8Array, offset: number): number;
/** Bits 3 and 4 (counting from MSB), minus 1. */
export declare function getBit3and4(frame: Uint8Array, offset: number): number;
/** Bits 3, 4 and 5 (counting from MSB), minus 1. */
export declare function getBit3and4and5(frame: Uint8Array, offset: number): number;
/** Bits 5 and 6 (counting from MSB), minus 1. */
export declare function getBit5and6(frame: Uint8Array, offset: number): number;
/** Bottom two bits, minus 1. */
export declare function getBit7and8(frame: Uint8Array, offset: number): number;
/** Bottom three bits, minus 1. */
export declare function getRight3bits(frame: Uint8Array, offset: number): number;
/** Byte value minus 1. */
export declare function getIntMinus1(frame: Uint8Array, offset: number): number;
/** Byte value minus 128 (signed temperature offset). */
export declare function getIntMinus128(frame: Uint8Array, offset: number): number;
/** (Byte - 1) / 5. HeishaMon rounds to 1 decimal; we return the raw float. */
export declare function getIntMinus1Div5(frame: Uint8Array, offset: number): number;
/** (Byte - 1) / 50. HeishaMon rounds to 2 decimals; we return the raw float. */
export declare function getIntMinus1Div50(frame: Uint8Array, offset: number): number;
/** (Byte - 1) * 10. */
export declare function getIntMinus1Times10(frame: Uint8Array, offset: number): number;
/** (Byte - 1) * 50. */
export declare function getIntMinus1Times50(frame: Uint8Array, offset: number): number;
/** (Byte - 1) * 200, in watts. */
export declare function getPower(frame: Uint8Array, offset: number): number;
/**
 * Operating-mode enum decode.
 *
 * Mirrors HeishaMon's `getOpMode()`, which masks the input to the lower
 * 6 bits before matching. The mask is required: in real frames the upper
 * two bits of byte 6 carry the zone-state flag (e.g. byte 6 = 0x62 → 0b01100010,
 * lower 6 bits = 34 → Heat+DHW). Without the mask the raw byte (98) would
 * fall through to -1, which is wrong.
 */
export declare function getOpMode(frame: Uint8Array, offset: number): number;
/** Little-endian 16-bit unsigned int at `offset`, minus 1. */
export declare function getUintt16(frame: Uint8Array, offset: number): number;
/** High nibble of the byte, minus 1. */
export declare function getFirstByte(frame: Uint8Array, offset: number): number;
/** Low nibble of the byte, minus 1. */
export declare function getSecondByte(frame: Uint8Array, offset: number): number;
/** (Byte - 1) / 2 — three-way valve PID output as percentage. */
export declare function getValvePID(frame: Uint8Array, offset: number): number;
/**
 * Pump flow rate (l/min) — TOP1.
 *
 * Integer part is byte 170, fractional part is `(byte169 - 1) / 256`.
 */
export declare function getPumpFlow(frame: Uint8Array): number;
/**
 * Operating hours of the heat pump — TOP11.
 *
 * Little-endian 16-bit value at bytes 182/183, minus 1.
 */
export declare function getOperationsHours(frame: Uint8Array): number;
/**
 * Start-counter of the heat pump — TOP12.
 *
 * Little-endian 16-bit value at bytes 179/180, minus 1.
 */
export declare function getOperationsCounter(frame: Uint8Array): number;
/**
 * Operating hours of the room backup heater — TOP90.
 *
 * Little-endian 16-bit value at bytes 185/186, minus 1.
 */
export declare function getRoomHeaterOperationsHours(frame: Uint8Array): number;
/**
 * Operating hours of the DHW backup heater — TOP91.
 *
 * Little-endian 16-bit value at bytes 188/189, minus 1.
 */
export declare function getDhwHeaterOperationsHours(frame: Uint8Array): number;
/**
 * Last error code — TOP44.
 *
 * Byte 113 is the error type, byte 114 is the error number (offset by 17).
 * Type 0xB1 → Fxx, type 0xA1 → Hxx, otherwise "No error". The numeric part
 * is rendered as uppercase hex without zero padding, matching HeishaMon's
 * `sprintf("%02X", ...)` only in upper-case but NOT in width — we keep the
 * natural hex representation since the byte minus 17 is signed there too.
 *
 * Note: HeishaMon's `sprintf("F%02X", number)` zero-pads to 2 hex digits and
 * accepts negative numbers (which produce wide signed hex). We preserve the
 * common-case behaviour (non-negative numbers, zero-padded to 2) here.
 */
export declare function getErrorInfo(frame: Uint8Array): string;
/**
 * Heat-pump model identifier — TOP92.
 *
 * Bytes 129..138 (10 bytes) rendered as uppercase space-separated hex pairs,
 * e.g. `"E2 CE 0D 71 81 72 CE 0C 92 81"`.
 */
export declare function getHeatPumpModel(frame: Uint8Array): string;
/** Zone 1 water-pump request (OPT0). */
export declare function getOptZ1WaterPump(frame: Uint8Array): number;
/** Zone 1 mixing-valve request (OPT1). */
export declare function getOptZ1MixingValve(frame: Uint8Array): number;
/** Zone 2 water-pump request (OPT2). */
export declare function getOptZ2WaterPump(frame: Uint8Array): number;
/** Zone 2 mixing-valve request (OPT3). */
export declare function getOptZ2MixingValve(frame: Uint8Array): number;
/** Pool water-pump request (OPT4). */
export declare function getOptPoolWaterPump(frame: Uint8Array): number;
/** Solar water-pump request (OPT5). */
export declare function getOptSolarWaterPump(frame: Uint8Array): number;
/** Alarm state from optional PCB (OPT6). */
export declare function getOptAlarmState(frame: Uint8Array): number;
//# sourceMappingURL=decoders.d.ts.map